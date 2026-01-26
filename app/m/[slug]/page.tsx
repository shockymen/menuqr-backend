import { notFound } from 'next/navigation'
import ModernMinimal from '@/app/m/[slug]/templates/modern-minimal'
import ClassicElegant from '@/app/m/[slug]/templates/classic-elegant'

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  is_featured: boolean
  image_url: string | null
  category_id: string
}

interface Category {
  id: string
  name: string
  description: string
}

interface Menu {
  id: string
  business_id: string
  name: string
  slug: string
  description: string
  is_active: boolean
}

interface Business {
  id: string
  name: string
  display_name: string
  description: string
  logo_url: string | null
  city: string
  country: string
  phone: string
  address: string
}

interface Template {
  template_name: string
  primary_color: string
  secondary_color: string
  accent_color: string
}

interface MenuData {
  business: Business
  template?: Template | null
  menus: Menu[]
  categories: Category[]
  items: MenuItem[]
}

async function getMenuData(slug: string): Promise<MenuData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://menuqr-backend.vercel.app'
    const response = await fetch(`${apiUrl}/api/v1/public/menu/${slug}`, {
      next: { revalidate: 3600 }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Error fetching menu:', error)
    return null
  }
}

export default async function MenuPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params
  const menuData = await getMenuData(slug)

  if (!menuData) {
    notFound()
  }

  const { business, template, categories, items } = menuData

  // Default template settings if none exist
  const templateSettings: Template = template || {
    template_name: 'modern-minimal',
    primary_color: '#ffc107',
    secondary_color: '#212529',
    accent_color: '#28a745'
  }

  // Conditional rendering based on template name
  if (templateSettings.template_name === 'classic-elegant') {
    return (
      <ClassicElegant
        business={business}
        categories={categories}
        items={items}
        primaryColor={templateSettings.primary_color}
      />
    )
  }

  // Default to modern-minimal
  return (
    <ModernMinimal
      business={business}
      categories={categories}
      items={items}
      primaryColor={templateSettings.primary_color}
    />
  )
}

// Metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://menuqr-backend.vercel.app'
  
  try {
    const response = await fetch(`${apiUrl}/api/v1/public/menu/${slug}`)
    if (response.ok) {
      const data = await response.json()
      const business = data.data.business
      
      return {
        title: `${business.display_name || business.name} - Menu`,
        description: business.description || `View the menu for ${business.name}`,
      }
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
  }

  return {
    title: 'Menu - MenuQR Africa',
    description: 'View our menu'
  }
}