// Response types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

// ============================================================================
// TEAM SYSTEM TYPES
// ============================================================================

export interface BusinessRole {
  id: string
  business_id: string
  role_key: string
  role_name: string
  role_description?: string
  permissions: string[]
  is_custom: boolean
  can_be_edited: boolean
  can_be_deleted: boolean
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  business_id: string
  user_id: string
  role_id: string
  status: 'pending' | 'active' | 'inactive'
  invited_by_user_id?: string
  invited_at: string
  invitation_accepted_at?: string
  removed_at?: string
  removed_by_user_id?: string
  removal_reason?: string
  last_active_at?: string
  created_at: string
  updated_at: string
  
  // Joined data (when fetching with relations)
  role?: BusinessRole
  user?: {
    id: string
    email: string
    user_metadata?: {
      full_name?: string
    }
  }
  invited_by?: {
    email: string
    user_metadata?: {
      full_name?: string
    }
  }
}

export interface TeamInvitation {
  id: string
  business_id: string
  invited_by_user_id: string
  invitation_type: 'email' | 'link'
  email?: string
  invite_token?: string
  max_uses: number
  current_uses: number
  role_id?: string
  role_key: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled' | 'rejected'
  expires_at: string
  accepted_at?: string
  accepted_by_user_id?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  
  // Joined data
  role?: BusinessRole
  business?: {
    name: string
    display_name?: string
  }
  invited_by?: {
    email: string
    user_metadata?: {
      full_name?: string
    }
  }
}

// ============================================================================
// BUSINESS TYPES (MERGED WITH TEAM INFO)
// ============================================================================

export interface Business {
  id: string
  user_id: string
  name: string
  location?: string
  display_name?: string
  slug: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  postal_code: string | null
  logo_url: string | null
  cover_image_url: string | null
  primary_color: string | null
  description: string | null
  website: string | null
  business_hours: Record<string, { open: string; close: string }> | null
  timezone: string
  currency: string
  tax_rate: number
  is_active: boolean
  features_enabled: string[]
  social_media: Record<string, string> | null
  default_language: string
  supported_languages: string[]
  auto_translate: boolean
  translation_provider: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  
  // Team info (when fetching with relations)
  my_role?: BusinessRole
  my_membership?: TeamMember
  team_count?: number
}

// ============================================================================
// MENU TYPES
// ============================================================================

