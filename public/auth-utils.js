// ============================================
// MenuQR Africa - Authentication Utilities (Supabase Auth)
// ============================================
// Include this file after config.js and Supabase JS library

// ============================================
// AUTHENTICATION STATE
// ============================================

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
async function isAuthenticated() {
  try {
    const { data: { session } } = await window.supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

/**
 * Get complete user data (auth + profile)
 * @returns {Promise<Object|null>} Combined user data or null
 */
async function getCurrentUser() {
  try {
    // Get auth session
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    
    if (sessionError || !session) {
      return null;
    }
    
    const userId = session.user.id;
    
    // Get profile data from profiles table
    const { data: profile, error: profileError } = await window.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
      // Return auth user even if profile fetch fails
      return {
        id: session.user.id,
        email: session.user.email,
        email_verified: false,
        firstlogin: false,
        profile: null
      };
    }
    
    // Combine auth user + profile
    return {
      id: session.user.id,
      email: session.user.email,
      ...profile
    };
    
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}

// ============================================
// TWO-GATE SYSTEM CHECKS
// ============================================

/**
 * Check if email is verified (Gate 1)
 * @returns {Promise<boolean>}
 */
async function isEmailVerified() {
  try {
    const user = await getCurrentUser();
    return user?.email_verified === true;
  } catch (error) {
    console.error('Error checking email verification:', error);
    return false;
  }
}

/**
 * Check if onboarding is complete (Gate 2)
 * @returns {Promise<boolean>}
 */
async function isOnboardingComplete() {
  try {
    const user = await getCurrentUser();
    return user?.firstlogin === true;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
}

// ============================================
// AUTHENTICATION ACTIONS
// ============================================

/**
 * Sign up new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} metadata - Additional user metadata (name, business info, etc.)
 * @returns {Promise<Object>} Signup result
 */
async function signup(email, password, metadata = {}) {
  try {
    // Step 1: Create auth user with Supabase
    const { data, error } = await window.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // Store in auth.users metadata
        emailRedirectTo: `${window.location.origin}/verify-success.html`
      }
    });
    
    if (error) throw error;
    
    // Step 2: Update profile with metadata (the trigger creates it, we update it)
    if (data.user) {
      const { error: profileError } = await window.supabase
        .from('profiles')
        .update({
          email: email, // Add email to profile
          full_name: metadata.full_name,
          phone: metadata.phone,
          country: metadata.country,
          // Store business info temporarily in profile for onboarding
          // These will be used when creating the business during onboarding
          business_name: metadata.business_name,
          business_type: metadata.business_type
        })
        .eq('id', data.user.id);
      
      if (profileError) {
        console.error('Profile update error:', profileError);
        // Don't fail signup if profile update fails
      }
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sign in user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Login result with user data
 */
async function signin(email, password) {
  try {
    const { data, error } = await window.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    // Get full user data including profile
    const user = await getCurrentUser();
    
    return { success: true, data, user };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sign in with OAuth provider (Google)
 * @param {string} provider - OAuth provider ('google' or 'facebook')
 * @returns {Promise<Object>} OAuth signin result
 */
async function signInWithOAuth(provider = 'google') {
  console.log('=== signInWithOAuth called ===');
  console.log('Provider:', provider);
  console.log('window.location.origin:', window.location.origin);
  console.log('Supabase client exists:', !!window.supabase);
  
  try {
    const redirectTo = `${window.location.origin}/login.html`;
    console.log('Redirect URL:', redirectTo);
    
    console.log('Calling Supabase signInWithOAuth...');
    const { data, error } = await window.supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: redirectTo
      }
    });
    
    console.log('Supabase response:', { data, error });
    
    if (error) {
      console.error('OAuth error from Supabase:', error);
      throw error;
    }
    
    console.log('OAuth initiated successfully');
    return { success: true, data };
  } catch (error) {
    console.error('OAuth sign in error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
async function signout() {
  try {
    await window.supabase.auth.signOut();
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Sign out error:', error);
    // Force redirect even if signout fails
    window.location.href = 'login.html';
  }
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<Object>} Result
 */
async function resetPassword(email) {
  try {
    const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`
    });
    
    if (error) throw error;
    
    return { success: true, message: 'Password reset email sent' };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Result
 */
async function updatePassword(newPassword) {
  try {
    const { error } = await window.supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    
    return { success: true, message: 'Password updated successfully' };
  } catch (error) {
    console.error('Password update error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * Update user profile in profiles table
 * @param {string} userId - User ID
 * @param {Object} updates - Profile fields to update
 * @returns {Promise<Object>} Result
 */
async function updateProfile(userId, updates) {
  try {
    const { data, error } = await window.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Profile update error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark email as verified (custom verification flow)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result
 */
async function markEmailVerified(userId) {
  try {
    const { data, error } = await window.supabase
      .from('profiles')
      .update({
        email_verified: true,
        email_verified_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Mark email verified error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark onboarding as complete
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result
 */
async function markOnboardingComplete(userId) {
  try {
    const { data, error } = await window.supabase
      .from('profiles')
      .update({
        firstlogin: true,
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Mark onboarding complete error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// NAVIGATION & ACCESS CONTROL
// ============================================

/**
 * Redirect user based on their authentication state
 * Enforces the two-gate system: email_verified + firstlogin
 * Call this on protected pages
 * @returns {Promise<boolean>} True if user can access page, false if redirected
 */
async function enforceAuthGates() {
  try {
    // Gate 0: Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      window.location.href = 'login.html';
      return false;
    }
    
    // Gate 1: Check email verification
    const emailVerified = await isEmailVerified();
    if (!emailVerified) {
      window.location.href = 'verify-email.html';
      return false;
    }
    
    // Gate 2: Check onboarding completion
    const onboardingComplete = await isOnboardingComplete();
    if (!onboardingComplete) {
      window.location.href = 'onboarding.html';
      return false;
    }
    
    // All gates passed
    return true;
  } catch (error) {
    console.error('Error enforcing auth gates:', error);
    window.location.href = 'login.html';
    return false;
  }
}

/**
 * Redirect to login if already authenticated (for signup/login pages)
 * @returns {Promise<void>}
 */
async function redirectIfAuthenticated() {
  // CRITICAL: Do not redirect if we're processing an OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const hasOAuthParams = urlParams.has('code') || hashParams.has('access_token') || window.location.hash.includes('access_token');
  
  if (hasOAuthParams) {
    console.log('🛑 redirectIfAuthenticated: OAuth callback detected, skipping redirect');
    return; // Let the OAuth callback handler deal with routing
  }
  
  const authenticated = await isAuthenticated();
  if (authenticated) {
    // Check gates to determine where to redirect
    const emailVerified = await isEmailVerified();
    if (!emailVerified) {
      console.log('redirectIfAuthenticated: Email not verified, redirecting to verify-email.html');
      window.location.href = 'verify-email.html';
      return;
    }
    
    const onboardingComplete = await isOnboardingComplete();
    if (!onboardingComplete) {
      console.log('redirectIfAuthenticated: Onboarding incomplete, redirecting to onboarding.html');
      window.location.href = 'onboarding.html';
      return;
    }
    
    // User is fully set up, go to dashboard
    console.log('redirectIfAuthenticated: All checks passed, redirecting to dashboard.html');
    window.location.href = 'dashboard.html';
  }
}

/**
 * Simple redirect to login page
 * @returns {void}
 */
function redirectToLogin() {
  window.location.href = 'login.html';
}

/**
 * Simple redirect to dashboard
 * @returns {void}
 */
function redirectToDashboard() {
  window.location.href = 'dashboard.html';
}

// ============================================
// AUTH STATE CHANGE LISTENER
// ============================================

/**
 * Listen for authentication state changes
 * Useful for real-time session updates
 * @param {Function} callback - Function to call on auth state change
 * @returns {Object} Subscription object with unsubscribe method
 */
function onAuthStateChange(callback) {
  return window.supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session);
    if (callback) callback(event, session);
  });
}

// ============================================
// EXPORTS
// ============================================

// Make all functions globally available
window.MenuQRAuth = {
  // State checks
  isAuthenticated,
  getCurrentUser,
  isEmailVerified,
  isOnboardingComplete,
  
  // Auth actions
  signup,
  signin,
  signInWithOAuth,
  signout,
  resetPassword,
  updatePassword,
  
  // Profile management
  updateProfile,
  markEmailVerified,
  markOnboardingComplete,
  
  // Navigation
  enforceAuthGates,
  redirectIfAuthenticated,
  redirectToLogin,
  redirectToDashboard,
  
  // Event listeners
  onAuthStateChange
};

console.log('✅ MenuQR Auth utilities loaded (Supabase)');