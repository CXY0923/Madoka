/**
 * Madoka Action Executor Module
 * 网页 Action 执行器，负责高亮、点击、输入、选择等操作
 */

import type {
  ActionParams,
  ActionResult,
  ActionStatus,
} from '../shared/action-types'
import { MadokaActionParser } from './action-parser'

// 高亮样式常量
const HIGHLIGHT_STYLES_MAP: Record<ActionStatus, string> = {
  pending: 'outline: 3px dashed #3b82f6; outline-offset: 2px;',
  executing: 'outline: 3px solid #f59e0b; outline-offset: 2px; animation: madoka-pulse 1s infinite;',
  success: 'outline: 3px solid #10b981; outline-offset: 2px;',
  failed: 'outline: 3px solid #ef4444; outline-offset: 2px;',
  skipped: 'outline: 3px dashed #9ca3af; outline-offset: 2px;',
}

// 注入动画样式
function injectAnimationStyles() {
  if (document.getElementById('madoka-action-styles')) return

  const style = document.createElement('style')
  style.id = 'madoka-action-styles'
  style.textContent = `
    @keyframes madoka-pulse {
      0%, 100% { outline-color: #f59e0b; }
      50% { outline-color: #fbbf24; }
    }
    
    [data-madoka-highlight] {
      transition: outline 0.2s ease-in-out;
    }
  `
  document.head.appendChild(style)
}

/**
 * ActionExecutor 类
 */
class ActionExecutor {
  private highlightedElements = new Map<string, HTMLElement>()
  private originalStyles = new Map<string, string>()

  constructor() {
    injectAnimationStyles()
  }

  /**
   * 根据 actionId 获取元素
   */
  private getElement(actionId: string): HTMLElement | null {
    return MadokaActionParser.getElementByActionId(actionId)
  }

  /**
   * 高亮元素
   */
  highlight(actionId: string, status: ActionStatus): boolean {
    const el = this.getElement(actionId)
    if (!el) {
      console.warn(`[Madoka Executor] 找不到元素: ${actionId}`)
      return false
    }

    // 保存原始样式
    if (!this.originalStyles.has(actionId)) {
      this.originalStyles.set(actionId, el.style.cssText)
    }

    // 应用高亮样式
    const highlightStyle = HIGHLIGHT_STYLES_MAP[status] || HIGHLIGHT_STYLES_MAP.pending
    el.style.cssText += highlightStyle
    el.dataset.madokaHighlight = status

    this.highlightedElements.set(actionId, el)

    // 滚动到可见位置
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    console.log(`[Madoka Executor] 高亮元素: ${actionId} (${status})`)
    return true
  }

  /**
   * 取消高亮
   */
  unhighlight(actionId: string): boolean {
    const el = this.highlightedElements.get(actionId)
    if (!el) return false

    // 恢复原始样式
    const originalStyle = this.originalStyles.get(actionId) || ''
    el.style.cssText = originalStyle
    delete el.dataset.madokaHighlight

    this.highlightedElements.delete(actionId)
    this.originalStyles.delete(actionId)

    console.log(`[Madoka Executor] 取消高亮: ${actionId}`)
    return true
  }

  /**
   * 清除所有高亮
   */
  clearAllHighlights(): void {
    for (const actionId of this.highlightedElements.keys()) {
      this.unhighlight(actionId)
    }
    console.log('[Madoka Executor] 清除所有高亮')
  }

