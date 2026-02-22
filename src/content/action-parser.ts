/**
 * Madoka Action Parser Module
 * 网页可交互元素提取模块，输出 Action Space
 */

import type {
  Action,
  ActionSpace,
  ActionType,
  DangerLevel,
  RowContext,
  ContextualActionGroup,
} from '../shared/action-types'

// 从 action-types 引入常量
const SCORE_THRESHOLD_VALUE = 15
const DANGER_KEYWORDS_MAP = {
  high: ['delete', 'remove', '删除', '移除', 'logout', '退出', 'clear', '清空'],
  medium: ['submit', 'confirm', '提交', '确认', 'pay', '支付', 'send', '发送'],
}

/**
 * 等待 DOM 稳定（复用 reader.ts 的逻辑）
 */
const waitForDomStable = (timeout = 3000): Promise<void> =>
  new Promise((resolve) => {
    let lastMutation = Date.now()
    let resolved = false

    const observer = new MutationObserver(() => {
      lastMutation = Date.now()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    const check = () => {
      if (resolved) return
      if (Date.now() - lastMutation > 500) {
        resolved = true
        observer.disconnect()
        console.log('[Madoka ActionParser] ✅ DOM已稳定')
        resolve()
      } else {
        setTimeout(check, 200)
      }
    }

    setTimeout(check, 200)
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        observer.disconnect()
        console.log('[Madoka ActionParser] ⏰ 等待超时，继续处理')
        resolve()
      }
    }, timeout)
  })

/**
 * 事件监听器信息
 */
interface EventListenerInfo {
  hasListener: boolean
  types: string[]
  isInline: boolean
  isFramework: boolean
}

/**
 * ActionSpaceExtractor 类
 */
class ActionSpaceExtractor {
  private version = 0
  private actionCounter = 0

  constructor() {}

  /**
   * 检测元素是否有真实事件监听
   */
  private hasRealEventListener(el: HTMLElement): EventListenerInfo {
    const events: EventListenerInfo = {
      hasListener: false,
      types: [],
      isInline: false,
      isFramework: false,
    }

    // 方法 1: inline handler
    const inlineEvents = ['onclick', 'onchange', 'oninput', 'onsubmit', 'onkeydown', 'onkeyup', 'onfocus', 'onblur']
    for (const evt of inlineEvents) {
      if ((el as unknown as Record<string, unknown>)[evt]) {
        events.hasListener = true
        events.isInline = true
        events.types.push(evt.slice(2))
      }
    }

    // 方法 2: 框架绑定检测（React/Vue）
    const keys = Object.keys(el)
    if (keys.some((k) => k.startsWith('__react') || k.startsWith('__vue'))) {
      events.hasListener = true
      events.isFramework = true
      events.types.push('framework_bound')
    }

    // 方法 3: getEventListeners (仅在 DevTools 环境)
    if (typeof (window as unknown as { getEventListeners?: (el: Element) => Record<string, unknown[]> }).getEventListeners === 'function') {
      try {
        const listeners = (window as unknown as { getEventListeners: (el: Element) => Record<string, unknown[]> }).getEventListeners(el)
        if (Object.keys(listeners).length > 0) {
          events.hasListener = true
          events.types.push(...Object.keys(listeners))
        }
      } catch {
        // ignore
      }
    }

    // 方法 4: 全局监听器 Map（需要 Monkey Patch）
    const globalMap = (window as unknown as { __madokaEventMap?: Map<EventTarget, Set<string>> }).__madokaEventMap
    if (globalMap?.has(el)) {
      events.hasListener = true
      const types = globalMap.get(el)
      if (types) {
        events.types.push(...types)
      }
    }

    return events
  }

