/**
 * usePromptTemplates Hook
 * 管理系统提示词模板的状态和持久化
 */

import { useState, useEffect, useCallback } from 'react'
import type { PromptTemplate } from '../../shared/prompt-templates'
import {
  PROMPT_TEMPLATES_STORAGE_KEY,
  BUILTIN_TEMPLATES,
  DEFAULT_EXPERT_TEMPLATE,
  createTemplate,
} from '../../shared/prompt-templates'

interface UsePromptTemplatesReturn {
  templates: PromptTemplate[]
  activeTemplate: PromptTemplate
  loading: boolean
  
  // CRUD operations
  addTemplate: (name: string, content: string) => Promise<PromptTemplate>
  updateTemplate: (id: string, updates: Partial<Pick<PromptTemplate, 'name' | 'content'>>) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  setDefaultTemplate: (id: string) => Promise<void>
  
  // Utility
  getTemplateById: (id: string) => PromptTemplate | undefined
  duplicateTemplate: (id: string) => Promise<PromptTemplate>
}

export function usePromptTemplates(): UsePromptTemplatesReturn {
  const [templates, setTemplates] = useState<PromptTemplate[]>(BUILTIN_TEMPLATES)
  const [loading, setLoading] = useState(true)

  // 从 storage 加载模板
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const result = await chrome.storage.local.get([PROMPT_TEMPLATES_STORAGE_KEY])
        const savedTemplates = result[PROMPT_TEMPLATES_STORAGE_KEY] as PromptTemplate[] | undefined

        if (savedTemplates && savedTemplates.length > 0) {
          // 合并内置模板和用户模板
          const builtInIds = BUILTIN_TEMPLATES.map(t => t.id)
          const userTemplates = savedTemplates.filter(t => !builtInIds.includes(t.id))
          
          // 保留用户对内置模板的 isDefault 设置
          const mergedBuiltIns = BUILTIN_TEMPLATES.map(builtIn => {
            const saved = savedTemplates.find(t => t.id === builtIn.id)
            return saved ? { ...builtIn, isDefault: saved.isDefault } : builtIn
          })
          
          // 确保至少有一个默认模板
          const allTemplates = [...mergedBuiltIns, ...userTemplates]
          const hasDefault = allTemplates.some(t => t.isDefault)
          
          if (!hasDefault) {
            allTemplates[0].isDefault = true
          }
          
          setTemplates(allTemplates)
        } else {
          // 首次使用，使用内置模板
          setTemplates(BUILTIN_TEMPLATES)
        }
      } catch (e) {
        console.error('[usePromptTemplates] Failed to load templates:', e)
        setTemplates(BUILTIN_TEMPLATES)
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [])

  // 保存模板到 storage
  const saveTemplates = useCallback(async (newTemplates: PromptTemplate[]) => {
    try {
      await chrome.storage.local.set({ [PROMPT_TEMPLATES_STORAGE_KEY]: newTemplates })
    } catch (e) {
      console.error('[usePromptTemplates] Failed to save templates:', e)
      throw e
    }
  }, [])

  // 获取当前激活的模板
  const activeTemplate = templates.find(t => t.isDefault) || templates[0] || DEFAULT_EXPERT_TEMPLATE

  // 添加新模板
  const addTemplate = useCallback(async (name: string, content: string): Promise<PromptTemplate> => {
    const newTemplate = createTemplate(name, content)
    const newTemplates = [...templates, newTemplate]
    setTemplates(newTemplates)
    await saveTemplates(newTemplates)
    return newTemplate
  }, [templates, saveTemplates])

  // 更新模板
  const updateTemplate = useCallback(async (
    id: string,
    updates: Partial<Pick<PromptTemplate, 'name' | 'content'>>
  ): Promise<void> => {
    const newTemplates = templates.map(t =>
      t.id === id
        ? { ...t, ...updates, updatedAt: Date.now() }
        : t
    )
    setTemplates(newTemplates)
    await saveTemplates(newTemplates)
  }, [templates, saveTemplates])

  // 删除模板
  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    const template = templates.find(t => t.id === id)
    
    // 不允许删除内置模板
    if (template?.isBuiltIn) {
      throw new Error('Cannot delete built-in template')
    }
    
    let newTemplates = templates.filter(t => t.id !== id)
    
    // 如果删除的是默认模板，将第一个设为默认
    if (template?.isDefault && newTemplates.length > 0) {
      newTemplates = newTemplates.map((t, i) => 
        i === 0 ? { ...t, isDefault: true } : t
      )
    }
    
    setTemplates(newTemplates)
    await saveTemplates(newTemplates)
  }, [templates, saveTemplates])

  // 设置默认模板
  const setDefaultTemplate = useCallback(async (id: string): Promise<void> => {
    const newTemplates = templates.map(t => ({
      ...t,
      isDefault: t.id === id,
    }))
    setTemplates(newTemplates)
    await saveTemplates(newTemplates)
  }, [templates, saveTemplates])

  // 根据 ID 获取模板
  const getTemplateById = useCallback((id: string): PromptTemplate | undefined => {
    return templates.find(t => t.id === id)
  }, [templates])

  // 复制模板
  const duplicateTemplate = useCallback(async (id: string): Promise<PromptTemplate> => {
    const original = templates.find(t => t.id === id)
    if (!original) {
      throw new Error('Template not found')
    }
    
    const newTemplate = createTemplate(
      `${original.name} (Copy)`,
      original.content
    )
    
    const newTemplates = [...templates, newTemplate]
    setTemplates(newTemplates)
    await saveTemplates(newTemplates)
    return newTemplate
  }, [templates, saveTemplates])

  return {
    templates,
    activeTemplate,
    loading,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    getTemplateById,
    duplicateTemplate,
  }
}
