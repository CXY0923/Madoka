/**
 * Overlay 高亮管理器
 * 使用 fixed 定位的独立 div 覆盖层实现高亮效果
 */

interface HighlightOverlay {
  id: string;
  element: HTMLElement;
  targetElement: Element;
  animationEnabled: boolean;
}

/**
 * Overlay 高亮管理器类
 */
export class OverlayManager {
  private overlays: Map<string, HighlightOverlay> = new Map();
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scrollHandler: (() => void) | null = null;
  private readonly maxAnimatedOverlays = 20;

  constructor() {
    this.initContainer();
    this.initResizeObserver();
    this.initScrollHandler();
  }

  /**
   * 初始化高亮容器
   */
  private initContainer(): void {
    // 检查是否已存在
    const existing = document.getElementById('summary-highlight-container');
    if (existing) {
      this.container = existing;
      return;
    }

    // 创建容器
    this.container = document.createElement('div');
    this.container.id = 'summary-highlight-container';
    
    // 设置容器样式
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2147483647',
      overflow: 'hidden',
    });

    // 注入样式
    this.injectStyles();

    // 添加到页面
    document.body.appendChild(this.container);
  }

  /**
   * 注入高亮样式
   */
  private injectStyles(): void {
    const styleId = 'summary-highlight-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .summary-highlight-overlay {
        position: fixed;
        border-radius: 4px;
        background: rgba(255, 215, 0, 0.3);
        border: 2px solid rgba(255, 165, 0, 0.8);
        box-shadow: 0 0 10px rgba(255, 165, 0, 0.5);
        transition: all 0.3s ease;
        pointer-events: none;
      }

      .summary-highlight-overlay.animated {
        animation: summary-highlight-pulse 2s ease-in-out infinite;
      }

      .summary-highlight-overlay.static {
        box-shadow: 0 0 15px rgba(255, 165, 0, 0.6), 0 0 30px rgba(255, 165, 0, 0.3);
      }

      @keyframes summary-highlight-pulse {
        0%, 100% {
          box-shadow: 0 0 10px rgba(255, 165, 0, 0.5);
          transform: scale(1);
        }
        50% {
          box-shadow: 0 0 20px rgba(255, 165, 0, 0.8), 0 0 40px rgba(255, 165, 0, 0.4);
          transform: scale(1.02);
        }
      }

      .summary-highlight-overlay.focused {
        background: rgba(255, 100, 0, 0.4);
        border-color: rgba(255, 69, 0, 0.9);
        z-index: 2147483648;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 初始化 ResizeObserver
   */
  private initResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      this.updateAllOverlays();
    });

    // 观察 body 和 html 的变化
    this.resizeObserver.observe(document.body);
    this.resizeObserver.observe(document.documentElement);
  }

  /**
   * 初始化滚动处理器
   */
  private initScrollHandler(): void {
    this.scrollHandler = () => {
      this.updateAllOverlays();
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.scrollHandler, { passive: true });
  }

  /**
   * 创建高亮覆盖层
   * @param targetElement 目标元素
   * @param highlightId 高亮 ID
   * @returns 是否创建成功
   */
  create(targetElement: Element, highlightId: string): boolean {
    if (!this.container) {
      console.error('[OverlayManager] Container not initialized');
      return false;
    }

    // 如果已存在，先移除
    if (this.overlays.has(highlightId)) {
      this.remove(highlightId);
    }

    // 创建覆盖层元素
    const overlay = document.createElement('div');
    overlay.className = 'summary-highlight-overlay';
    overlay.dataset.highlightId = highlightId;

    // 确定是否启用动画
    const animationEnabled = this.overlays.size < this.maxAnimatedOverlays;
    if (animationEnabled) {
      overlay.classList.add('animated');
    } else {
      overlay.classList.add('static');
    }

    // 设置位置和大小
    this.updateOverlayPosition(overlay, targetElement);

    // 添加到容器
    this.container.appendChild(overlay);

    // 保存引用
    this.overlays.set(highlightId, {
      id: highlightId,
      element: overlay,
      targetElement,
      animationEnabled,
    });

    // 如果超过最大动画数量，更新所有覆盖层
    if (this.overlays.size === this.maxAnimatedOverlays) {
      this.updateAnimationState();
    }

    return true;
  }

  /**
   * 更新高亮覆盖层位置
   * @param overlay 覆盖层元素
   * @param targetElement 目标元素
   */
  private updateOverlayPosition(overlay: HTMLElement, targetElement: Element): void {
    const rect = targetElement.getBoundingClientRect();
    
    // 检查元素是否在视口内
    const isInViewport = rect.top < window.innerHeight && 
                         rect.bottom > 0 && 
                         rect.left < window.innerWidth && 
                         rect.right > 0;

    if (!isInViewport) {
      overlay.style.display = 'none';
      return;
    }

    overlay.style.display = 'block';
    
    // 添加一些内边距使高亮更明显
    const padding = 4;
    
    Object.assign(overlay.style, {
      top: `${rect.top - padding}px`,
      left: `${rect.left - padding}px`,
      width: `${rect.width + padding * 2}px`,
      height: `${rect.height + padding * 2}px`,
    });
  }

  /**
   * 更新所有覆盖层位置
   */
  private updateAllOverlays(): void {
    this.overlays.forEach((overlay) => {
      this.updateOverlayPosition(overlay.element, overlay.targetElement);
    });
  }

  /**
   * 更新动画状态
   * 当高亮数量超过阈值时，禁用动画
   */
  private updateAnimationState(): void {
    const shouldAnimate = this.overlays.size <= this.maxAnimatedOverlays;
    
    this.overlays.forEach((overlay) => {
      if (shouldAnimate && !overlay.animationEnabled) {
        overlay.element.classList.remove('static');
        overlay.element.classList.add('animated');
        overlay.animationEnabled = true;
      } else if (!shouldAnimate && overlay.animationEnabled) {
        overlay.element.classList.remove('animated');
        overlay.element.classList.add('static');
        overlay.animationEnabled = false;
      }
    });
  }

  /**
   * 更新特定高亮的位置
   * @param highlightId 高亮 ID
   * @param newElement 新的目标元素
   * @returns 是否更新成功
   */
  update(highlightId: string, newElement: Element): boolean {
    const overlay = this.overlays.get(highlightId);
    if (!overlay) {
      console.warn(`[OverlayManager] Highlight ${highlightId} not found`);
      return false;
    }

    overlay.targetElement = newElement;
    this.updateOverlayPosition(overlay.element, newElement);
    return true;
  }

  /**
   * 移除特定高亮
   * @param highlightId 高亮 ID
   * @returns 是否移除成功
   */
  remove(highlightId: string): boolean {
    const overlay = this.overlays.get(highlightId);
    if (!overlay) {
      return false;
    }

    // 从 DOM 中移除
    overlay.element.remove();
    
    // 从 Map 中移除
    this.overlays.delete(highlightId);

    // 更新动画状态
    this.updateAnimationState();

    return true;
  }

  /**
   * 清除所有高亮
   */
  clear(): void {
    // 从 DOM 中移除所有覆盖层
    this.overlays.forEach((overlay) => {
      overlay.element.remove();
    });

    // 清空 Map
    this.overlays.clear();
  }

  /**
   * 设置高亮为焦点状态
   * @param highlightId 高亮 ID
   * @param focused 是否聚焦
   */
  setFocused(highlightId: string, focused: boolean = true): void {
    const overlay = this.overlays.get(highlightId);
    if (!overlay) return;

    if (focused) {
      overlay.element.classList.add('focused');
    } else {
      overlay.element.classList.remove('focused');
    }
  }

  /**
   * 获取当前高亮数量
   * @returns 高亮数量
   */
  getCount(): number {
    return this.overlays.size;
  }

  /**
   * 检查高亮是否存在
   * @param highlightId 高亮 ID
   * @returns 是否存在
   */
  has(highlightId: string): boolean {
    return this.overlays.has(highlightId);
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    // 清除所有高亮
    this.clear();

    // 移除事件监听
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      window.removeEventListener('resize', this.scrollHandler);
    }

    // 断开 ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // 移除容器
    if (this.container) {
      this.container.remove();
    }

    // 移除样式
    const style = document.getElementById('summary-highlight-styles');
    if (style) {
      style.remove();
    }
  }
}

