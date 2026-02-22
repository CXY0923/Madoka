/**
 * Translation Popup - 划词翻译浮动弹窗
 * 选中文本后显示翻译结果，支持固定弹窗
 */

export interface TranslationPopupOptions {
  originalText: string
  translatedText?: string
  error?: string
  rect?: DOMRect
  isLoading?: boolean
}

export class TranslationPopup {
  private popup: HTMLElement | null = null
  private overlay: HTMLElement | null = null
  private isOpen = false
  private isPinned = false
  private isDragging = false
  private dragOffset = { x: 0, y: 0 }

  // 拖动事件处理函数（用于清理）
  private startDragHandler: ((e: Event) => void) | null = null
  private doDragHandler: ((e: Event) => void) | null = null
  private stopDragHandler: (() => void) | null = null

  // 标记刚刚结束拖动，用于防止触发翻译
  public justFinishedDragging = false

  /**
   * 显示翻译弹窗
   */
  show(options: TranslationPopupOptions): void {
    if (this.isOpen) {
      this.close()
    }

    this.isOpen = true
    this.isPinned = false

    // 创建遮罩层
    this.overlay = document.createElement('div')
    this.overlay.id = 'madoka-translation-overlay'
    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: '2147483646',
      opacity: '0',
      transition: 'opacity 0.3s ease',
    })

    // 创建弹窗
    this.popup = document.createElement('div')
    this.popup.id = 'madoka-translation-popup'
    this.applyPopupPosition(options.rect)

    Object.assign(this.popup.style, {
      width: '400px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 25px 80px rgba(0, 0, 0, 0.35), 0 10px 30px rgba(0, 0, 0, 0.2)',
      zIndex: '2147483647',
      opacity: '0',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    })

    const originalPreview = this.escapeHtml(
      options.originalText.length > 60 ? options.originalText.substring(0, 60) + '...' : options.originalText
    )

    this.popup.innerHTML = `
      <div id="madoka-translation-header" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
        color: white;
        cursor: move;
        user-select: none;
        position: relative;
        overflow: hidden;
      ">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%); pointer-events: none;"></div>
        <div style="display: flex; align-items: center; gap: 10px; position: relative; z-index: 1;">
          <div style="
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            backdrop-filter: blur(10px);
          ">🌐</div>
          <div>
            <div style="font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">Madoka 翻译</div>
            <div style="font-size: 11px; opacity: 0.85; margin-top: 2px; font-weight: 400;">${originalPreview}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; position: relative; z-index: 1;">
          <button id="madoka-translation-pin" title="固定弹窗" style="
            background: rgba(255, 255, 255, 0.15);
            border: none;
            color: white;
            font-size: 14px;
            cursor: pointer;
            padding: 6px 10px;
            border-radius: 8px;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
          ">📌</button>
          <button id="madoka-translation-close" style="
            background: rgba(255, 255, 255, 0.15);
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            line-height: 1;
          ">×</button>
        </div>
      </div>
      
      <div id="madoka-translation-content" style="
        padding: 16px;
        font-size: 14px;
        line-height: 1.6;
        color: #374151;
        max-height: 60vh;
        overflow-y: auto;
      ">
        <div id="madoka-translation-loading" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          gap: 16px;
        ">
          <div style="
            position: relative;
            width: 48px;
            height: 48px;
          ">
            <div style="
              position: absolute;
              width: 100%;
              height: 100%;
              border: 3px solid #e5e7eb;
              border-radius: 50%;
            "></div>
            <div style="
              position: absolute;
              width: 100%;
              height: 100%;
              border: 3px solid transparent;
              border-top-color: #667eea;
              border-radius: 50%;
              animation: madoka-translation-spin 0.8s linear infinite;
            "></div>
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 20px;
            ">✨</div>
          </div>
          <div style="color: #6b7280; font-size: 14px; font-weight: 500;">正在翻译中...</div>
          <div style="color: #9ca3af; font-size: 12px;">请稍候片刻</div>
        </div>
        
        <div id="madoka-translation-result" style="display: none;">
          <!-- 原文区域 -->
          <div style="
            margin-bottom: 16px;
            padding: 14px;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 12px;
              background: #fff;
              padding: 2px 8px;
              font-size: 11px;
              color: #64748b;
              font-weight: 600;
              border-radius: 4px;
              border: 1px solid #e2e8f0;
            ">原文</div>
            <div style="
              font-size: 13px;
              color: #475569;
              line-height: 1.7;
              margin-top: 4px;
              font-style: italic;
            ">
              <span style="color: #94a3b8; font-size: 16px; margin-right: 4px;">"</span>
              <span id="madoka-translation-original"></span>
              <span style="color: #94a3b8; font-size: 16px; margin-left: 4px;">"</span>
            </div>
          </div>

          <!-- 译文区域 -->
          <div style="
            padding: 16px;
            background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
            border-radius: 12px;
            border: 1px solid #c4b5fd;
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 12px;
              background: #fff;
              padding: 2px 8px;
              font-size: 11px;
              color: #7c3aed;
              font-weight: 600;
              border-radius: 4px;
              border: 1px solid #c4b5fd;
            ">译文</div>
            <div id="madoka-translation-text" style="
              font-size: 15px;
              color: #1e293b;
              line-height: 1.8;
              font-weight: 500;
              margin-top: 4px;
              margin-bottom: 12px;
            "></div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <button id="madoka-translation-ask-ai" style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 14px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 8px;
                font-size: 13px;
                color: #fff;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
              ">
                <span>🤖</span>
                <span id="madoka-translation-ask-ai-text">问 AI</span>
              </button>
              <button id="madoka-translation-copy" style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 14px;
                background: #fff;
                border: 1px solid #c4b5fd;
                border-radius: 8px;
                font-size: 13px;
                color: #7c3aed;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
              ">
                <span>📋</span>
                <span id="madoka-translation-copy-text">复制译文</span>
              </button>
            </div>
          </div>
        </div>
        
        <div id="madoka-translation-error" style="
          display: none;
          padding: 24px;
          text-align: center;
        ">
          <div style="
            width: 56px;
            height: 56px;
            margin: 0 auto 16px;
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
          ">😕</div>
          <div style="
            font-size: 15px;
            font-weight: 600;
            color: #dc2626;
            margin-bottom: 8px;
          ">翻译出错了</div>
          <div id="madoka-translation-error-text" style="
            font-size: 13px;
            color: #7f1d1d;
            margin-bottom: 16px;
            line-height: 1.6;
          "></div>
          <button id="madoka-translation-retry" style="
            padding: 10px 20px;
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            🔄 重试
          </button>
        </div>
      </div>
    `

    // 添加动画样式
    const style = document.createElement('style')
    style.textContent = `
      @keyframes madoka-translation-spin {
        to { transform: rotate(360deg); }
      }
      #madoka-translation-close:hover {
        background-color: rgba(255, 255, 255, 0.2) !important;
      }
      #madoka-translation-pin:hover {
        background-color: rgba(255, 255, 255, 0.2) !important;
      }
    `
    this.popup.appendChild(style)

    // 添加到页面
    document.body.appendChild(this.overlay)
    document.body.appendChild(this.popup)

    // 绑定关闭事件
    const closeBtn = this.popup.querySelector('#madoka-translation-close')
    closeBtn?.addEventListener('click', () => this.close())

    const pinBtn = this.popup.querySelector('#madoka-translation-pin')
    pinBtn?.addEventListener('click', () => this.togglePin())

    // 绑定复制事件
    const copyBtn = this.popup.querySelector('#madoka-translation-copy')
    copyBtn?.addEventListener('click', () => this.copyTranslation())

    // 绑定问 AI 事件
    const askAiBtn = this.popup.querySelector('#madoka-translation-ask-ai')
    askAiBtn?.addEventListener('click', () => this.askAI())

    // 绑定重试事件
    const retryBtn = this.popup.querySelector('#madoka-translation-retry')
    retryBtn?.addEventListener('click', () => this.retryTranslation())

    this.overlay.addEventListener('click', () => {
      if (!this.isPinned) {
        this.close()
      }
    })

    // 绑定拖动事件
    this.bindDragEvents()

    // 绑定 ESC 键关闭
    document.addEventListener('keydown', this.handleKeyDown)

    // 触发动画
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1'
      }
      if (this.popup) {
        this.popup.style.opacity = '1'
      }
    })

    // 更新内容
    this.updateContent(options)
  }

  /**
   * 根据选区位置设置弹窗位置
   */
  private applyPopupPosition(rect?: DOMRect): void {
    if (!this.popup) return

    const popupWidth = 360
    const popupHeight = 200
    const padding = 12

    if (rect) {
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth

      // 优先显示在选区下方
      let top: number
      let left = rect.left + (rect.width - popupWidth) / 2

      if (rect.bottom + popupHeight + padding <= viewportHeight) {
        top = rect.bottom + padding
      } else if (rect.top - popupHeight - padding >= 0) {
        top = rect.top - popupHeight - padding
      } else {
        top = Math.max(padding, Math.min(rect.top, viewportHeight - popupHeight - padding))
      }

      left = Math.max(padding, Math.min(left, viewportWidth - popupWidth - padding))

      Object.assign(this.popup.style, {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
      })
    } else {
      // 居中显示
      Object.assign(this.popup.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      })
    }
  }

  /**
   * 更新弹窗内容
   */
  updateContent(options: TranslationPopupOptions): void {
    if (!this.popup) return

    const loadingEl = this.popup.querySelector('#madoka-translation-loading')
    const resultEl = this.popup.querySelector('#madoka-translation-result')
    const errorEl = this.popup.querySelector('#madoka-translation-error')

    if (options.isLoading) {
      loadingEl?.setAttribute('style', 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; gap: 12px;')
      resultEl?.setAttribute('style', 'display: none;')
      errorEl?.setAttribute('style', 'display: none;')
    } else if (options.error) {
      loadingEl?.setAttribute('style', 'display: none;')
      resultEl?.setAttribute('style', 'display: none;')
      errorEl?.setAttribute('style', 'display: block; padding: 16px; text-align: center; color: #dc2626;')
      const errorTextEl = this.popup.querySelector('#madoka-translation-error-text')
      if (errorTextEl) errorTextEl.textContent = options.error
    } else if (options.translatedText !== undefined) {
      loadingEl?.setAttribute('style', 'display: none;')
      errorEl?.setAttribute('style', 'display: none;')
      resultEl?.setAttribute('style', 'display: block;')
      const originalEl = this.popup.querySelector('#madoka-translation-original')
      const textEl = this.popup.querySelector('#madoka-translation-text')
      if (originalEl) originalEl.textContent = options.originalText
      if (textEl) textEl.textContent = options.translatedText || '（无翻译结果）'
    }
  }

  /**
   * 切换固定状态
   */
  private togglePin(): void {
    this.isPinned = !this.isPinned
    const pinBtn = this.popup?.querySelector('#madoka-translation-pin')
    if (pinBtn) {
      pinBtn.textContent = this.isPinned ? '📍' : '📌'
      pinBtn.setAttribute('title', this.isPinned ? '取消固定' : '固定弹窗')
    }
  }

  /**
   * 复制译文
   */
  private copyTranslation(): void {
    const textEl = this.popup?.querySelector('#madoka-translation-text')
    const copyTextEl = this.popup?.querySelector('#madoka-translation-copy-text')
    if (!textEl || !copyTextEl) return

    const text = textEl.textContent || ''
    navigator.clipboard.writeText(text).then(() => {
      copyTextEl.textContent = '已复制!'
      setTimeout(() => {
        copyTextEl.textContent = '复制译文'
      }, 2000)
    }).catch(() => {
      copyTextEl.textContent = '复制失败'
      setTimeout(() => {
        copyTextEl.textContent = '复制译文'
      }, 2000)
    })
  }

  /**
   * 问 AI - 将原文发送到侧边栏
   */
  private askAI(): void {
    const originalEl = this.popup?.querySelector('#madoka-translation-original')
    const askAiTextEl = this.popup?.querySelector('#madoka-translation-ask-ai-text')
    if (!originalEl || !askAiTextEl) return

    const originalText = originalEl.textContent || ''
    if (!originalText.trim()) return

    // 显示发送中状态
    askAiTextEl.textContent = '发送中...'

    // 发送消息到 background
    try {
      chrome.runtime.sendMessage(
        { action: 'askAI', text: originalText },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Madoka] Ask AI failed:', chrome.runtime.lastError)
            askAiTextEl.textContent = '发送失败'
            setTimeout(() => {
              askAiTextEl.textContent = '问 AI'
            }, 2000)
            return
          }

          if (response?.success) {
            askAiTextEl.textContent = '已发送!'
            setTimeout(() => {
              askAiTextEl.textContent = '问 AI'
            }, 2000)
          } else {
            askAiTextEl.textContent = '发送失败'
            setTimeout(() => {
              askAiTextEl.textContent = '问 AI'
            }, 2000)
          }
        }
      )
    } catch (e) {
      console.error('[Madoka] Ask AI error:', e)
      askAiTextEl.textContent = '发送失败'
      setTimeout(() => {
        askAiTextEl.textContent = '问 AI'
      }, 2000)
    }
  }

  /**
   * 重试翻译
   */
  private retryTranslation(): void {
    // 触发一个自定义事件，让 content/index.ts 处理重试
    const event = new CustomEvent('madoka-translation-retry', {
      bubbles: true,
      cancelable: true,
    })
    this.popup?.dispatchEvent(event)
  }

  /**
   * 关闭弹窗
   */
  close(): void {
    if (!this.isOpen) return

    this.isOpen = false
    const overlayToRemove = this.overlay
    const popupToRemove = this.popup
    this.overlay = null
    this.popup = null

    // 清理事件监听器
    document.removeEventListener('keydown', this.handleKeyDown)
    this.cleanupDragEvents()

    if (overlayToRemove) {
      overlayToRemove.style.opacity = '0'
      overlayToRemove.style.pointerEvents = 'none'
    }
    if (popupToRemove) {
      popupToRemove.style.opacity = '0'
    }

    setTimeout(() => {
      overlayToRemove?.remove()
      popupToRemove?.remove()
    }, 300)
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close()
    }
  }

  /**
   * 绑定拖动事件
   */
  private bindDragEvents(): void {
    if (!this.popup) return

    const header = this.popup.querySelector('#madoka-translation-header')
    if (!header) return

    // 先清理旧的事件监听器
    this.cleanupDragEvents()

    this.startDragHandler = (e: Event) => {
      if (!this.popup) return

      this.isDragging = true
      const mouseEvent = e as MouseEvent
      const touchEvent = e as TouchEvent
      const clientX = touchEvent.touches ? touchEvent.touches[0].clientX : mouseEvent.clientX
      const clientY = touchEvent.touches ? touchEvent.touches[0].clientY : mouseEvent.clientY

      // 获取当前弹窗位置
      const rect = this.popup.getBoundingClientRect()
      this.dragOffset.x = clientX - rect.left
      this.dragOffset.y = clientY - rect.top

      // 防止文本选中
      e.preventDefault()
    }

    this.doDragHandler = (e: Event) => {
      if (!this.isDragging || !this.popup) return

      const mouseEvent = e as MouseEvent
      const touchEvent = e as TouchEvent
      const clientX = touchEvent.touches ? touchEvent.touches[0].clientX : mouseEvent.clientX
      const clientY = touchEvent.touches ? touchEvent.touches[0].clientY : mouseEvent.clientY

      // 计算新位置
      let newLeft = clientX - this.dragOffset.x
      let newTop = clientY - this.dragOffset.y

      // 限制在视口内
      const popupRect = this.popup.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      newLeft = Math.max(0, Math.min(newLeft, viewportWidth - popupRect.width))
      newTop = Math.max(0, Math.min(newTop, viewportHeight - popupRect.height))

      this.popup.style.left = `${newLeft}px`
      this.popup.style.top = `${newTop}px`
      this.popup.style.transform = 'none'

      e.preventDefault()
    }

    this.stopDragHandler = () => {
      this.isDragging = false
      // 标记刚刚结束拖动，防止触发翻译
      this.justFinishedDragging = true
      setTimeout(() => {
        this.justFinishedDragging = false
      }, 100)
    }

    // 鼠标事件
    header.addEventListener('mousedown', this.startDragHandler)
    document.addEventListener('mousemove', this.doDragHandler)
    document.addEventListener('mouseup', this.stopDragHandler)

    // 触摸事件（移动端支持）
    header.addEventListener('touchstart', this.startDragHandler, { passive: false })
    document.addEventListener('touchmove', this.doDragHandler, { passive: false })
    document.addEventListener('touchend', this.stopDragHandler)
  }

  /**
   * 清理拖动事件监听器
   */
  private cleanupDragEvents(): void {
    if (!this.startDragHandler || !this.doDragHandler || !this.stopDragHandler) return

    const header = this.popup?.querySelector('#madoka-translation-header')
    if (header) {
      header.removeEventListener('mousedown', this.startDragHandler)
      header.removeEventListener('touchstart', this.startDragHandler)
    }

    document.removeEventListener('mousemove', this.doDragHandler)
    document.removeEventListener('mouseup', this.stopDragHandler)
    document.removeEventListener('touchmove', this.doDragHandler)
    document.removeEventListener('touchend', this.stopDragHandler)

    this.startDragHandler = null
    this.doDragHandler = null
    this.stopDragHandler = null
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

let translationPopup: TranslationPopup | null = null

export function getTranslationPopup(): TranslationPopup {
  if (!translationPopup) {
    translationPopup = new TranslationPopup()
  }
  return translationPopup
}
