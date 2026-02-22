/**
 * useTheme Hook
 * React hook for theme management
 */

import { useState, useEffect, useCallback } from 'react'
import type { Theme } from '../styles/theme'
import { setTheme, toggleTheme as toggleThemeFn, initializeTheme } from '../styles/theme'

interface UseThemeReturn {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  isDark: boolean
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>('light')

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme().then((initialTheme) => {
      setThemeState(initialTheme)
    })

    // Listen for storage changes (sync across tabs)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.theme) {
        setThemeState(changes.theme.newValue as Theme)
        document.documentElement.dataset.theme = changes.theme.newValue
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  const handleSetTheme = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
    setThemeState(newTheme)
  }, [])

  const handleToggleTheme = useCallback(() => {
    const newTheme = toggleThemeFn()
    setThemeState(newTheme)
  }, [])

  return {
    theme,
    setTheme: handleSetTheme,
    toggleTheme: handleToggleTheme,
    isDark: theme === 'dark',
  }
}
