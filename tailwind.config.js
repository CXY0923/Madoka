/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{ts,tsx,html}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS variables
        'theme': {
          'bg': 'var(--bg-primary)',
          'bg-secondary': 'var(--bg-secondary)',
          'bg-tertiary': 'var(--bg-tertiary)',
          'bg-hover': 'var(--bg-hover)',
          'bg-active': 'var(--bg-active)',
          'bg-sidebar': 'var(--bg-sidebar)',
          'text': 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          'border': 'var(--border-primary)',
          'border-secondary': 'var(--border-secondary)',
          'accent': 'var(--accent-primary)',
          'accent-secondary': 'var(--accent-secondary)',
          'success': 'var(--accent-success)',
          'warning': 'var(--accent-warning)',
          'danger': 'var(--accent-danger)',
        },
        // Legacy colors for backward compatibility
        'madoka': {
          'bg': '#fafafa',
          'bg-secondary': '#ffffff',
          'bg-tertiary': '#f5f5f5',
          'text': '#000000',
          'text-secondary': '#666666',
          'muted': '#999999',
          'border': '#e5e5e5',
          'border-light': '#f0f0f0',
        },
        // Cursor-like colors
        'cursor': {
          // Dark theme base
          'dark': {
            'bg': '#1e1e1e',
            'bg-secondary': '#252526',
            'bg-tertiary': '#2d2d2d',
            'sidebar': '#181818',
            'hover': '#3c3c3c',
            'active': '#4a4a4a',
            'text': '#cccccc',
            'text-secondary': '#9ca3af',
            'text-muted': '#6b7280',
            'border': '#3c3c3c',
          },
          // Light theme base
          'light': {
            'bg': '#ffffff',
            'bg-secondary': '#f8f9fa',
            'bg-tertiary': '#f0f1f3',
            'sidebar': '#f3f4f6',
            'hover': '#e8e9eb',
            'active': '#dcdee0',
            'text': '#1a1a1a',
            'text-secondary': '#4b5563',
            'text-muted': '#9ca3af',
            'border': '#e5e7eb',
          },
          // Accent colors
          'accent': '#3b82f6',
          'accent-hover': '#2563eb',
        }
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-in-left': 'slideInLeft 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      boxShadow: {
        'theme-sm': 'var(--shadow-sm)',
        'theme': 'var(--shadow-md)',
        'theme-lg': 'var(--shadow-lg)',
        'madoka-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'madoka': '0 4px 16px rgba(0, 0, 0, 0.08)',
        'madoka-lg': '0 8px 28px rgba(0, 0, 0, 0.12)',
      },
      transitionDuration: {
        '250': '250ms',
      },
      spacing: {
        'sidebar': '260px',
      },
      fontSize: {
        'xxs': '10px',
      },
    },
  },
  plugins: [],
}
