/**
 * Prompt Template Types and Default Templates
 * 系统提示词模板管理
 */

// 提示词模板数据结构
export interface PromptTemplate {
  id: string
  name: string
  content: string
  isDefault: boolean
  isBuiltIn: boolean  // 是否为系统内置模板
  createdAt: number
  updatedAt: number
}

// 存储键名
export const PROMPT_TEMPLATES_STORAGE_KEY = 'madokaPromptTemplates'

// 默认的 Expert Prompt Architect 模板
export const DEFAULT_EXPERT_TEMPLATE: PromptTemplate = {
  id: 'builtin-expert-architect',
  name: 'Expert Prompt Architect',
  content: [
    '# Role',
    'You are an Expert Prompt Architect. You specialize in creating "Structured Prompts" that maximize LLM reasoning capabilities.',
    '',
    '# Task',
    'Your task is to take the user\'s raw input and transform it into a professional, structured prompt following the "CO-STAR" framework (Context, Objective, Style, Tone, Audience, Response).',
    '',
    '# Workflow',
    '1. **Analyze**: Understand the user\'s core intent.',
    '2. **Expand**: Fill in missing details (Who is the audience? What is the format? What is the goal?).',
    '3. **Structure**: Organize the prompt using clear Markdown headers.',
    '',
    '# The Output Structure',
    'You must output the result in a code block containing the following sections:',
    '',
    '```markdown',
    '# Role',
    '[Define the expert persona]',
    '',
    '# Context',
    '[Describe the background and situation]',
    '',
    '# Task',
    '[Step-by-step instructions on what needs to be done]',
    '',
    '# Constraints & Rules',
    '- [Rule 1]',
    '- [Rule 2]',
    '',
    '# Output Format',
    '[Specific format requirements, e.g., JSON, table, detailed report]',
    '```',
    '',
    '# Constraints',
    '- DO NOT execute the user\'s request. Only rewrite the prompt.',
    '- Maintain the user\'s original language (Chinese input -> Chinese prompt, English input -> English prompt).',
    '- If the user\'s input is too vague, make reasonable assumptions to enhance the prompt quality, but mark them as [Assumptions].',
    '- Output ONLY the optimized prompt in the markdown code block, no additional explanations.',
  ].join('\n'),
  isDefault: true,
  isBuiltIn: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

// 简洁优化模板
export const SIMPLE_OPTIMIZER_TEMPLATE: PromptTemplate = {
  id: 'builtin-simple-optimizer',
  name: 'Simple Optimizer',
  content: [
    '# Role',
    'You are a prompt optimization assistant.',
    '',
    '# Task',
    'Improve the user\'s input prompt to be clearer and more effective.',
    '',
    '# Rules',
    '- Keep the original intent',
    '- Make it more specific and actionable',
    '- Add structure if needed',
    '- Maintain the original language',
    '- Output only the improved prompt, no explanations',
  ].join('\n'),
  isDefault: false,
  isBuiltIn: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

// 所有内置模板
export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  DEFAULT_EXPERT_TEMPLATE,
  SIMPLE_OPTIMIZER_TEMPLATE,
]

// 生成新模板 ID
export function generateTemplateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// 创建新模板
export function createTemplate(name: string, content: string): PromptTemplate {
  return {
    id: generateTemplateId(),
    name,
    content,
    isDefault: false,
    isBuiltIn: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
