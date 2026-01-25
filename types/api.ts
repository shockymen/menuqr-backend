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

// Business types
export interface Business {
  id: string
  user_id: string
  name: string
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
}

// Menu types
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

// Category types
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

// Menu Item types
export interface MenuItem {
  id: string
  menu_id: string
  category_id: string | null
  name: string
  description: string | null
  ingredients: string | null          // Display text
  ingredient_list: string[]           // NEW: Queryable array
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

// Translation types
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

// QR Code types
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

// Analytics types
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

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

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

// For single menu join
export interface MenuItemWithSingleMenu extends MenuItem {
  menus: {
    business_id: string
  }
}

// For array menu join (from !inner)
export interface MenuItemWithMenuArray extends MenuItem {
  menus: Array<{
    business_id: string
  }>
}

// For business verification queries
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