// app/api/v1/items/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkSubscriptionLimit } from '@/lib/subscription-enforcement' 
import type { 
  ApiResponse,
  MenuItem,
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkOperationResult,
  BulkOperationError,
  MenuWithBusiness, 
} from '@/types/api'

const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      }, { status: 401 })
    }

    const body = await request.json() as BulkCreateRequest

    if (!body.menu_id || !body.items || !Array.isArray(body.items)) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'menu_id and items array are required'
        }
      }, { status: 400 })
    }

    if (body.items.length === 0) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'items array cannot be empty'
        }
      }, { status: 400 })
    }

    if (body.items.length > 100) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot create more than 100 items at once'
        }
      }, { status: 400 })
    }

    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select(`
        id, 
        business_id, 
        businesses!inner(user_id)
      `)
      .eq('id', body.menu_id)
      .single()

    if (menuError || !menu) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'Menu not found'
        }
      }, { status: 404 })
    }

    const menuWithBusiness = menu as unknown as MenuWithBusiness
    
    if (menuWithBusiness.businesses.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to add items to this menu'
        }
      }, { status: 403 })
    }

    // Check subscription limits for bulk creation
    const limitCheck = await checkSubscriptionLimit(menu.business_id, 'items')
    if (!limitCheck.allowed) {
      return NextResponse.json<ApiResponse>({
        error: limitCheck.error
      }, { status: 403 })
    }

    const validatedItems: Partial<MenuItem>[] = []
    const errors: BulkOperationError[] = []

    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i]
      
      if (!item.name || item.price === undefined) {
        errors.push({
          index: i,
          message: 'name and price are required',
          item: item
        })
        continue
      }

      if (typeof item.price !== 'number' || item.price < 0) {
        errors.push({
          index: i,
          message: 'price must be a non-negative number',
          item: item
        })
        continue
      }

      validatedItems.push({
        menu_id: body.menu_id,
        name: item.name,
        description: item.description ?? null,
        price: item.price,
        category_id: item.category_id ?? null,
        subcategory: item.subcategory ?? null,
        image_url: item.image_url ?? null,
        gallery_images: item.gallery_images ?? null,
        video_url: item.video_url ?? null,
        is_available: item.is_available !== false,
        is_featured: item.is_featured ?? false,
        available_quantity: item.available_quantity ?? null,
        prep_time_minutes: item.prep_time_minutes ?? null,
        compare_at_price: item.compare_at_price ?? null,
        price_variants: item.price_variants ?? null,
        portion_size: item.portion_size ?? null,
        spice_level: item.spice_level ?? null,
        allergens: item.allergens ?? [],
        dietary_flags: item.dietary_flags ?? [],
        tags: item.tags ?? [],
        sort_order: item.sort_order ?? (i + 1),
        ingredients: item.ingredients ?? null,
        ingredient_list: item.ingredient_list ?? [],
        preparation_notes: item.preparation_notes ?? null,
        nutritional_info: item.nutritional_info ?? null,
        sku: item.sku ?? null,
        customization_options: item.customization_options ?? null,
        source: item.source ?? null
      })
    }

    if (validatedItems.length === 0) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No valid items to create',
          details: { errors }
        }
      }, { status: 400 })
    }

    const { data: createdItems, error: insertError } = await supabase
      .from('menu_items')
      .insert(validatedItems)
      .select()

    if (insertError) {
      console.error('Bulk insert error:', insertError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create menu items',
          details: insertError.message
        }
      }, { status: 500 })
    }

    const result: BulkOperationResult<MenuItem> = {
      created: createdItems?.length || 0,
      items: (createdItems as MenuItem[]) || [],
      errors: errors.length > 0 ? errors : undefined
    }

    return NextResponse.json<ApiResponse<BulkOperationResult<MenuItem>>>({
      data: result
    }, { status: 201 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Bulk create error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      }, { status: 401 })
    }

    const body = await request.json() as BulkUpdateRequest

    if (!body.items || !Array.isArray(body.items)) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'items array is required'
        }
      }, { status: 400 })
    }

    if (body.items.length === 0) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'items array cannot be empty'
        }
      }, { status: 400 })
    }

    if (body.items.length > 100) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot update more than 100 items at once'
        }
      }, { status: 400 })
    }

    const itemIds = body.items.map(item => item.id).filter(Boolean)
    if (itemIds.length !== body.items.length) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Each item must have an id'
        }
      }, { status: 400 })
    }

     const { data: existingItems, error: fetchError } = await supabase
      .from('menu_items')
      .select(`
        id,
        menu_id,
        menus!inner(
          business_id, 
          businesses!inner(user_id)
        )
      `)
      .in('id', itemIds)
      .is('deleted_at', null)

    if (fetchError) {
      console.error('Fetch items error:', fetchError)
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch menu items'
        }
      }, { status: 500 })
    }

    if (!existingItems || existingItems.length === 0) {
      return NextResponse.json<ApiResponse>({
        error: {
          code: 'NOT_FOUND',
          message: 'No menu items found'
        }
      }, { status: 404 })
    }

    // Verify all items belong to user
    for (const item of existingItems) {
      // Get the first element since Supabase returns arrays for joins
      const itemData = item as {
        id: string
        menu_id: string
        menus: Array<{ business_id: string; businesses: Array<{ user_id: string }> }>
      }
      
      const menu = itemData.menus[0]  // Get first menu from array
      const business = menu.businesses[0]  // Get first business from array
      
      if (business.user_id !== user.id) {
        return NextResponse.json<ApiResponse>({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to update one or more items'
          }
        }, { status: 403 })
      }
    }

    const updatedItems: MenuItem[] = []
    const errors: BulkOperationError[] = []

    for (const item of body.items) {
      const updates: Partial<MenuItem> = {}
      
      const allowedFields: Array<keyof typeof item> = [
        'name', 'description', 'price', 'category_id', 'subcategory',
        'image_url', 'gallery_images', 'video_url', 'is_available', 
        'is_featured', 'available_quantity', 'prep_time_minutes',
        'compare_at_price', 'price_variants', 'portion_size', 'spice_level', 
        'allergens', 'dietary_flags', 'tags', 'sort_order', 'ingredients',
        'ingredient_list', 'preparation_notes', 'nutritional_info', 'sku',
        'customization_options'
      ]

      for (const field of allowedFields) {
        if (item[field] !== undefined) {
          updates[field] = item[field] as never
        }
      }

      if (Object.keys(updates).length === 0) {
        errors.push({
          id: item.id,
          message: 'No fields to update'
        })
        continue
      }

      updates.updated_at = new Date().toISOString() as never

      const { data: updatedItem, error: updateError } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', item.id)
        .select()
        .single()

      if (updateError) {
        errors.push({
          id: item.id,
          message: updateError.message
        })
      } else if (updatedItem) {
        updatedItems.push(updatedItem as MenuItem)
      }
    }

    const result: BulkOperationResult<MenuItem> = {
      updated: updatedItems.length,
      items: updatedItems,
      errors: errors.length > 0 ? errors : undefined
    }

    return NextResponse.json<ApiResponse<BulkOperationResult<MenuItem>>>({
      data: result
    }, { status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Bulk update error:', errorMessage)
    
    return NextResponse.json<ApiResponse>({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: errorMessage
      }
    }, { status: 500 })
  }
}