/**
 * Animation System
 * Cursor-like animation constants and variants
 */

// Timing constants (in milliseconds)
export const ANIMATION_TIMING = {
  // Layout transitions
  sidebarToggle: 250,
  modeSwitch: 200,
  viewTransition: 200,
  
  // Content animations
  messageEnter: 300,
  messageStagger: 50,
  conversationSwitch: 150,
  
  // Micro-interactions
  buttonHover: 150,
  buttonTap: 100,
  statusPulse: 2000,
  
  // Spring configs
  spring: {
    stiff: { stiffness: 500, damping: 45 },
    gentle: { stiffness: 120, damping: 20 },
    bounce: { type: 'spring' as const, stiffness: 300, damping: 20 },
    snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
  },
} as const

/**
 * Framer Motion animation variants
 */
export const variants = {
  // Sidebar animations
  sidebar: {
    initial: { width: 0, opacity: 0 },
    animate: { width: 260, opacity: 1 },
    exit: { width: 0, opacity: 0 },
  },

  // Header animations
  header: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },

  // Message entry
  message: {
    initial: { opacity: 0, y: 20, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.98 },
  },

  // Conversation item
  conversationItem: {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 },
  },

  // Settings panel slide
  settingsPanel: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },

  // Quick action bar
  shortcuts: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  },

  // Fade
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },

  // Scale
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },

  // Slide up
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },

  // Slide in from left
  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },

  // Action plan item
  actionPlanItem: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10, height: 0 },
  },

  // Mode switch indicator
  modeIndicator: {
    initial: false,
    animate: { opacity: 1 },
    transition: { type: 'spring', stiffness: 500, damping: 35 },
  },
} as const

/**
 * Stagger container for list animations
 */
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: ANIMATION_TIMING.messageStagger / 1000,
      delayChildren: 0.05,
    },
  },
} as const

/**
 * Pulse animation for status indicators
 */
export const pulseAnimation = {
  animate: {
    opacity: [0.5, 1, 0.5] as number[],
    transition: {
      duration: ANIMATION_TIMING.statusPulse / 1000,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/**
 * Logo breathing animation
 */
export const logoAnimation = {
  animate: {
    scale: [1, 1.05, 1] as number[],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/**
 * Typing cursor blink
 */
export const cursorBlink = {
  animate: {
    opacity: [1, 0, 1] as number[],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'steps(1)',
    },
  },
}

/**
 * Button hover scale
 */
export const buttonHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: ANIMATION_TIMING.buttonHover / 1000 },
}

/**
 * Icon button hover
 */
export const iconButtonHover = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
}

/**
 * Transition presets
 */
export const transitions = {
  fast: { duration: 0.15, ease: 'easeOut' },
  normal: { duration: 0.2, ease: 'easeOut' },
  slow: { duration: 0.3, ease: 'easeOut' },
  spring: { type: 'spring', stiffness: 400, damping: 30 },
  springGentle: { type: 'spring', stiffness: 120, damping: 20 },
} as const
