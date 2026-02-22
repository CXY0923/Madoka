/**
 * GitHub 找项目（类 Copilot）：LLM 生成搜索串 → GitHub Search API → 简单重排
 * 从 callpeek 的 github/githubSearch.js 接入，复用 Madoka 的 Tongyi 配置，可配置 GITHUB_TOKEN 提高限流
 */

import { getConfig } from './config'
import {
  GITHUB_SEARCH_QUERY_PROMPT,
  GITHUB_SEARCH_MAX_REPOS,
  GITHUB_API_PER_PAGE,
} from '../shared/constants'
import type { GitHubRepoItem } from '../shared/types'

const GITHUB_API = 'https://api.github.com'

/** 调用 Madoka 配置的 Tongyi 非流式补全（仅用于生成 GitHub 搜索串，与对话流式调用分离） */
async function callTongyiCompletion(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxTokens = 80
): Promise<{ success: boolean; data?: string; error?: string }> {
  const config = await getConfig()
  try {
    const res = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        max_tokens: maxTokens,
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.warn('[Madoka BG] GitHub search query LLM error:', res.status, errText.slice(0, 200))
      return { success: false, error: `HTTP ${res.status}` }
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = (json?.choices?.[0]?.message?.content || '').trim()
    return { success: true, data: text }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[Madoka BG] GitHub search query LLM exception:', msg)
    return { success: false, error: msg }
  }
}

/**
 * 用 LLM 将用户自然语言转为 GitHub 搜索串
 */
export async function userQueryToGitHubSearchQuery(
  userQuery: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  const text = (userQuery || '').trim()
  if (!text) return { success: false, error: 'empty' }
  const messages = [
    { role: 'system' as const, content: GITHUB_SEARCH_QUERY_PROMPT },
    { role: 'user' as const, content: text },
  ]
  const result = await callTongyiCompletion(messages, 80)
  if (!result.success) return result
  const q = (result.data || '').trim().replace(/\s+/g, ' ').slice(0, 120)
  return { success: true, data: q || encodeURIComponent(text) }
}

/**
 * 调用 GitHub search/repositories
 */
export async function searchGitHubRepositories(
  q: string,
  opts: { page?: number; per_page?: number; githubToken?: string } = {}
): Promise<{ success: boolean; data?: { items: unknown[]; total_count?: number }; error?: string }> {
  const page = opts.page ?? 1
  const perPage = Math.min(opts.per_page ?? GITHUB_API_PER_PAGE, 30)
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perPage}&page=${page}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (opts.githubToken) {
    headers.Authorization = `Bearer ${opts.githubToken}`
  }
  try {
    const res = await fetch(url, { headers })
    const data = (await res.json()) as { message?: string; items?: unknown[]; total_count?: number }
    if (!res.ok) {
      const msg = data?.message || res.statusText || 'GitHub API error'
      console.warn('[Madoka BG] GitHub API error', { status: res.status, message: msg })
      return { success: false, error: msg }
    }
    return {
      success: true,
      data: { items: data.items || [], total_count: data.total_count || 0 },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[Madoka BG] GitHub fetch error', msg)
    return { success: false, error: msg }
  }
}

interface RepoItem {
  stargazers_count?: number
  updated_at?: string
  full_name?: string
  html_url?: string
  description?: string
  language?: string
  [key: string]: unknown
}

/**
 * 简单重排：stars 为主，兼顾最近更新
 */
export function rankRepos(
  items: RepoItem[],
  maxN = GITHUB_SEARCH_MAX_REPOS
): RepoItem[] {
  if (!Array.isArray(items) || items.length === 0) return []
  const now = Date.now()
  const scored = items.map((r) => {
    const stars = r.stargazers_count ?? 0
    const updated = r.updated_at ? new Date(r.updated_at).getTime() : 0
    const recency = updated
      ? Math.max(0, 1 - (now - updated) / (365 * 24 * 60 * 60 * 1000))
      : 0
    const score = Math.log1p(stars) * 2 + recency * 0.5
    return { ...r, _score: score } as RepoItem & { _score: number }
  })
  scored.sort((a, b) => b._score - a._score)
  return scored.slice(0, maxN).map(({ _score: _, ...r }) => r)
}

/**
 * 单次「找项目」完整流程：LLM 生成 query → GitHub API → 重排 → 返回 Top N
 */
export async function handleGitHubSearch(userQuery: string): Promise<{
  success: boolean
  query?: string
  items?: GitHubRepoItem[]
  error?: string
}> {
  const step1 = await userQueryToGitHubSearchQuery(userQuery)
  if (!step1.success) {
    return { success: false, error: step1.error || 'LLM 生成搜索串失败' }
  }
  const query = step1.data!

  const config = await getConfig()
  const githubToken = (config as { githubToken?: string }).githubToken || ''

  const step2 = await searchGitHubRepositories(query, {
    per_page: 30,
    githubToken: githubToken || undefined,
  })
  if (!step2.success) {
    return { success: false, query, error: step2.error || 'GitHub API 失败' }
  }
  const items = (step2.data?.items || []) as RepoItem[]

  const top = rankRepos(items, GITHUB_SEARCH_MAX_REPOS)
  const cards: GitHubRepoItem[] = top.map((r) => ({
    full_name: r.full_name || '',
    html_url: r.html_url || '',
    description: (r.description as string) || '',
    stargazers_count: (r.stargazers_count as number) ?? 0,
    language: (r.language as string) || '',
    updated_at: (r.updated_at as string) || '',
  }))

  return { success: true, query, items: cards }
}
