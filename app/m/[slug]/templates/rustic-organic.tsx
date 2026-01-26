import Image from 'next/image'
import styles from './rustic-organic.module.css'

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

export default function RusticOrganic({ business, categories, items, primaryColor = '#6B8E23' }: Props) {
  const featuredItems = items.filter(item => item.is_featured)
  const itemsByCategory = categories.map(category => ({
    category,
    items: items.filter(item => item.category_id === category.id)
  })).filter(group => group.items.length > 0)

  return (
    <div className={styles.container} style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      {/* Rustic Header */}
      <header className={styles.header}>
        <div className={styles.headerPattern}></div>
        <div className={styles.headerContent}>
          {business.logo_url && (
            <div className={styles.logoContainer}>
              <Image 
                src={business.logo_url} 
                alt={business.name}
                width={90}
                height={90}
                className={styles.logo}
              />
            </div>
          )}
          <div className={styles.leafLeft}>🌿</div>
          <h1 className={styles.businessName}>{business.display_name || business.name}</h1>
          <div className={styles.leafRight}>🌿</div>
          {business.description && (
            <p className={styles.tagline}>{business.description}</p>
          )}
          <div className={styles.contactInfo}>
            <p>📍 {business.city}, {business.country}</p>
            {business.phone && (
              <p>📞 <a href={`tel:${business.phone}`}>{business.phone}</a></p>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Featured Section */}
        {featuredItems.length > 0 && (
          <section className={styles.featuredSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.headerLine}></div>
              <h2 className={styles.sectionTitle}>Today&apos;s Specials</h2>
              <div className={styles.headerLine}></div>
            </div>
            <div className={styles.featuredGrid}>
              {featuredItems.map(item => (
                <div key={item.id} className={styles.featuredCard}>
                  <div className={styles.cardBadge}>Fresh</div>
                  {item.image_url && (
                    <div className={styles.cardImage}>
                      <Image 
                        src={item.image_url} 
                        alt={item.name}
                        width={350}
                        height={250}
                        className={styles.image}
                      />
                    </div>
                  )}
                  <div className={styles.cardContent}>
                    <h3 className={styles.cardName}>{item.name}</h3>
                    {item.description && (
                      <p className={styles.cardDesc}>{item.description}</p>
                    )}
                    <div className={styles.cardPrice}>
                      <span className={styles.currency}>GHS</span>
                      <span className={styles.amount}>{item.price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Menu Categories */}
        {itemsByCategory.map(({ category, items }) => (
          <section key={category.id} className={styles.menuSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.headerLine}></div>
              <h2 className={styles.sectionTitle}>{category.name}</h2>
              <div className={styles.headerLine}></div>
            </div>
            {category.description && (
              <p className={styles.categoryDesc}>{category.description}</p>
            )}
            <div className={styles.menuList}>
              {items.map(item => (
                <div key={item.id} className={styles.menuItem}>
                  {item.image_url && (
                    <div className={styles.itemImage}>
                      <Image 
                        src={item.image_url} 
                        alt={item.name}
                        width={120}
                        height={120}
                        className={styles.image}
                      />
                    </div>
                  )}
                  <div className={styles.itemContent}>
                    <div className={styles.itemTop}>
                      <h3 className={styles.itemName}>{item.name}</h3>
                      <span className={styles.itemPrice}>GHS {item.price.toFixed(2)}</span>
                    </div>
                    {item.description && (
                      <p className={styles.itemDesc}>{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerPattern}></div>
        <p className={styles.footerText}>
          <span className={styles.leaf}>🌾</span>
          Crafted with love · MenuQR Africa
          <span className={styles.leaf}>🌾</span>
        </p>
      </footer>
    </div>
  )
}