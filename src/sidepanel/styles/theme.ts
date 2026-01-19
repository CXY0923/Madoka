/**
 * Theme System
 * Cursor-style theme management with dark/light mode support
 */

export type Theme = 'light' | 'dark'

// Theme colors - referenced from CSS variables
export const THEME_COLORS = {
  light: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f8f9fa',
    bgTertiary: '#f0f1f3',
    bgHover: '#e8e9eb',
    bgActive: '#dcdee0',
    bgSidebar: '#f3f4f6',
    textPrimary: '#1a1a1a',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    borderPrimary: '#e5e7eb',
    borderSecondary: '#d1d5db',
    accentPrimary: '#3b82f6',
  },
  dark: {
    bgPrimary: '#1e1e1e',
    bgSecondary: '#252526',
    bgTertiary: '#2d2d2d',
    bgHover: '#3c3c3c',
    bgActive: '#4a4a4a',
    bgSidebar: '#181818',
    textPrimary: '#cccccc',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    borderPrimary: '#3c3c3c',
    borderSecondary: '#4a4a4a',
    accentPrimary: '#3b82f6',
  },
} as const

/**
 * Get the current theme from the document
 */
export function getCurrentTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) || 'light'
}

/**
 * Set the theme on the document
 */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  // Persist to storage
  chrome.storage.local.set({ theme })
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme(): Theme {
  const current = getCurrentTheme()
  const next = current === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}

/**
 * Initialize theme from storage
 */
export async function initializeTheme(): Promise<Theme> {
  try {
    const result = await chrome.storage.local.get('theme')
    const theme = (result.theme as Theme) || 'light'
    setTheme(theme)
    return theme
  } catch {
    setTheme('light')
    return 'light'
  }
}

/**
 * React hook for theme management is in useTheme.ts
 */
