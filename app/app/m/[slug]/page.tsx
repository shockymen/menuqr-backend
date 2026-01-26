import { notFound } from 'next/navigation'
import Image from 'next/image'

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
  menus: Menu[]  // ✅ Fixed - was any[]
  categories: Category[]
  items: MenuItem[]
}

async function getMenuData(slug: string): Promise<MenuData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://menuqr-backend.vercel.app'
    const response = await fetch(`${apiUrl}/api/v1/public/menu/${slug}`, {
      next: { revalidate: 3600 } // Cache for 1 hour
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

  // Group items by category
  const itemsByCategory = categories.map(category => ({
    category,
    items: items.filter(item => item.category_id === category.id)
  })).filter(group => group.items.length > 0)

  // Featured items
  const featuredItems = items.filter(item => item.is_featured)

  return (
    <div className="menu-page">
      {/* Header */}
      <header className="header">
        {business.logo_url && (
          <div className="logo">
            <Image 
              src={business.logo_url} 
              alt={business.name}
              width={80}
              height={80}
              className="logo-image"
            />
          </div>
        )}
        <h1 className="business-name">{business.display_name || business.name}</h1>
        {business.description && (
          <p className="business-description">{business.description}</p>
        )}
        <div className="business-info">
          <p className="location">📍 {business.city}, {business.country}</p>
          {business.phone && (
            <p className="phone">📞 <a href={`tel:${business.phone}`}>{business.phone}</a></p>
          )}
          {business.address && (
            <p className="address">{business.address}</p>
          )}
        </div>
      </header>

      {/* Featured Items */}
      {featuredItems.length > 0 && (
        <section className="featured-section">
          <h2 className="section-title">⭐ Featured</h2>
          <div className="items-grid">
            {featuredItems.map(item => (
              <div key={item.id} className="menu-item featured">
                {item.image_url && (
                  <div className="item-image">
                    <Image 
                      src={item.image_url} 
                      alt={item.name}
                      width={300}
                      height={200}
                      className="image"
                    />
                  </div>
                )}
                <div className="item-content">
                  <div className="item-header">
                    <h3 className="item-name">{item.name}</h3>
                    <span className="item-price">GHS {item.price.toFixed(2)}</span>
                  </div>
                  {item.description && (
                    <p className="item-description">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Menu Items by Category */}
      {itemsByCategory.map(({ category, items }) => (
        <section key={category.id} className="category-section">
          <h2 className="category-title">{category.name}</h2>
          {category.description && (
            <p className="category-description">{category.description}</p>
          )}
          <div className="items-list">
            {items.map(item => (
              <div key={item.id} className="menu-item">
                {item.image_url && (
                  <div className="item-image-small">
                    <Image 
                      src={item.image_url} 
                      alt={item.name}
                      width={80}
                      height={80}
                      className="image"
                    />
                  </div>
                )}
                <div className="item-content">
                  <div className="item-header">
                    <h3 className="item-name">{item.name}</h3>
                    <span className="item-price">GHS {item.price.toFixed(2)}</span>
                  </div>
                  {item.description && (
                    <p className="item-description">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Footer */}
      <footer className="footer">
        <p>Powered by <strong>MenuQR Africa</strong></p>
      </footer>

      <style jsx>{`
        .menu-page {
          min-height: 100vh;
          background: #f8f9fa;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .header {
          background: white;
          padding: 2rem 1rem;
          text-align: center;
          border-bottom: 1px solid #e9ecef;
          margin-bottom: 2rem;
        }

        .logo {
          margin-bottom: 1rem;
        }

        .logo-image {
          border-radius: 50%;
          object-fit: cover;
        }

        .business-name {
          font-size: 2rem;
          font-weight: 700;
          color: #212529;
          margin: 0.5rem 0;
        }

        .business-description {
          font-size: 1.1rem;
          color: #6c757d;
          max-width: 600px;
          margin: 0.5rem auto;
        }

        .business-info {
          margin-top: 1rem;
          font-size: 0.95rem;
          color: #495057;
        }

        .business-info p {
          margin: 0.25rem 0;
        }

        .business-info a {
          color: #0066cc;
          text-decoration: none;
        }

        .featured-section,
        .category-section {
          max-width: 1200px;
          margin: 0 auto 3rem;
          padding: 0 1rem;
        }

        .section-title,
        .category-title {
          font-size: 1.75rem;
          font-weight: 600;
          color: #212529;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 3px solid #ffc107;
        }

        .category-description {
          color: #6c757d;
          margin-bottom: 1.5rem;
        }

        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .menu-item {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .menu-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .menu-item.featured {
          border: 2px solid #ffc107;
        }

        .item-image {
          width: 100%;
          height: 200px;
          overflow: hidden;
          background: #e9ecef;
        }

        .item-image .image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .items-list .menu-item {
          display: flex;
          flex-direction: row;
          align-items: center;
        }

        .item-image-small {
          width: 80px;
          height: 80px;
          flex-shrink: 0;
          overflow: hidden;
          background: #e9ecef;
        }

        .item-image-small .image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .item-content {
          padding: 1rem;
          flex: 1;
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .item-name {
          font-size: 1.25rem;
          font-weight: 600;
          color: #212529;
          margin: 0;
          flex: 1;
        }

        .item-price {
          font-size: 1.25rem;
          font-weight: 700;
          color: #28a745;
          white-space: nowrap;
        }

        .item-description {
          font-size: 0.95rem;
          color: #6c757d;
          margin: 0;
          line-height: 1.5;
        }

        .footer {
          background: white;
          padding: 2rem 1rem;
          text-align: center;
          border-top: 1px solid #e9ecef;
          margin-top: 3rem;
          color: #6c757d;
          font-size: 0.9rem;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .business-name {
            font-size: 1.5rem;
          }

          .items-grid {
            grid-template-columns: 1fr;
          }

          .items-list .menu-item {
            flex-direction: column;
            align-items: stretch;
          }

          .item-image-small {
            width: 100%;
            height: 150px;
          }

          .item-header {
            flex-direction: column;
            gap: 0.5rem;
          }

          .item-name {
            font-size: 1.1rem;
          }

          .item-price {
            font-size: 1.1rem;
          }
        }
      `}</style>
    </div>
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