export interface Menu {
  id: string
  business_id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  display_order: number
  availability_schedule: {
    start_time: string
    end_time: string
    days_of_week: number[]
  } | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ============================================================================
// CATEGORY TYPES
// ============================================================================

export interface Category {
  id: string
  business_id: string
  name: string
  slug: string
  description: string | null
  display_order: number
  icon: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ============================================================================
// MENU ITEM TYPES
// ============================================================================

export interface MenuItem {
  id: string
  menu_id: string
  category_id: string | null
  name: string
  description: string | null
  ingredients: string | null
  ingredient_list: string[]
  preparation_notes: string | null
  subcategory: string | null
  tags: string[]
  image_url: string | null
  gallery_images: string[] | null
  video_url: string | null
  allergens: string[]
  dietary_flags: string[]
  spice_level: number | null
  nutritional_info: Record<string, unknown> | null
  is_available: boolean
  is_featured: boolean
  available_quantity: number | null
  prep_time_minutes: number | null
  price: number
  compare_at_price: number | null
  price_variants: Record<string, unknown> | null
  sort_order: number
  sku: string | null
  customization_options: Record<string, unknown> | null
  portion_size: string | null
  source: string | null
  translation_priority: string | null
  translation_completeness: number | null
  last_translated_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ============================================================================
// TRANSLATION TYPES
// ============================================================================

export interface Translation {
  id: string
  translatable_type: string
  translatable_id: string
  language_code: string
  field_name: string
  content: string
  is_approved: boolean
  translation_method: 'manual' | 'api' | 'ai'
  quality_score: number | null
  translated_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// QR CODE TYPES
// ============================================================================

export interface QRCode {
  id: string
  menu_id: string
  name: string
  url: string
  image_url: string | null
  format: string
  size: number
  template: string | null
  location: string | null
  created_at: string
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface MenuView {
  id: string
  business_id: string
  menu_id: string
  viewed_at: string
  user_agent: string | null
  ip_address: string | null
  country: string | null
  device_type: string | null
}

export interface ItemView {
  id: string
  business_id: string
  item_id: string
  viewed_at: string
  user_agent: string | null
  ip_address: string | null
}

export interface QRScan {
  id: string
  qr_code_id: string
  scanned_at: string
  user_agent: string | null
  ip_address: string | null
  country: string | null
  device_type: string | null
}

export interface MenuViewCreate {
  business_id: string
  menu_id: string
  user_agent?: string
  ip_address?: string
  country?: string
  device_type?: string
}

export interface ItemViewCreate {
  business_id: string
  item_id: string
  user_agent?: string
  ip_address?: string
}

export interface PeakHoursData {
  hour: number
  count: number
}

export interface PeakHoursResponse {
  business_id: string
  date_range: {
    start: string
    end: string
  }
  peak_hours: PeakHoursData[]
  total_views: number
  busiest_hour: {
    hour: number
    count: number
  }
}

// ============================================================================
// JOINED TYPES (FOR SUPABASE QUERIES)
// ============================================================================

export interface MenuWithBusiness extends Menu {
  businesses: Business
}

export interface MenuItemWithMenu extends MenuItem {
  menus: MenuWithBusiness
}

export interface MenuItemWithMenuAndBusiness extends MenuItem {
  menus: {
    business_id: string
    businesses: {
      user_id: string
    }
  }
}

export interface MenuItemWithSingleMenu extends MenuItem {
  menus: {
    business_id: string
  }
}

export interface MenuItemWithMenuArray extends MenuItem {
  menus: Array<{
    business_id: string
  }>
}

export interface MenuItemOwnershipCheck {
  id: string
  menu_id: string
  menus: Array<{
    business_id: string
    businesses: Array<{
      user_id: string
    }>
  }>
}

export type SupabaseJoinResult<T> = {
  [K in keyof T]: T[K] extends object
    ? Array<T[K]>
    : T[K]
}

// Helper function to safely access first element from Supabase join arrays
export function getFirstJoin<T>(arr: T[] | undefined): T | null {
  return arr && arr.length > 0 ? arr[0] : null
}

// ============================================================================
// BULK OPERATION TYPES
// ============================================================================

export interface BulkCreateItemInput {
  name: string
  price: number
  description?: string
  category_id?: string
  subcategory?: string
  image_url?: string
  gallery_images?: string[]
  video_url?: string
  is_available?: boolean
  is_featured?: boolean
  available_quantity?: number
  prep_time_minutes?: number
  compare_at_price?: number
  price_variants?: Record<string, unknown>
  portion_size?: string
  spice_level?: number
  allergens?: string[]
  dietary_flags?: string[]
  tags?: string[]
  sort_order?: number
  ingredients?: string
  ingredient_list?: string[]
  preparation_notes?: string
  nutritional_info?: Record<string, unknown>
  sku?: string
  customization_options?: Record<string, unknown>
  source?: string
}

export interface BulkUpdateItemInput {
  id: string
  name?: string
  description?: string
  price?: number
  category_id?: string
  subcategory?: string
  image_url?: string
  gallery_images?: string[]
  video_url?: string
  is_available?: boolean
  is_featured?: boolean
  available_quantity?: number
  prep_time_minutes?: number
  compare_at_price?: number
  price_variants?: Record<string, unknown>
  portion_size?: string
  spice_level?: number
  allergens?: string[]
  dietary_flags?: string[]
  tags?: string[]
  sort_order?: number
  ingredients?: string
  ingredient_list?: string[]
  preparation_notes?: string
  nutritional_info?: Record<string, unknown>
  sku?: string
  customization_options?: Record<string, unknown>
}

export interface BulkOperationError {
  index?: number
  id?: string
  message: string
  item?: unknown
}

export interface BulkOperationResult<T> {
  created?: number
  updated?: number
  items: T[]
  errors?: BulkOperationError[]
}

// ============================================================================
// REQUEST/RESPONSE TYPES FOR SPECIFIC ENDPOINTS
// ============================================================================

export interface AvailabilityUpdateRequest {
  is_available: boolean
}

export interface AvailabilityUpdateResponse extends MenuItem {
  message: string
}

export interface ImageUpdateRequest {
  image_url: string
}

export interface ImageUpdateResponse extends MenuItem {
  message: string
}

export interface BulkCreateRequest {
  menu_id: string
  items: BulkCreateItemInput[]
}

export interface BulkUpdateRequest {
  items: BulkUpdateItemInput[]
}

export interface ItemReorderRequest {
  items: Array<{
    id: string
    sort_order: number
  }>
}