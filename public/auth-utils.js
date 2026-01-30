// auth-utils.js - MenuQR Africa Authentication Utilities
// Include this file after config.js on any page that needs authentication

const MenuQRAuth = {
    
    // ============================================
    // TOKEN MANAGEMENT
    // ============================================
    
    /**
     * Store authentication tokens
     */
    setTokens(accessToken, refreshToken = null) {
        localStorage.setItem(window.MENUQR_CONFIG.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        if (refreshToken) {
            localStorage.setItem(window.MENUQR_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        }
    },
    
    /**
     * Get access token
     */
    getAccessToken() {
        return localStorage.getItem(window.MENUQR_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
    },
    
    /**
     * Get refresh token
     */
    getRefreshToken() {
        return localStorage.getItem(window.MENUQR_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    },
    
    /**
     * Clear all authentication data
     */
    clearAuth() {
        localStorage.removeItem(window.MENUQR_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(window.MENUQR_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(window.MENUQR_CONFIG.STORAGE_KEYS.USER);
    },
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.getAccessToken();
    },
    
    // ============================================
    // USER DATA MANAGEMENT
    // ============================================
    
    /**
     * Store user data
     */
    setUser(userData) {
        localStorage.setItem(window.MENUQR_CONFIG.STORAGE_KEYS.USER, JSON.stringify(userData));
    },
    
    /**
     * Get user data
     */
    getUser() {
        const userData = localStorage.getItem(window.MENUQR_CONFIG.STORAGE_KEYS.USER);
        return userData ? JSON.parse(userData) : null;
    },
    
    // ============================================
    // API CALLS
    // ============================================
    
    /**
     * Make authenticated API request
     */
    async apiCall(endpoint, options = {}) {
        const token = this.getAccessToken();
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };
        
        const response = await fetch(
            `${window.MENUQR_CONFIG.API_BASE_URL}${endpoint}`,
            { ...defaultOptions, ...options }
        );
        
        const data = await response.json();
        
        // Handle 401 Unauthorized - token expired
        if (response.status === 401) {
            // Try to refresh token
            const refreshed = await this.refreshToken();
            if (refreshed) {
                // Retry the original request with new token
                return this.apiCall(endpoint, options);
            } else {
                // Refresh failed, redirect to login
                this.redirectToLogin();
                throw new Error('Session expired. Please login again.');
            }
        }
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'API request failed');
        }
        
        return data;
    },
    
    /**
     * Signup new user
     */
    async signup(email, password) {
        return this.apiCall(window.MENUQR_CONFIG.ENDPOINTS.SIGNUP, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    /**
     * Login user
     */
    async signin(email, password) {
        return this.apiCall(window.MENUQR_CONFIG.ENDPOINTS.SIGNIN, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    /**
     * Logout user
     */
    async signout() {
        try {
            await this.apiCall(window.MENUQR_CONFIG.ENDPOINTS.SIGNOUT, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Signout API error:', error);
        } finally {
            this.clearAuth();
            this.redirectToLogin();
        }
    },
    
    /**
     * Refresh access token
     */
    async refreshToken() {
        const refreshToken = this.getRefreshToken();
        
        if (!refreshToken) {
            return false;
        }
        
        try {
            const data = await fetch(
                `${window.MENUQR_CONFIG.API_BASE_URL}${window.MENUQR_CONFIG.ENDPOINTS.REFRESH}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: refreshToken })
                }
            ).then(res => res.json());
            
            if (data.data?.access_token) {
                this.setTokens(data.data.access_token);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        }
    },
    
    /**
     * Get current user info
     */
    async getCurrentUser() {
        return this.apiCall(window.MENUQR_CONFIG.ENDPOINTS.ME);
    },
    
    // ============================================
    // NAVIGATION
    // ============================================
    
    /**
     * Redirect to login page
     */
    redirectToLogin() {
        window.location.href = window.MENUQR_CONFIG.ROUTES.LOGIN;
    },
    
    /**
     * Redirect to dashboard
     */
    redirectToDashboard() {
        window.location.href = window.MENUQR_CONFIG.ROUTES.DASHBOARD;
    },
    
    /**
     * Protect page - redirect if not authenticated
     */
    protectPage() {
        if (!this.isAuthenticated()) {
            this.redirectToLogin();
        }
    },
    
    /**
     * Redirect if already authenticated (for login/signup pages)
     */
    redirectIfAuthenticated() {
        if (this.isAuthenticated()) {
            this.redirectToDashboard();
        }
    }
};

// Make globally available
window.MenuQRAuth = MenuQRAuth;