  /**
   * 检测元素是否可见
   */
  private isVisible(el: HTMLElement): boolean {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0 &&
      !this.hasHiddenAncestor(el)
    )
  }

  private hasHiddenAncestor(el: HTMLElement): boolean {
    let current = el.parentElement
    while (current) {
      const style = getComputedStyle(current)
      if (style.display === 'none' || style.visibility === 'hidden') {
        return true
      }
      current = current.parentElement
    }
    return false
  }

  /**
   * 检测元素是否可用（非 disabled）
   */
  private isEnabled(el: HTMLElement): boolean {
    if ((el as HTMLButtonElement).disabled) {
      return false
    }
    if (el.getAttribute('aria-disabled') === 'true') {
      return false
    }
    const style = getComputedStyle(el)
    if (style.pointerEvents === 'none') {
      return false
    }
    return true
  }

  /**
   * 计算交互密度（邻居效应）
   */
  private calculateInteractionDensity(el: HTMLElement): number {
    const parent = el.parentElement
    if (!parent) return 0

    const siblings = Array.from(parent.children)
    const interactiveTags = ['button', 'a', 'input', 'select']

    const interactiveCount = siblings.filter(
      (s) =>
        interactiveTags.includes(s.tagName.toLowerCase()) ||
        s.getAttribute('role') === 'button' ||
        (s as HTMLElement).onclick !== null
    ).length

    return siblings.length > 0 ? interactiveCount / siblings.length : 0
  }

  /**
   * 提取行上下文
   */
  private extractRowContext(el: HTMLElement): RowContext | null {
    const row = el.closest('tr, [role="row"], li, .row, .list-item, .item, .card')
    if (!row) return null

    const rowEl = row as HTMLElement

    // 提取行的唯一标识
    const rowKey =
      rowEl.dataset.id ||
      rowEl.dataset.key ||
      rowEl.dataset.rowId ||
      rowEl.id ||
      rowEl.getAttribute('data-id') ||
      rowEl.getAttribute('aria-rowindex') ||
      rowEl.querySelector('.id, .key, td:first-child, [data-primary]')?.textContent?.trim() ||
      null

    // 提取行的可读标签
    const labelEl = rowEl.querySelector('.title, .name, .subject, strong, b, td:nth-child(2), .primary, a[href]')
    const rowLabel = labelEl?.textContent?.trim()?.slice(0, 50) || null

    return {
      rowKey,
      rowLabel,
      fullText: rowEl.textContent?.trim().slice(0, 200) || null,
    }
  }

  /**
   * 判断危险等级
   */
  private classifyDangerLevel(el: HTMLElement, label: string): DangerLevel {
    const text = (label + ' ' + el.className + ' ' + el.id).toLowerCase()

    for (const keyword of DANGER_KEYWORDS_MAP.high) {
      if (text.includes(keyword.toLowerCase())) {
        return 'danger'
      }
    }

    for (const keyword of DANGER_KEYWORDS_MAP.medium) {
      if (text.includes(keyword.toLowerCase())) {
        return 'warning'
      }
    }

    // type=submit 默认 warning
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'submit') {
      return 'warning'
    }
    if (el.tagName === 'BUTTON' && (el as HTMLButtonElement).type === 'submit') {
      return 'warning'
    }

    return 'safe'
  }

  /**
   * 判断 Action 类型
   */
  private classifyActionType(el: HTMLElement): ActionType {
    const tag = el.tagName.toLowerCase()

    if (tag === 'a') return 'navigate'
    if (tag === 'input') {
      const type = (el as HTMLInputElement).type
      if (type === 'checkbox' || type === 'radio') return 'toggle'
      if (type === 'submit') return 'submit'
      return 'input'
    }
    if (tag === 'select') return 'select'
    if (tag === 'textarea') return 'input'
    if (tag === 'button') {
      const type = (el as HTMLButtonElement).type
      if (type === 'submit') return 'submit'
    }

    return 'click'
  }

  /**
   * 生成 CSS 选择器（回退方案）
   */
  private generateSelector(el: HTMLElement): string {
    // 尝试多种策略生成唯一选择器
    if (el.id) {
      return `#${el.id}`
    }

    const tag = el.tagName.toLowerCase()
    const classes = Array.from(el.classList)
      .filter((c) => !c.startsWith('madoka'))
      .slice(0, 3)
      .join('.')

    if (classes) {
      const selector = `${tag}.${classes}`
      const matches = document.querySelectorAll(selector)
      if (matches.length === 1) {
        return selector
      }
    }

    // 使用 nth-child
    const parent = el.parentElement
    if (parent) {
      const siblings = Array.from(parent.children)
      const index = siblings.indexOf(el) + 1
      const parentSelector = parent.id ? `#${parent.id}` : parent.tagName.toLowerCase()
      return `${parentSelector} > ${tag}:nth-child(${index})`
    }

    return tag
  }

  /**
   * 获取元素的可读标签
   */
  private getLabel(el: HTMLElement): string {
    // 按优先级尝试多种方式
    const candidates = [
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.textContent?.trim(),
      (el as HTMLInputElement).placeholder,
      (el as HTMLInputElement).value,
      el.getAttribute('alt'),
      el.getAttribute('name'),
    ]

    for (const c of candidates) {
      if (c && c.length > 0 && c.length < 100) {
        return c.slice(0, 50)
      }
    }

    return el.tagName.toLowerCase()
  }

  /**
   * 多维度评分
   */
  private scoreInteractivity(el: HTMLElement): { score: number; signals: string[] } {
    let score = 0
    const signals: string[] = []

    // === 维度 1: 事件监听（最高权重 40 分）===
    const eventInfo = this.hasRealEventListener(el)
    if (eventInfo.hasListener) {
      score += 40
      signals.push('has_listener')
      if (eventInfo.isInline) signals.push('inline_handler')
      if (eventInfo.isFramework) signals.push('framework_bound')
    }

    // === 维度 2: 原生语义（25 分）===
    const tag = el.tagName.toLowerCase()
    const semanticScores: Record<string, number> = {
      button: 25,
      a: 20,
      input: 20,
      select: 20,
      textarea: 15,
      form: 10,
      label: 5,
    }
    const semanticScore = semanticScores[tag] || 0
    score += semanticScore
    if (semanticScore > 0) signals.push('semantic_tag')

    // === 维度 3: ARIA / Role（20 分）===
    const role = el.getAttribute('role')
    if (role) {
      const roleScores: Record<string, number> = {
        button: 20,
        link: 20,
        menuitem: 18,
        option: 15,
        checkbox: 15,
        tab: 15,
        switch: 15,
        textbox: 15,
        combobox: 15,
      }
      const roleScore = roleScores[role] || 5
      score += roleScore
      signals.push(`role_${role}`)
    }

    // === 维度 4: 可聚焦性（10 分）===
    if (el.tabIndex >= 0) {
      score += 10
      signals.push('focusable')
    }

    // === 维度 5: 视觉信号（15 分）===
    const style = getComputedStyle(el)
    if (style.cursor === 'pointer') {
      score += 8
      signals.push('cursor_pointer')
    }
    if (style.userSelect === 'none') {
      score += 3
      signals.push('user_select_none')
    }

    // === 维度 6: class/id 启发式（10 分）===
    const text = (el.className + ' ' + el.id).toLowerCase()
    const patterns = [
      { regex: /\b(btn|button)\b/, score: 10, signal: 'btn_class' },
      { regex: /\b(link|anchor)\b/, score: 8, signal: 'link_class' },
      { regex: /\b(submit|confirm)\b/, score: 12, signal: 'submit_class' },
      { regex: /\b(edit|modify)\b/, score: 10, signal: 'edit_class' },
      { regex: /\b(delete|remove|del)\b/, score: 12, signal: 'delete_class' },
      { regex: /\b(cancel|close)\b/, score: 8, signal: 'cancel_class' },
      { regex: /\b(menu|dropdown)\b/, score: 9, signal: 'menu_class' },
      { regex: /\b(clickable|interactive)\b/, score: 10, signal: 'explicit_class' },
    ]

    for (const p of patterns) {
      if (p.regex.test(text)) {
        score += p.score
        signals.push(p.signal)
        break
      }
    }

    // === 维度 7: 交互密度（邻居效应，15 分）===
    const density = this.calculateInteractionDensity(el)
    score += Math.min(density * 15, 15)
    if (density > 0.3) signals.push('high_density')

    // === 维度 8: 可见性检查（致命惩罚）===
    if (!this.isVisible(el)) {
      score = 0
      signals.push('not_visible')
    }

    // === 维度 9: 上下文绑定奖励（表格/列表行，10 分）===
    const hasContext = this.extractRowContext(el)
    if (hasContext) {
      score += 10
      signals.push('has_context')
    }

    // === 维度 10: 可用性检查（致命惩罚）===
    if (!this.isEnabled(el)) {
      score = Math.floor(score * 0.3) // 大幅降低但不完全排除
      signals.push('disabled')
    }

    return { score, signals }
  }

  /**
   * 获取候选交互元素
   */
  private getCandidateElements(root: Document | HTMLElement = document): HTMLElement[] {
    const selectors = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[onclick]',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="checkbox"]',
      '[role="tab"]',
      '[role="switch"]',
      '[tabindex]',
      '[data-action]',
      '[data-click]',
    ]

    const elements = root.querySelectorAll(selectors.join(', '))
    return Array.from(elements) as HTMLElement[]
  }

  /**
   * 提取 select 元素的选项
   */
  private extractSelectOptions(el: HTMLElement): { value: string; label: string }[] | undefined {
    if (el.tagName.toLowerCase() !== 'select') return undefined

    const select = el as HTMLSelectElement
    return Array.from(select.options).map((opt) => ({
      value: opt.value,
      label: opt.text,
    }))
  }

  /**
   * 提取 Action Space
   */
  async extract(doc: Document = document): Promise<ActionSpace> {
    // 增加版本号
    this.version++
    this.actionCounter = 0

    // 获取候选元素
    const candidates = this.getCandidateElements(doc)
    console.log(`[Madoka ActionParser] 找到 ${candidates.length} 个候选元素`)

    // 评分和过滤
    const scoredElements: { el: HTMLElement; score: number; signals: string[] }[] = []

    for (const el of candidates) {
      // 跳过已经处理过的元素
      if (el.dataset.madokaActionId) continue

      const { score, signals } = this.scoreInteractivity(el)

      if (score >= SCORE_THRESHOLD_VALUE) {
        scoredElements.push({ el, score, signals })
      }
    }

    // 按分数排序
    scoredElements.sort((a, b) => b.score - a.score)

    console.log(`[Madoka ActionParser] 筛选出 ${scoredElements.length} 个可交互元素`)

    // 构建 Actions
    const actions: Action[] = []
    const contextualGroups = new Map<string, ContextualActionGroup>()

    for (const { el, score, signals } of scoredElements) {
      const actionId = `act_v${this.version}_${this.actionCounter++}`

      // 注入 actionId 到 DOM
      el.dataset.madokaActionId = actionId

      const label = this.getLabel(el)
      const rect = el.getBoundingClientRect()
      const context = this.extractRowContext(el)

      const action: Action = {
        actionId,
        type: this.classifyActionType(el),
        label,
        tagName: el.tagName.toLowerCase(),
        selector: this.generateSelector(el),
        isVisible: this.isVisible(el),
        isEnabled: this.isEnabled(el),
        dangerLevel: this.classifyDangerLevel(el, label),
        score,
        signals,
        bbox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        context: context || undefined,
        placeholder: (el as HTMLInputElement).placeholder,
        currentValue: (el as HTMLInputElement).value || undefined,
        options: this.extractSelectOptions(el),
      }

      actions.push(action)

      // 分组到上下文
      if (context) {
        const contextKey = context.rowKey || context.rowLabel || context.fullText?.slice(0, 30) || 'unknown'
        if (!contextualGroups.has(contextKey)) {
          contextualGroups.set(contextKey, {
            context: {
              type: el.closest('tr') ? 'table_row' : el.closest('li') ? 'list_item' : 'card',
              key: context.rowKey,
              label: context.rowLabel,
            },
            actions: [],
          })
        }
        contextualGroups.get(contextKey)!.actions.push(action)
      }
    }

    // 分离全局和上下文绑定的 Actions
    const contextualActionIds = new Set<string>()
    contextualGroups.forEach((group) => {
      group.actions.forEach((a) => contextualActionIds.add(a.actionId))
    })

    const globalActions = actions.filter((a) => !contextualActionIds.has(a.actionId))
    const contextualActions = Array.from(contextualGroups.values())

    const actionSpace: ActionSpace = {
      meta: {
        url: location.href,
        title: document.title,
        extractedAt: Date.now(),
        version: this.version,
        totalActions: actions.length,
      },
      globalActions,
      contextualActions,
    }

    console.log('[Madoka ActionParser] ===== 提取完成 =====')
    console.log(`[Madoka ActionParser] 📊 全局操作: ${globalActions.length}`)
    console.log(`[Madoka ActionParser] 📊 上下文组: ${contextualActions.length}`)
    console.log(`[Madoka ActionParser] 📊 总操作数: ${actions.length}`)

    return actionSpace
  }

  /**
   * 清除所有注入的 actionId
   */
  clearActionIds(): void {
    const elements = document.querySelectorAll('[data-madoka-action-id]')
    elements.forEach((el) => {
      delete (el as HTMLElement).dataset.madokaActionId
    })
    console.log(`[Madoka ActionParser] 清除了 ${elements.length} 个 actionId`)
  }

  /**
   * 根据 actionId 获取元素
   */
  getElementByActionId(actionId: string): HTMLElement | null {
    return document.querySelector(`[data-madoka-action-id="${actionId}"]`) as HTMLElement | null
  }

  /**
   * 验证 actionId 是否仍然有效
   */
  validateActionId(actionId: string): { valid: boolean; reason?: string } {
    const el = this.getElementByActionId(actionId)

    if (!el) {
      return { valid: false, reason: '元素不存在' }
    }

    if (!this.isVisible(el)) {
      return { valid: false, reason: '元素不可见' }
    }

    if (!this.isEnabled(el)) {
      return { valid: false, reason: '元素已禁用' }
    }

    return { valid: true }
  }
}

// 导出模块
let parserInstance: ActionSpaceExtractor | null = null

export const MadokaActionParser = {
  getInstance() {
    if (!parserInstance) {
      parserInstance = new ActionSpaceExtractor()
    }
    return parserInstance
  },

  async extractCurrentPage() {
    console.log('[Madoka ActionParser] ⏳ 等待动态内容加载...')
    await waitForDomStable(3000)

    const parser = this.getInstance()
    const result = await parser.extract()

    return result
  },

  getElementByActionId(actionId: string) {
    return this.getInstance().getElementByActionId(actionId)
  },

  validateActionId(actionId: string) {
    return this.getInstance().validateActionId(actionId)
  },

  clearActionIds() {
    return this.getInstance().clearActionIds()
  },
}

// 挂载到 window
;(window as unknown as { MadokaActionParser: typeof MadokaActionParser }).MadokaActionParser = MadokaActionParser

console.log('[Madoka] ActionParser module loaded')
