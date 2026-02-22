/**
 * Link Summary Popup - 链接总结浮动弹窗
 * 右键点击链接时显示页面总结
 */

export interface LinkSummaryPopupOptions {
  linkUrl: string
  linkText: string
}

// 分段总结结果点 - 与 sidepaneltest 保持一致
export interface SummaryPoint {
  summary: string
  verbatimQuote: string
  selectors?: string[]
  contextBefore?: string
  contextAfter?: string
}

export interface SummaryResult {
  summary: string
  points: SummaryPoint[]
}

export class LinkSummaryPopup {
  private popup: HTMLElement | null = null
  private overlay: HTMLElement | null = null
  private isOpen = false
  private currentUrl: string = ''
  private summaryPoints: SummaryPoint[] = []

  /**
   * 显示总结弹窗
   */
  async show(options: LinkSummaryPopupOptions): Promise<void> {
    if (this.isOpen) {
      this.close()
    }

    this.isOpen = true
    this.currentUrl = options.linkUrl
    this.summaryPoints = []

    // 创建遮罩层
    this.overlay = document.createElement('div')
    this.overlay.id = 'madoka-link-summary-overlay'
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
    this.popup.id = 'madoka-link-summary-popup'
    Object.assign(this.popup.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) scale(0.9)',
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      zIndex: '2147483647',
      opacity: '0',
      transition: 'all 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    })

    // 创建弹窗内容 - 按照 sidepaneltest 的方式
    this.popup.innerHTML = `
      <div id="madoka-link-summary-header" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      ">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">📝</span>
          <div>
            <div style="font-size: 16px; font-weight: 600;">Madoka 链接总结</div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">${this.escapeHtml(options.linkText.substring(0, 50))}${options.linkText.length > 50 ? '...' : ''}</div>
          </div>
        </div>
        <button id="madoka-link-summary-close" style="
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background-color 0.2s;
        ">×</button>
      </div>
      
      <div id="madoka-link-summary-content" style="
        padding: 20px;
        overflow-y: auto;
        flex: 1;
        fontSize: 14px;
        lineHeight: 1.6;
        color: #374151;
      ">
        <div id="madoka-link-summary-loading" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          gap: 16px;
        ">
          <div style="
            width: 40px;
            height: 40px;
            border: 3px solid #e5e7eb;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: madoka-spin 1s linear infinite;
          "></div>
          <div style="color: #6b7280; font-size: 14px;">正在获取页面内容...</div>
        </div>
        
        <div id="madoka-link-summary-result" style="display: none;">
          <div id="madoka-link-summary-metadata" style="
            margin-bottom: 16px;
            padding: 12px;
            background-color: #f9fafb;
            border-radius: 8px;
            font-size: 12px;
            color: #6b7280;
          "></div>
          
          <!-- 总体总结 -->
          <div id="madoka-link-summary-overview" style="
            margin-bottom: 20px;
            padding: 16px;
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            border-radius: 8px;
            border-left: 4px solid #667eea;
          "></div>
          
          <!-- 要点列表 -->
          <div id="madoka-link-summary-points" style="
            display: flex;
            flex-direction: column;
            gap: 12px;
          "></div>
        </div>
        
        <div id="madoka-link-summary-error" style="
          display: none;
          padding: 20px;
          text-align: center;
          color: #dc2626;
        ">
          <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
          <div id="madoka-link-summary-error-text"></div>
        </div>
      </div>
      
      <div id="madoka-link-summary-footer" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        border-top: 1px solid #e5e7eb;
        background-color: #f9fafb;
        font-size: 12px;
        color: #6b7280;
      ">
        <div id="madoka-link-summary-status">正在加载...</div>
        <div style="display: flex; gap: 8px;">
          <a id="madoka-link-summary-open" href="${options.linkUrl}" target="_blank" style="
            color: #667eea;
            text-decoration: none;
            padding: 6px 12px;
            border-radius: 6px;
            transition: background-color 0.2s;
          ">打开链接 →</a>
        </div>
      </div>
    `

    // 添加动画样式
    const style = document.createElement('style')
    style.textContent = `
      @keyframes madoka-spin {
        to { transform: rotate(360deg); }
      }
      #madoka-link-summary-close:hover {
        background-color: rgba(255, 255, 255, 0.2) !important;
      }
      #madoka-link-summary-open:hover {
        background-color: #e0e7ff !important;
      }
    `
    this.popup.appendChild(style)

    // 添加到页面
    document.body.appendChild(this.overlay)
    document.body.appendChild(this.popup)

    // 绑定关闭事件
    const closeBtn = this.popup.querySelector('#madoka-link-summary-close')
    closeBtn?.addEventListener('click', () => this.close())

    this.overlay.addEventListener('click', () => this.close())

    // 绑定 ESC 键关闭
    document.addEventListener('keydown', this.handleKeyDown)

    // 触发动画
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1'
      }
      if (this.popup) {
        this.popup.style.opacity = '1'
        this.popup.style.transform = 'translate(-50%, -50%) scale(1)'
      }
    })

    // 开始获取内容
    this.fetchAndSummarize(options.linkUrl)
  }

  /**
   * 关闭弹窗
   */
  close(): void {
    if (!this.isOpen) return

    this.isOpen = false

    // 移除 ESC 键监听
    document.removeEventListener('keydown', this.handleKeyDown)

    // 关闭动画
    if (this.overlay) {
      this.overlay.style.opacity = '0'
    }
    if (this.popup) {
      this.popup.style.opacity = '0'
      this.popup.style.transform = 'translate(-50%, -50%) scale(0.9)'
    }

    // 延迟移除元素
    setTimeout(() => {
      this.overlay?.remove()
      this.popup?.remove()
      this.overlay = null
      this.popup = null
    }, 300)
  }

  /**
   * 处理键盘事件
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close()
    }
  }

  /**
   * 获取并总结链接内容
   */
  private async fetchAndSummarize(url: string): Promise<void> {
    try {
      // 1. 获取页面内容
      this.updateStatus('正在读取页面内容...')
      const pageContent = await this.fetchPageContent(url)

      if (!pageContent.content || pageContent.content.length < 100) {
        throw new Error('无法获取页面内容或内容过少')
      }

      // 2. 更新元数据
      this.updateMetadata(pageContent)

      // 3. 请求总结（带引用）
      this.updateStatus('正在生成总结...')
      const result = await this.requestSummaryWithPoints(pageContent)
      
      console.log('[LinkSummaryPopup] Got result:', result)
      
      // 保存总结要点
      this.summaryPoints = result.points || []
      
      console.log('[LinkSummaryPopup] Saved points:', this.summaryPoints)

      // 4. 显示结果
      this.showResult(result.summary, this.summaryPoints)
      this.updateStatus('总结完成')
    } catch (error) {
      this.showError(error instanceof Error ? error.message : '未知错误')
      this.updateStatus('加载失败')
    }
  }

  /**
   * 获取页面内容
   */
  private async fetchPageContent(url: string): Promise<{
    title: string
    url: string
    content: string
    length: number
  }> {
    // 通过 background 脚本获取页面内容
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'fetchLinkContent',
          url: url,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (response?.success) {
            resolve(response.data)
          } else {
            reject(new Error(response?.error || '获取页面内容失败'))
          }
        }
      )
    })
  }

  /**
   * 请求总结（带引用要点）
   */
  private async requestSummaryWithPoints(pageContent: {
    title: string
    url: string
    content: string
    length: number
  }): Promise<SummaryResult> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'summarizeContentWithPoints',
          title: pageContent.title,
          url: pageContent.url,
          content: pageContent.content,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (response?.success) {
            resolve(response.result)
          } else {
            reject(new Error(response?.error || '生成总结失败'))
          }
        }
      )
    })
  }

  /**
   * 更新状态
   */
  private updateStatus(status: string): void {
    const statusEl = this.popup?.querySelector('#madoka-link-summary-status')
    if (statusEl) {
      statusEl.textContent = status
    }
  }

  /**
   * 更新元数据
   */
  private updateMetadata(pageContent: {
    title: string
    url: string
    content: string
    length: number
  }): void {
    const metadataEl = this.popup?.querySelector('#madoka-link-summary-metadata')
    if (metadataEl) {
      metadataEl.innerHTML = `
        <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">${this.escapeHtml(pageContent.title)}</div>
        <div style="color: #6b7280; word-break: break-all;">${this.escapeHtml(pageContent.url)}</div>
        <div style="margin-top: 8px; display: flex; gap: 12px;">
          <span>📄 ${pageContent.length.toLocaleString()} 字符</span>
          <span>🔗 ${this.escapeHtml(new URL(pageContent.url).hostname)}</span>
        </div>
      `
    }
  }

  /**
   * 显示结果 - 按照 sidepaneltest 的方式显示要点列表
   */
  private showResult(summary: string, points: SummaryPoint[] = []): void {
    console.log('[LinkSummaryPopup] Showing result:', { summary, pointsCount: points.length, points })
    
    const loadingEl = this.popup?.querySelector('#madoka-link-summary-loading') as HTMLElement | null
    const resultEl = this.popup?.querySelector('#madoka-link-summary-result') as HTMLElement | null
    const overviewEl = this.popup?.querySelector('#madoka-link-summary-overview') as HTMLElement | null
    const pointsEl = this.popup?.querySelector('#madoka-link-summary-points') as HTMLElement | null

    if (loadingEl) {
      loadingEl.style.display = 'none'
    }
    if (resultEl) {
      resultEl.style.display = 'block'
    }

    // 显示总体总结
    if (overviewEl) {
      overviewEl.innerHTML = `<strong>📋 总体总结</strong><br>${this.escapeHtml(summary)}`
    }

    // 显示要点列表
    if (pointsEl) {
      const pointsHtml = this.renderPointsList(points)
      console.log('[LinkSummaryPopup] Rendered points HTML:', pointsHtml)
      pointsEl.innerHTML = pointsHtml
      this.bindViewSourceButtons()
    }
  }

  /**
   * 渲染要点列表 - 按照 sidepaneltest 的方式
   */
  private renderPointsList(points: SummaryPoint[]): string {
    if (points.length === 0) {
      return '<div style="color: #6b7280; text-align: center; padding: 20px;">暂无详细要点</div>'
    }

    return points.map((point, index) => `
      <div class="madoka-summary-point" style="
        position: relative;
        padding: 16px;
        background: #ffffff;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: box-shadow 0.2s;
      " onmouseover="this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.15)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)'">
        <div style="
          display: flex;
          align-items: flex-start;
          gap: 12px;
        ">
          <div style="
            flex-shrink: 0;
            width: 28px;
            height: 28px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 600;
          ">${index + 1}</div>
          <div style="flex: 1;">
            <div style="
              font-size: 14px;
              line-height: 1.6;
              color: #374151;
              margin-bottom: 8px;
            ">${this.escapeHtml(point.summary)}</div>
            <div style="
              font-size: 12px;
              color: #6b7280;
              font-style: italic;
              padding: 8px;
              background: #f9fafb;
              border-radius: 4px;
              border-left: 3px solid #d1d5db;
            ">"${this.escapeHtml(point.verbatimQuote)}"</div>
          </div>
        </div>
        <button class="madoka-view-source-btn" data-point-index="${index}" style="
          margin-top: 12px;
          padding: 6px 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: transform 0.2s, box-shadow 0.2s;
        " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
          <span>📍</span>
          <span>查看原文</span>
        </button>
      </div>
    `).join('')
  }

  /**
   * 绑定"查看原文"按钮事件
   */
  private bindViewSourceButtons(): void {
    const buttons = this.popup?.querySelectorAll('.madoka-view-source-btn')
    buttons?.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const index = parseInt((btn as HTMLElement).dataset.pointIndex || '0')
        this.viewSource(index)
      })
    })
  }

  /**
   * 查看原文 - 按照 sidepaneltest 的方式
   */
  private async viewSource(index: number): Promise<void> {
    const point = this.summaryPoints[index]
    if (!point) {
      console.warn('[LinkSummaryPopup] Point not found:', index)
      return
    }

    console.log('[LinkSummaryPopup] Viewing source for point:', index, point)

    // 关闭弹窗
    this.close()

    // 发送消息到 background 进行跳转和高亮
    try {
      await chrome.runtime.sendMessage({
        action: 'viewSource',
        url: this.currentUrl,
        point: point,
      })
    } catch (e) {
      console.error('[LinkSummaryPopup] Failed to view source:', e)
      alert('跳转失败，请重试')
    }
  }

  /**
   * 显示错误
   */
  private showError(error: string): void {
    const loadingEl = this.popup?.querySelector('#madoka-link-summary-loading') as HTMLElement | null
    const errorEl = this.popup?.querySelector('#madoka-link-summary-error') as HTMLElement | null
    const errorTextEl = this.popup?.querySelector('#madoka-link-summary-error-text') as HTMLElement | null

    if (loadingEl) {
      loadingEl.style.display = 'none'
    }
    if (errorEl) {
      errorEl.style.display = 'block'
    }
    if (errorTextEl) {
      // 提供更友好的错误信息
      const friendlyError = this.getFriendlyErrorMessage(error)
      errorTextEl.innerHTML = friendlyError
    }
  }

  /**
   * 获取友好的错误信息
   */
  private getFriendlyErrorMessage(error: string): string {
    // 连接错误
    if (error.includes('Could not establish connection') ||
        error.includes('Receiving end does not exist')) {
      return `
        <div style="font-weight: 600; margin-bottom: 8px;">连接失败</div>
        <div style="margin-bottom: 12px;">无法与页面建立连接，可能原因：</div>
        <ul style="text-align: left; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>页面尚未完全加载，请刷新后重试</li>
          <li>当前页面是 Chrome 内部页面（如设置页）</li>
          <li>扩展权限不足，请检查扩展设置</li>
        </ul>
        <div style="margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 6px; color: #92400e;">
          💡 建议：刷新页面后再次尝试
        </div>
      `
    }

    // 网络错误
    if (error.includes('Failed to fetch') ||
        error.includes('NetworkError') ||
        error.includes('network')) {
      return `
        <div style="font-weight: 600; margin-bottom: 8px;">网络错误</div>
        <div style="margin-bottom: 12px;">无法获取页面内容，请检查：</div>
        <ul style="text-align: left; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>网络连接是否正常</li>
          <li>目标网站是否可访问</li>
          <li>是否使用了代理或 VPN</li>
        </ul>
      `
    }

    // API 错误
    if (error.includes('API') || error.includes('api')) {
      return `
        <div style="font-weight: 600; margin-bottom: 8px;">API 调用失败</div>
        <div style="margin-bottom: 12px;">生成总结时出错，可能原因：</div>
        <ul style="text-align: left; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>API 密钥配置错误或已过期</li>
          <li>API 服务暂时不可用</li>
          <li>请求频率超限</li>
        </ul>
        <div style="margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 6px; color: #92400e;">
          💡 建议：检查扩展设置中的 API 配置
        </div>
      `
    }

    // 内容获取错误
    if (error.includes('content') || error.includes('页面内容')) {
      return `
        <div style="font-weight: 600; margin-bottom: 8px;">内容获取失败</div>
        <div style="margin-bottom: 12px;">无法读取目标页面内容，可能原因：</div>
        <ul style="text-align: left; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>页面需要登录才能访问</li>
          <li>页面有反爬虫保护</li>
          <li>页面内容为空或无法解析</li>
        </ul>
      `
    }

    // 默认错误
    return `
      <div style="font-weight: 600; margin-bottom: 8px;">发生错误</div>
      <div style="margin-bottom: 12px;">${this.escapeHtml(error)}</div>
      <div style="padding: 12px; background: #f3f4f6; border-radius: 6px; color: #4b5563;">
        💡 建议：刷新页面后重试，或检查扩展权限设置
      </div>
    `
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// 导出单例
let linkSummaryPopup: LinkSummaryPopup | null = null

export function getLinkSummaryPopup(): LinkSummaryPopup {
  if (!linkSummaryPopup) {
    linkSummaryPopup = new LinkSummaryPopup()
  }
  return linkSummaryPopup
}
