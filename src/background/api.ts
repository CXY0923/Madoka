/**
 * Tongyi API Module
 * Includes AI-based smart search and keyword extraction
 */

import type { SearchContext } from '../shared/types'
import { SYSTEM_PROMPT } from '../shared/constants'
import { getConfig } from './config'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Build structured user message with context
 */
export function buildStructuredMessage(
  question: string,
  options: {
    pageContent?: string
    searchContext?: SearchContext
  } = {}
): string {
  const { pageContent, searchContext } = options

  if (!pageContent && !searchContext) {
    return question
  }

  const messageObj: Record<string, unknown> = {
    question,
  }

  if (pageContent) {
    messageObj.page_content = pageContent
  }

  if (searchContext && searchContext.results && searchContext.results.length > 0) {
    const maxPerResult = 4000
    const maxTotal = 20000
    let totalLength = 0

    const processedResults: {
      position: number
      title: string
      url: string
      content: string
    }[] = []

    for (const r of searchContext.results) {
      const content = r.fullContent || r.snippet || ''
      const availableLength = Math.min(maxPerResult, maxTotal - totalLength)

      if (availableLength <= 0) break

      const truncatedContent = content.slice(0, availableLength)
      totalLength += truncatedContent.length

      processedResults.push({
        position: processedResults.length + 1,
        title: r.title,
        url: r.link,
        content: truncatedContent,
      })
    }

    messageObj.search_results = {
      query: searchContext.query,
      engine: searchContext.engine,
      results: processedResults,
    }

    console.log(`[Madoka BG] Search results length: ${totalLength} chars, ${processedResults.length} results`)
  }

  return JSON.stringify(messageObj, null, 2)
}

/**
 * Handle chat request, build message array
 */
export async function handleChat(
  message: string,
  history: { role: string; content: string }[] = [],
  options: {
    pageContent?: string
    searchContext?: SearchContext
  } = {}
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]

  // Add history messages
  history.forEach((msg) => {
    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
  })

  // Build structured user message
  const userContent = buildStructuredMessage(message, options)
  messages.push({ role: 'user', content: userContent })

  return messages
}

/**
 * Call Tongyi API (streaming)
 */
export async function callTongyiAPI(
  messages: ChatMessage[],
  onChunk?: (chunk: string, content: string) => void
): Promise<string> {
  const config = await getConfig()

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} - ${errorText}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            if (onChunk) {
              onChunk(delta, fullContent)
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return fullContent
}

/**
 * Call Tongyi API (non-streaming) for analysis tasks
 */
async function callTongyiAPISync(messages: ChatMessage[]): Promise<string> {
  const config = await getConfig()

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen-turbo', // Use faster model for analysis
      messages,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  const json = await response.json()
  return json.choices?.[0]?.message?.content || ''
}

// ============ Smart Search Logic ============

/**
 * Result from AI search analysis
 */
export interface SmartSearchResult {
  needsSearch: boolean
  searchQuery: string | null
  reason: string
  confidence: number
}

/**
 * Prompt for AI to analyze if search is needed
 */
const SEARCH_ANALYSIS_PROMPT = `You are a search decision assistant. Analyze the user's question and determine if a web search would help answer it better.

Respond in JSON format only:
{
  "needsSearch": true/false,
  "searchQuery": "optimized search query" or null,
  "reason": "brief explanation",
  "confidence": 0.0-1.0
}

Criteria for needing search:
1. Questions about current events, news, or time-sensitive information
2. Technical/professional topics that require specific, accurate information
3. Niche subjects where general knowledge might be insufficient
4. Questions asking for specific facts, statistics, or data
5. Questions about recent developments in any field

Criteria for NOT needing search:
1. Simple conversational questions
2. Requests for general explanations of well-known concepts
3. Creative writing or brainstorming requests
4. Personal opinions or preferences
5. Programming help for common patterns
6. Math calculations or logical reasoning

If search is needed, create an optimized search query by:
- Extracting key concepts and terms
- Combining with relevant technical terms
- Adding context keywords if helpful
- Format: "keyword1 + keyword2 + context"

Examples:
- "What is React?" → No search needed (well-known concept)
- "What are the latest features in React 19?" → Search needed, query: "React 19 new features 2025"
- "How to implement OAuth in Next.js" → May need search for latest best practices
- "What is the weather today?" → Search needed, query: "current weather"
- "Write me a poem about cats" → No search needed`