  /**
   * 执行点击操作
   */
  private async executeClick(el: HTMLElement): Promise<void> {
    // 触发完整的点击事件序列
    el.focus()

    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
    })
    el.dispatchEvent(mouseDownEvent)

    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
    })
    el.dispatchEvent(mouseUpEvent)

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    })
    el.dispatchEvent(clickEvent)

    // 对于链接，可能需要触发导航
    if (el.tagName === 'A' && (el as HTMLAnchorElement).href) {
      // 让浏览器处理链接导航
    }
  }

  /**
   * 执行输入操作
   */
  private async executeInput(el: HTMLElement, value: string): Promise<void> {
    const input = el as HTMLInputElement | HTMLTextAreaElement

    // 聚焦
    input.focus()

    // 清空现有内容
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))

    // 模拟逐字输入（可选，这里直接设置值）
    input.value = value

    // 触发 input 事件
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: value,
        inputType: 'insertText',
      })
    )

    // 触发 change 事件
    input.dispatchEvent(new Event('change', { bubbles: true }))

    console.log(`[Madoka Executor] 输入值: "${value}"`)
  }

  /**
   * 执行选择操作
   */
  private async executeSelect(el: HTMLElement, selectedValue: string): Promise<void> {
    const select = el as HTMLSelectElement

    // 设置选中值
    select.value = selectedValue

    // 触发 change 事件
    select.dispatchEvent(new Event('change', { bubbles: true }))

    console.log(`[Madoka Executor] 选择值: "${selectedValue}"`)
  }

  /**
   * 执行切换操作（checkbox/radio）
   */
  private async executeToggle(el: HTMLElement): Promise<void> {
    const input = el as HTMLInputElement

    // 切换状态
    input.checked = !input.checked

    // 触发 change 事件
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.dispatchEvent(new Event('click', { bubbles: true }))

    console.log(`[Madoka Executor] 切换状态: ${input.checked}`)
  }

  /**
   * 检测 DOM 变化
   */
  private async detectDomChanges(callback: () => Promise<void>): Promise<boolean> {
    let domChanged = false

    const observer = new MutationObserver(() => {
      domChanged = true
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    await callback()

    // 等待一小段时间让 DOM 变化完成
    await new Promise((resolve) => setTimeout(resolve, 100))

    observer.disconnect()

    return domChanged
  }

  /**
   * 执行 Action
   */
  async execute(actionId: string, params: ActionParams = {}): Promise<ActionResult> {
    const startTime = Date.now()
    const initialUrl = location.href

    // 验证 Action
    const validation = MadokaActionParser.validateActionId(actionId)
    if (!validation.valid) {
      return {
        success: false,
        actionId,
        error: validation.reason || '元素验证失败',
        domChanged: false,
        urlChanged: false,
        duration: Date.now() - startTime,
      }
    }

    const el = this.getElement(actionId)
    if (!el) {
      return {
        success: false,
        actionId,
        error: '找不到元素',
        domChanged: false,
        urlChanged: false,
        duration: Date.now() - startTime,
      }
    }

    // 高亮为执行中状态
    this.highlight(actionId, 'executing')

    try {
      // 根据元素类型执行不同操作
      const tag = el.tagName.toLowerCase()
      let domChanged = false

      if (tag === 'input') {
        const type = (el as HTMLInputElement).type

        if (type === 'checkbox' || type === 'radio') {
          domChanged = await this.detectDomChanges(() => this.executeToggle(el))
        } else if (type === 'submit') {
          domChanged = await this.detectDomChanges(() => this.executeClick(el))
        } else if (params.value !== undefined) {
          domChanged = await this.detectDomChanges(() => this.executeInput(el, params.value!))
        } else {
          domChanged = await this.detectDomChanges(() => this.executeClick(el))
        }
      } else if (tag === 'select') {
        if (params.selectedValue !== undefined) {
          domChanged = await this.detectDomChanges(() => this.executeSelect(el, params.selectedValue!))
        }
      } else if (tag === 'textarea') {
        if (params.value !== undefined) {
          domChanged = await this.detectDomChanges(() => this.executeInput(el, params.value!))
        }
      } else {
        // 默认执行点击
        domChanged = await this.detectDomChanges(() => this.executeClick(el))
      }

      // 等待可能的导航
      await new Promise((resolve) => setTimeout(resolve, 200))

      const urlChanged = location.href !== initialUrl

      // 更新高亮状态
      this.highlight(actionId, 'success')

      // 延迟后取消高亮
      setTimeout(() => {
        this.unhighlight(actionId)
      }, 1500)

      return {
        success: true,
        actionId,
        domChanged,
        urlChanged,
        newUrl: urlChanged ? location.href : undefined,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      // 更新高亮状态
      this.highlight(actionId, 'failed')

      // 延迟后取消高亮
      setTimeout(() => {
        this.unhighlight(actionId)
      }, 2000)

      return {
        success: false,
        actionId,
        error: (error as Error).message,
        domChanged: false,
        urlChanged: false,
        duration: Date.now() - startTime,
      }
    }
  }

  /**
   * 批量执行 Actions（顺序执行）
   */
  async executeBatch(
    actions: { actionId: string; params?: ActionParams }[],
    onProgress?: (index: number, result: ActionResult) => void
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = []

    for (let i = 0; i < actions.length; i++) {
      const { actionId, params } = actions[i]
      const result = await this.execute(actionId, params)
      results.push(result)

      if (onProgress) {
        onProgress(i, result)
      }

      // 如果失败，停止执行
      if (!result.success) {
        console.warn(`[Madoka Executor] Action ${actionId} 执行失败，停止批量执行`)
        break
      }

      // 如果 URL 变化，也停止执行（页面导航了）
      if (result.urlChanged) {
        console.log(`[Madoka Executor] URL 已变化，停止批量执行`)
        break
      }

      // 间隔执行
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    return results
  }
}

// 导出模块
let executorInstance: ActionExecutor | null = null

export const MadokaActionExecutor = {
  getInstance() {
    if (!executorInstance) {
      executorInstance = new ActionExecutor()
    }
    return executorInstance
  },

  highlight(actionId: string, status: ActionStatus = 'pending') {
    return this.getInstance().highlight(actionId, status)
  },

  unhighlight(actionId: string) {
    return this.getInstance().unhighlight(actionId)
  },

  clearAllHighlights() {
    return this.getInstance().clearAllHighlights()
  },

  async execute(actionId: string, params?: ActionParams) {
    return this.getInstance().execute(actionId, params)
  },

  async executeBatch(
    actions: { actionId: string; params?: ActionParams }[],
    onProgress?: (index: number, result: ActionResult) => void
  ) {
    return this.getInstance().executeBatch(actions, onProgress)
  },
}

// 挂载到 window
;(window as unknown as { MadokaActionExecutor: typeof MadokaActionExecutor }).MadokaActionExecutor =
  MadokaActionExecutor

console.log('[Madoka] ActionExecutor module loaded')