/**
 * 创建全局 OverlayManager 实例
 */
let globalOverlayManager: OverlayManager | null = null;

/**
 * 获取全局 OverlayManager 实例
 * @returns OverlayManager 实例
 */
export function getOverlayManager(): OverlayManager {
  if (!globalOverlayManager) {
    globalOverlayManager = new OverlayManager();
  }
  return globalOverlayManager;
}

/**
 * 销毁全局 OverlayManager 实例
 */
export function destroyOverlayManager(): void {
  if (globalOverlayManager) {
    globalOverlayManager.destroy();
    globalOverlayManager = null;
  }
}

/**
 * 高亮元素（便捷函数）
 * @param element 目标元素
 * @param highlightId 高亮 ID
 */
export function highlightElement(element: Element, highlightId: string): void {
  const manager = getOverlayManager();
  manager.create(element, highlightId);
}

/**
 * 移除高亮（便捷函数）
 * @param highlightId 高亮 ID
 */
export function removeHighlight(highlightId: string): void {
  const manager = getOverlayManager();
  manager.remove(highlightId);
}

/**
 * 清除所有高亮（便捷函数）
 */
export function clearAllHighlights(): void {
  const manager = getOverlayManager();
  manager.clear();
}

/**
 * 滚动到元素并高亮
 * @param element 目标元素
 * @param highlightId 高亮 ID
 * @param behavior 滚动行为
 */
export function scrollToAndHighlight(
  element: Element,
  highlightId: string,
  behavior: ScrollBehavior = 'smooth'
): void {
  // 滚动到元素
  element.scrollIntoView({
    behavior,
    block: 'center',
    inline: 'nearest',
  });

  // 高亮元素
  highlightElement(element, highlightId);

  // 3秒后自动移除高亮
  setTimeout(() => {
    removeHighlight(highlightId);
  }, 3000);
}
