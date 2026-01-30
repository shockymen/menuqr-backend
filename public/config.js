// ============================================
// MenuQR Africa - Configuration File
// ============================================

const CONFIG = {
    // API Configuration
    // Since frontend and backend are on same Vercel domain, use empty string
    API_BASE_URL: '', // Empty string = same origin (no CORS issues)
    
    // Alternative: Use window.location.origin for explicit same-origin
    // API_BASE_URL: typeof window !== 'undefined' ? window.location.origin : '',
    
    // API Endpoints
    ENDPOINTS: {
        // Authentication
        SIGNUP: '/api/v1/auth/signup',
        SIGNIN: '/api/v1/auth/signin',
        SIGNOUT: '/api/v1/auth/signout',
        REFRESH: '/api/v1/auth/refresh',
        ME: '/api/v1/auth/me',
        VERIFY_EMAIL: '/api/v1/auth/verify-email',
        RESEND_VERIFICATION: '/api/v1/auth/resend-verification',
        FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
        RESET_PASSWORD: '/api/v1/auth/reset-password',
        CHANGE_PASSWORD: '/api/v1/auth/change-password',
        
        // User
        USER_PREFERENCES: '/api/v1/user/preferences',
        
        // Menus
        MENUS: '/api/v1/menus',
        MENU_BY_ID: (id) => `/api/v1/menus/${id}`,
        MENU_ACTIVATE: (id) => `/api/v1/menus/${id}/activate`,
        MENU_DEACTIVATE: (id) => `/api/v1/menus/${id}/deactivate`,
        MENU_ITEMS: (id) => `/api/v1/menus/${id}/items`,
        MENU_QR_GENERATE: (id) => `/api/v1/menus/${id}/qr/generate`,
        
        // Public
        PUBLIC_MENU: (slug) => `/api/v1/public/menu/${slug}`,
        PUBLIC_BUSINESS: (id) => `/api/v1/public/businesses/${id}`,
        PUBLIC_BUSINESS_MENU: (businessSlug, menuSlug) => `/api/v1/public/${businessSlug}/${menuSlug}`,
        
        // QR Codes
        QR_ANALYTICS: (id) => `/api/v1/qr/${id}/analytics`,
        QR_DOWNLOAD: (id) => `/api/v1/qr/${id}/download`,
        
        // Analytics
        ANALYTICS_TRACK: '/api/v1/analytics/track',
        
        // Subscriptions
        SUBSCRIPTIONS: '/api/v1/subscriptions',
        SUBSCRIPTION_BY_ID: (id) => `/api/v1/subscriptions/${id}`,
        SUBSCRIPTION_UPGRADE: (id) => `/api/v1/subscriptions/${id}/upgrade`,
        SUBSCRIPTION_CANCEL: (id) => `/api/v1/subscriptions/${id}/cancel`,
        SUBSCRIPTION_RESUME: (id) => `/api/v1/subscriptions/${id}/resume`,
        SUBSCRIPTION_CHECKOUT: '/api/v1/subscriptions/checkout',
        SUBSCRIPTION_PLANS: '/api/v1/subscription-plans',
        
        // Webhooks
        WEBHOOK_PAYSTACK: '/api/v1/webhooks/paystack',
    },
    
    // Local Storage Keys
    STORAGE_KEYS: {
        ACCESS_TOKEN: 'menuqr_access_token',
        REFRESH_TOKEN: 'menuqr_refresh_token',
        USER: 'menuqr_user',
        THEME: 'menuqr_theme',
        LANGUAGE: 'menuqr_language',
    },
    
    // App Routes
    ROUTES: {
        HOME: '/',
        LANDING: '/index.html',
        SIGNUP: '/signup.html',
        LOGIN: '/login.html',
        DASHBOARD: '/dashboard.html',
        MENUS: '/menus.html',
        SETTINGS: '/settings.html',
        ANALYTICS: '/analytics.html',
        BILLING: '/billing.html',
    },
    
    // App Settings
    SETTINGS: {
        APP_NAME: 'MenuQR Africa',
        DEFAULT_LANGUAGE: 'en',
        SUPPORTED_LANGUAGES: ['en', 'fr', 'es', 'ar', 'pt', 'sw', 'zh'],
        TOKEN_REFRESH_BUFFER: 5 * 60 * 1000, // Refresh token 5 minutes before expiry
        MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
    
    // Feature Flags
    FEATURES: {
        SOCIAL_LOGIN: true,
        EMAIL_VERIFICATION: true,
        PASSWORD_RESET: true,
        DARK_MODE: true,
        MULTI_LANGUAGE: true,
        ANALYTICS: true,
        SUBSCRIPTIONS: true,
    },
};

// Make config globally available
if (typeof window !== 'undefined') {
    window.MENUQR_CONFIG = CONFIG;
}

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}