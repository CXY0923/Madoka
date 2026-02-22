/**
 * Action Space 类型定义
 * Browser Agent 的核心类型系统
 */

// ============ 基础类型 ============

/**
 * Action 类型枚举
 */
export type ActionType =
  | 'click'      // 点击
  | 'input'      // 输入
  | 'select'     // 下拉选择
  | 'toggle'     // 切换（checkbox/switch）
  | 'navigate'   // 导航（链接）
  | 'submit'     // 提交
  | 'generic'    // 通用操作

/**
 * 危险等级
 */
export type DangerLevel = 'safe' | 'warning' | 'danger'

/**
 * Action 执行状态
 */
export type ActionStatus = 'pending' | 'executing' | 'success' | 'failed' | 'skipped'

// ============ Action 定义 ============

/**
 * 行上下文（表格/列表中的操作）
 */
export interface RowContext {
  /** 行的唯一标识 */
  rowKey: string | null
  /** 行的可读标签 */
  rowLabel: string | null
  /** 行的完整文本（截断） */
  fullText: string | null
}

/**
 * 单个 Action 的完整定义
 */
export interface Action {
  /** 唯一标识符，格式: act_v{version}_{index} */
  actionId: string
  
  /** Action 类型 */
  type: ActionType
  
  /** 人类可读标签 */
  label: string
  
  /** 详细描述（可选） */
  description?: string
  
  /** 标签名 */
  tagName: string
  
  /** CSS 选择器（回退方案） */
  selector: string
  
  /** 是否可见 */
  isVisible: boolean
  
  /** 是否可用（非 disabled） */
  isEnabled: boolean
  
  /** 危险等级 */
  dangerLevel: DangerLevel
  
  /** 评分 */
  score: number
  
  /** 评分信号 */
  signals: string[]
  
  /** 位置信息 */
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
  
  /** 行上下文（如果存在） */
  context?: RowContext
  
  /** 输入相关：placeholder */
  placeholder?: string
  
  /** 输入相关：当前值 */
  currentValue?: string
  
  /** 选择相关：可选项 */
  options?: { value: string; label: string }[]
}

// ============ Action Space ============

/**
 * 上下文绑定的 Action 组
 */
export interface ContextualActionGroup {
  /** 上下文信息 */
  context: {
    type: 'table_row' | 'list_item' | 'card'
    key: string | null
    label: string | null
  }
  
  /** 该上下文下的所有操作 */
  actions: Action[]
}

/**
 * 完整的 Action Space
 */
export interface ActionSpace {
  /** 元信息 */
  meta: {
    url: string
    title: string
    extractedAt: number
    version: number
    totalActions: number
  }
  
  /** 全局操作（不绑定上下文） */
  globalActions: Action[]
  
  /** 上下文绑定操作（表格/列表） */
  contextualActions: ContextualActionGroup[]
}

// ============ 执行相关 ============

/**
 * Action 执行参数
 */
export interface ActionParams {
  /** 输入值（用于 input 类型） */
  value?: string
  
  /** 选择值（用于 select 类型） */
  selectedValue?: string
  
  /** 是否强制执行（跳过确认） */
  force?: boolean
}

/**
 * Action 执行结果
 */
export interface ActionResult {
  /** 是否成功 */
  success: boolean
  
  /** 执行的 actionId */
  actionId: string
  
  /** 错误信息（失败时） */
  error?: string
  
  /** DOM 是否发生变化 */
  domChanged: boolean
  
  /** URL 是否发生变化 */
  urlChanged: boolean
  
  /** 新 URL（如果变化） */
  newUrl?: string
  
  /** 执行耗时（ms） */
  duration: number
}

// ============ 消息类型 ============

/**
 * Content Script 接收的 Action 消息
 */
export type ActionMessage =
  | { action: 'extractActionSpace' }
  | { action: 'executeAction'; actionId: string; params?: ActionParams }
  | { action: 'highlightAction'; actionId: string; highlight: boolean }
  | { action: 'clearHighlights' }
  | { action: 'validateAction'; actionId: string }

/**
 * Action 提取响应
 */
export interface ExtractActionSpaceResponse {
  success: boolean
  actionSpace?: ActionSpace
  error?: string
}

/**
 * Action 执行响应
 */
export interface ExecuteActionResponse {
  success: boolean
  result?: ActionResult
  error?: string
}

/**
 * Action 验证响应
 */
export interface ValidateActionResponse {
  success: boolean
  valid: boolean
  reason?: string
}

// ============ UI 状态 ============

/**
 * Action Plan 项状态
 */
export interface ActionPlanItem {
  action: Action
  status: ActionStatus
  result?: ActionResult
}

/**
 * Agent 模式状态
 */
export interface AgentState {
  /** 是否处于 Agent 模式 */
  isAgentMode: boolean
  
  /** 当前 Action Space */
  actionSpace: ActionSpace | null
  
  /** 待执行的 Action 计划 */
  actionPlan: ActionPlanItem[]
  
  /** 当前正在执行的 Action 索引 */
  currentActionIndex: number
  
  /** 执行历史 */
  executionHistory: ActionResult[]
}

// ============ 常量 ============

/** 评分阈值 */
export const SCORE_THRESHOLD = 15

/** 高亮样式 */
export const HIGHLIGHT_STYLES = {
  pending: 'outline: 3px dashed #3b82f6; outline-offset: 2px;',
  executing: 'outline: 3px solid #f59e0b; outline-offset: 2px;',
  success: 'outline: 3px solid #10b981; outline-offset: 2px;',
  failed: 'outline: 3px solid #ef4444; outline-offset: 2px;',
} as const

/** 危险操作关键词 */
export const DANGER_KEYWORDS = {
  high: ['delete', 'remove', '删除', '移除', 'logout', '退出', 'clear', '清空'],
  medium: ['submit', 'confirm', '提交', '确认', 'pay', '支付', 'send', '发送'],
} as const
