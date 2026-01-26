import { notFound } from 'next/navigation'
import Image from 'next/image'
import styles from './menu.module.css'

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

interface MenuData {
  business: Business
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

  const { business, categories, items } = menuData

  const itemsByCategory = categories.map(category => ({
    category,
    items: items.filter(item => item.category_id === category.id)
  })).filter(group => group.items.length > 0)

  const featuredItems = items.filter(item => item.is_featured)

  return (
    <div className={styles.menuPage}>
      <header className={styles.header}>
        {business.logo_url && (
          <div className={styles.logo}>
            <Image 
              src={business.logo_url} 
              alt={business.name}
              width={80}
              height={80}
              className={styles.logoImage}
            />
          </div>
        )}
        <h1 className={styles.businessName}>{business.display_name || business.name}</h1>
        {business.description && (
          <p className={styles.businessDescription}>{business.description}</p>
        )}
        <div className={styles.businessInfo}>
          <p>📍 {business.city}, {business.country}</p>
          {business.phone && (
            <p>📞 <a href={`tel:${business.phone}`}>{business.phone}</a></p>
          )}
          {business.address && <p>{business.address}</p>}
        </div>
      </header>

      {featuredItems.length > 0 && (
        <section className={styles.featuredSection}>
          <h2 className={styles.sectionTitle}>⭐ Featured</h2>
          <div className={styles.itemsGrid}>
            {featuredItems.map(item => (
              <div key={item.id} className={`${styles.menuItem} ${styles.featured}`}>
                {item.image_url && (
                  <div className={styles.itemImage}>
                    <Image 
                      src={item.image_url} 
                      alt={item.name}
                      width={300}
                      height={200}
                    />
                  </div>
                )}
                <div className={styles.itemContent}>
                  <div className={styles.itemHeader}>
                    <h3 className={styles.itemName}>{item.name}</h3>
                    <span className={styles.itemPrice}>GHS {item.price.toFixed(2)}</span>
                  </div>
                  {item.description && (
                    <p className={styles.itemDescription}>{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {itemsByCategory.map(({ category, items }) => (
        <section key={category.id} className={styles.categorySection}>
          <h2 className={styles.categoryTitle}>{category.name}</h2>
          {category.description && (
            <p className={styles.categoryDescription}>{category.description}</p>
          )}
          <div className={styles.itemsList}>
            {items.map(item => (
              <div key={item.id} className={styles.menuItem}>
                {item.image_url && (
                  <div className={styles.itemImageSmall}>
                    <Image 
                      src={item.image_url} 
                      alt={item.name}
                      width={80}
                      height={80}
                    />
                  </div>
                )}
                <div className={styles.itemContent}>
                  <div className={styles.itemHeader}>
                    <h3 className={styles.itemName}>{item.name}</h3>
                    <span className={styles.itemPrice}>GHS {item.price.toFixed(2)}</span>
                  </div>
                  {item.description && (
                    <p className={styles.itemDescription}>{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <footer className={styles.footer}>
        <p>Powered by <strong>MenuQR Africa</strong></p>
      </footer>
    </div>
  )
}

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