/**
 * Use AI to determine if search is needed (Smart Search)
 */
export async function analyzeSearchNeed(message: string): Promise<SmartSearchResult> {
  // Quick check for explicit search commands
  if (message.startsWith('/search ') || message.startsWith('/搜索 ')) {
    const query = message.replace(/^\/(search|搜索)\s+/, '').trim()
    return {
      needsSearch: true,
      searchQuery: query,
      reason: 'User explicitly requested search',
      confidence: 1.0,
    }
  }

  // Quick heuristic check for obvious cases (save API calls)
  const noSearchPatterns = [
    /^(hi|hello|hey|你好|嗨)/i,
    /^(thanks|thank you|谢谢)/i,
    /^(yes|no|ok|okay|好的|是的|不是)/i,
  ]
  
  if (noSearchPatterns.some(p => p.test(message.trim()))) {
    return {
      needsSearch: false,
      searchQuery: null,
      reason: 'Simple conversational message',
      confidence: 0.95,
    }
  }

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: SEARCH_ANALYSIS_PROMPT },
      { role: 'user', content: message },
    ]

    const response = await callTongyiAPISync(messages)
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return {
        needsSearch: Boolean(result.needsSearch),
        searchQuery: result.searchQuery || null,
        reason: result.reason || 'AI analysis',
        confidence: typeof result.confidence === 'number' ? result.confidence : 0.7,
      }
    }
  } catch (e) {
    console.warn('[Madoka BG] Smart search analysis failed:', e)
  }

  // Fallback to keyword-based detection
  return shouldSearchFallback(message)
}

/**
 * Extract and optimize search keywords from user message
 */
export async function extractSearchKeywords(message: string): Promise<string> {
  const prompt = `Extract the key search terms from this message and create an optimized search query.

Message: "${message}"

Rules:
1. Focus on the main topic and specific terms
2. Remove filler words and conversational elements
3. Add relevant context terms if helpful
4. Keep it concise (3-6 key terms)
5. Return ONLY the search query, nothing else

Example:
Message: "I want to know about the latest developments in AI self-learning systems"
Query: AI self-learning systems latest developments 2025`

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: message },
    ]

    const response = await callTongyiAPISync(messages)
    return response.trim() || message
  } catch (e) {
    console.warn('[Madoka BG] Keyword extraction failed:', e)
    return message
  }
}

/**
 * Fallback keyword-based search detection
 */
function shouldSearchFallback(message: string): SmartSearchResult {
  // Keywords that suggest search is needed
  const searchKeywords = [
    // Time-sensitive
    '最新', '今天', '现在', '当前', '新闻', '消息', 'latest', 'current', 'today', 'recent', 'news',
    // Questions about facts
    '怎么样', '多少钱', '价格', '天气', '股票', 'how much', 'price', 'weather', 'stock',
    // Learning/research
    '什么是', '如何', '教程', '方法', 'what is', 'how to', 'tutorial', 'guide',
    // Specific/technical
    '官方', '文档', 'documentation', 'official', 'spec', 'specification',
  ]

  const lowerMessage = message.toLowerCase()
  const matchedKeyword = searchKeywords.find(kw => lowerMessage.includes(kw.toLowerCase()))

  if (matchedKeyword) {
    return {
      needsSearch: true,
      searchQuery: message,
      reason: `Contains search indicator: "${matchedKeyword}"`,
      confidence: 0.6,
    }
  }

  return {
    needsSearch: false,
    searchQuery: null,
    reason: 'No search indicators found',
    confidence: 0.5,
  }
}

/**
 * Legacy function for backward compatibility
 */
export function shouldSearch(message: string): boolean {
  if (message.startsWith('/search ') || message.startsWith('/搜索 ')) {
    return true
  }

  const searchKeywords = [
    '最新', '今天', '现在', '当前', '新闻', '消息',
    '怎么样', '多少钱', '价格', '天气', '股票',
    '什么是', '如何', '教程', '方法',
  ]

  return searchKeywords.some((kw) => message.includes(kw))
}
