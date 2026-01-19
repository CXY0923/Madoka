/**
 * SettingsPanel Component
 * Settings configuration panel
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useChatContext } from '../context/ChatContext'
import { useSettings } from '../hooks/useSettings'
import { variants } from '../styles/animations'
import { MODEL_OPTIONS, MAX_RESULTS_OPTIONS } from '../../shared/constants'
import { ThemeToggleSwitch } from './common/ThemeToggle'

export function SettingsPanel() {
  const { setView } = useChatContext()
  const { config, loading, saving, saveStatus, updateConfig, save } = useSettings()
  const [showPassword, setShowPassword] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--bg-primary)]">
        <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <motion.div
      className="h-full bg-[var(--bg-primary)] flex flex-col"
      variants={variants.settingsPanel}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <motion.button
          className="p-2 -ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          onClick={() => setView('chat')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </motion.button>
        <span className="font-semibold text-[var(--text-primary)]">Settings</span>
      </header>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 hide-scrollbar">
        {/* Appearance */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Appearance
          </h3>
          
          <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
            <div>
              <div className="text-sm text-[var(--text-primary)]">Dark Mode</div>
              <div className="text-xs text-[var(--text-muted)]">Switch between light and dark theme</div>
            </div>
            <ThemeToggleSwitch />
          </div>
        </section>

        {/* API Configuration */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            API Configuration
          </h3>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-primary)]">Tongyi API Key</label>
            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                className="flex-1 px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
                value={config.apiKey}
                onChange={(e) => updateConfig('apiKey', e.target.value)}
                placeholder="sk-xxxxxxxx"
              />
              <button
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Model selection */}
          <div className="space-y-2 mt-4">
            <label className="text-sm text-[var(--text-primary)]">Model</label>
            <select
              className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
              value={config.model}
              onChange={(e) => updateConfig('model', e.target.value)}
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Search Settings */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Search Settings
          </h3>

          {/* Default search engine */}
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-primary)]">Default Search Engine</label>
            <div className="flex gap-2">
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  config.searchEngine === 'bing'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]'
                }`}
                onClick={() => updateConfig('searchEngine', 'bing')}
              >
                Bing
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  config.searchEngine === 'google'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]'
                }`}
                onClick={() => updateConfig('searchEngine', 'google')}
              >
                Google
              </button>
            </div>
          </div>

          {/* Max results */}
          <div className="space-y-2 mt-4">
            <label className="text-sm text-[var(--text-primary)]">Max Search Results</label>
            <select
              className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
              value={config.maxResults}
              onChange={(e) => updateConfig('maxResults', parseInt(e.target.value))}
            >
              {MAX_RESULTS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>

      {/* Save button */}
      <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <motion.button
          className="w-full py-2.5 bg-[var(--accent-primary)] text-white text-sm font-semibold rounded-xl disabled:opacity-50"
          onClick={save}
          disabled={saving}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </motion.button>

        {/* Status message */}
        {saveStatus !== 'idle' && (
          <motion.div
            className={`mt-2 text-center text-xs ${
              saveStatus === 'success' ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {saveStatus === 'success' ? '✓ Settings saved' : '✕ Failed to save'}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
