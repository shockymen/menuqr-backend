import Image from 'next/image'
import styles from './minimalist-dark.module.css'

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

interface Business {
  name: string
  display_name: string
  description: string
  logo_url: string | null
  city: string
  country: string
  phone: string
  address: string
}

interface Props {
  business: Business
  categories: Category[]
  items: MenuItem[]
  primaryColor?: string
}

export default function MinimalistDark({ business, categories, items, primaryColor = '#D4AF37' }: Props) {
  const featuredItems = items.filter(item => item.is_featured)
  const itemsByCategory = categories.map(category => ({
    category,
    items: items.filter(item => item.category_id === category.id)
  })).filter(group => group.items.length > 0)

  return (
    <div className={styles.container} style={{ '--accent-color': primaryColor } as React.CSSProperties}>
      {/* Minimalist Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          {business.logo_url && (
            <div className={styles.logoWrapper}>
              <Image 
                src={business.logo_url} 
                alt={business.name}
                width={80}
                height={80}
                className={styles.logo}
              />
            </div>
          )}
          <h1 className={styles.businessName}>{business.display_name || business.name}</h1>
          {business.description && (
            <p className={styles.tagline}>{business.description}</p>
          )}
          <div className={styles.location}>
            <span>{business.city}, {business.country}</span>
            {business.phone && (
              <>
                <span className={styles.sep}>·</span>
                <a href={`tel:${business.phone}`}>{business.phone}</a>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Featured Items */}
        {featuredItems.length > 0 && (
          <section className={styles.featured}>
            <div className={styles.sectionLabel}>Signature</div>
            <div className={styles.featuredGrid}>
              {featuredItems.map(item => (
                <div key={item.id} className={styles.featuredCard}>
                  {item.image_url && (
                    <div className={styles.featuredImage}>
                      <Image 
                        src={item.image_url} 
                        alt={item.name}
                        width={600}
                        height={400}
                        className={styles.image}
                      />
                      <div className={styles.imageOverlay}></div>
                    </div>
                  )}
                  <div className={styles.featuredInfo}>
                    <div className={styles.featuredHeader}>
                      <h3 className={styles.featuredName}>{item.name}</h3>
                      <span className={styles.featuredPrice}>{item.price.toFixed(2)}</span>
                    </div>
                    {item.description && (
                      <p className={styles.featuredDesc}>{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {itemsByCategory.map(({ category, items }) => (
          <section key={category.id} className={styles.category}>
            <div className={styles.categoryHeader}>
              <div className={styles.sectionLabel}>{category.name}</div>
              {category.description && (
                <p className={styles.categoryDesc}>{category.description}</p>
              )}
            </div>
            <div className={styles.itemsGrid}>
              {items.map(item => (
                <div key={item.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <h3 className={styles.itemName}>{item.name}</h3>
                    <div className={styles.spacer}></div>
                    <span className={styles.itemPrice}>{item.price.toFixed(2)}</span>
                  </div>
                  {item.description && (
                    <p className={styles.itemDesc}>{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerLine}></div>
        <p>MenuQR Africa</p>
      </footer>
    </div>
  )
}