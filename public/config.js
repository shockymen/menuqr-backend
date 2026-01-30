// ============================================
// MenuQR Africa - Configuration File
// ============================================

// ============================================
// SUPABASE CONFIGURATION
// ============================================

// Supabase credentials
const SUPABASE_URL = 'https://gcahapillumpnwsvvwxc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjYWhhcGlsbHVtcG53c3Z2d3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyODY4NTksImV4cCI6MjA4NDg2Mjg1OX0.RjTyIq700gb57dQOe7lfY85r2OC8lAUa45K_GJEWJ-g';

// Initialize Supabase client
// Make sure Supabase JS library is loaded before this file
// Add to HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

// Wait for Supabase library to be available
if (typeof window !== 'undefined') {
    // Store the Supabase library reference
    const supabaseLib = window.supabase;
    
    if (supabaseLib && supabaseLib.createClient) {
        // Create the client instance
        const supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Assign to window for global access
        window.supabase = supabaseClient;
        
        console.log('✅ Supabase client initialized successfully');
    } else {
        console.error('❌ Supabase library not loaded. Make sure to include Supabase JS CDN before config.js');
        console.log('Expected: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    }
}

// ============================================
// APPLICATION CONFIGURATION
// ============================================

const CONFIG = {
    // Supabase Config (for reference)
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    
    // API Configuration (for custom endpoints if needed)
    API_BASE_URL: '', // Empty string = same origin (no CORS issues)
    
    // Custom API Endpoints (for non-Supabase features)
    ENDPOINTS: {
        // Menus (custom API)
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
    
    // Local Storage Keys (optional - Supabase manages its own session storage)
    STORAGE_KEYS: {
        THEME: 'menuqr_theme',
        LANGUAGE: 'menuqr_language',
        ONBOARDING_STATE: 'menuqr_onboarding_state',
    },
    
    // App Routes
    ROUTES: {
        HOME: '/',
        LANDING: '/index.html',
        SIGNUP: '/signup.html',
        LOGIN: '/login.html',
        VERIFY_EMAIL: '/verify-email.html',
        ONBOARDING: '/onboarding.html',
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
        MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
    
    // Feature Flags
    FEATURES: {
        GOOGLE_OAUTH: true,
        FACEBOOK_OAUTH: false, // Can enable later
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