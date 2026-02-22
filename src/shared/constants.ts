/**
 * 常量配置
 */

// 系统提示词
export const SYSTEM_PROMPT = `你是 Madoka，一个智能搜索助手。

用户消息可能包含以下 JSON 结构的上下文信息：
{
  "question": "用户的问题",
  "page_content": "当前页面的 Markdown 内容（可选）",
  "search_results": "搜索结果（可选）"
}

规则：
1. 优先基于 page_content 或 search_results 中的信息回答问题
2. 在回答中适当引用来源
3. 如果上下文信息不足以回答问题，请明确说明
4. 使用 Markdown 格式组织回答
5. 保持回答简洁、准确、有帮助
6. 如果没有上下文信息，可以正常对话`

// 搜索关键词
export const SEARCH_KEYWORDS = [
  '最新',
  '今天',
  '现在',
  '当前',
  '新闻',
  '消息',
  '怎么样',
  '多少钱',
  '价格',
  '天气',
  '股票',
  '什么是',
  '如何',
  '教程',
  '方法',
]

// 搜索命令前缀
export const SEARCH_PREFIXES = ['/search ', '/搜索 ']

// 特殊命令
export const COMMANDS = {
  CLEAR: ['/clear', '/清空'],
  HELP: ['/help', '/帮助'],
  READ: ['/read', '/阅读'],
} as const

// 模型选项
export const MODEL_OPTIONS = [
  { value: 'qwen-plus', label: 'qwen-plus (推荐)' },
  { value: 'qwen-turbo', label: 'qwen-turbo (快速)' },
  { value: 'qwen-max', label: 'qwen-max (强大)' },
] as const

// 搜索结果数量选项
export const MAX_RESULTS_OPTIONS = [
  { value: 3, label: '3 个' },
  { value: 5, label: '5 个 (推荐)' },
  { value: 8, label: '8 个' },
  { value: 10, label: '10 个' },
] as const

// 多轮关联搜索：每轮取几条、最多几轮、总结果上限
export const MULTI_SEARCH_MAX_ROUNDS = 3
export const RESULTS_PER_ROUND = 2
export const MULTI_SEARCH_MAX_TOTAL = 8

// Condense Question：将追问重写为独立可搜索问题（LangChain ConversationalRetrieval 思路）
export const CONDENSE_QUESTION_PROMPT = `根据以下对话历史和用户的追问，将追问重写为一个独立的、可单独理解的问题。使用原文语言，仅输出重写后的问题，不要解释。

对话历史：
{chat_history}

追问：{question}

独立问题：`

// 追问特征：以代词/指代开头或过短片段（需结合历史理解）
export const FOLLOW_UP_INDICATORS = /^(它|那个|这个|他|她|他的|她的|它的|怎么样|呢|还有吗|然后呢?|多少钱)$|^(它|那个|这个|他|她)(呢|的)?/
export const CONDENSE_MAX_HISTORY_TURNS = 5
export const CONDENSE_FOLLOW_UP_MAX_LEN = 15
