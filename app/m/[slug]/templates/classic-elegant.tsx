import Image from 'next/image'
import styles from './classic-elegant.module.css'

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

export default function ClassicElegant({ business, categories, items, primaryColor = '#8B4513' }: Props) {
  const featuredItems = items.filter(item => item.is_featured)
  const itemsByCategory = categories.map(category => ({
    category,
    items: items.filter(item => item.category_id === category.id)
  })).filter(group => group.items.length > 0)

  return (
    <div className={styles.container} style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      {/* Classic Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          {business.logo_url && (
            <div className={styles.logoContainer}>
              <Image 
                src={business.logo_url} 
                alt={business.name}
                width={100}
                height={100}
                className={styles.logo}
              />
            </div>
          )}
          <div className={styles.divider}></div>
          <h1 className={styles.businessName}>{business.display_name || business.name}</h1>
          <div className={styles.divider}></div>
          {business.description && (
            <p className={styles.tagline}>{business.description}</p>
          )}
          <div className={styles.contactInfo}>
            <p className={styles.location}>
              <span className={styles.icon}>📍</span>
              {business.city}, {business.country}
            </p>
            {business.phone && (
              <p className={styles.phone}>
                <span className={styles.icon}>📞</span>
                <a href={`tel:${business.phone}`}>{business.phone}</a>
              </p>
            )}
            {business.address && (
              <p className={styles.address}>{business.address}</p>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Featured Section */}
        {featuredItems.length > 0 && (
          <section className={styles.featuredSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>House Specialties</h2>
              <div className={styles.titleUnderline}></div>
            </div>
            <div className={styles.featuredList}>
              {featuredItems.map((item, index) => (
                <div key={item.id} className={styles.featuredItem}>
                  <div className={styles.featuredNumber}>{String(index + 1).padStart(2, '0')}</div>
                  {item.image_url && (
                    <div className={styles.featuredImageWrapper}>
                      <Image 
                        src={item.image_url} 
                        alt={item.name}
                        width={200}
                        height={200}
                        className={styles.featuredImage}
                      />
                    </div>
                  )}
                  <div className={styles.featuredDetails}>
                    <div className={styles.featuredHeader}>
                      <h3 className={styles.featuredName}>{item.name}</h3>
                      <span className={styles.featuredPrice}>GHS {item.price.toFixed(2)}</span>
                    </div>
                    {item.description && (
                      <p className={styles.featuredDescription}>{item.description}</p>
                    )}
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
              <h2 className={styles.sectionTitle}>{category.name}</h2>
              <div className={styles.titleUnderline}></div>
              {category.description && (
                <p className={styles.sectionDescription}>{category.description}</p>
              )}
            </div>
            <div className={styles.menuList}>
              {items.map(item => (
                <div key={item.id} className={styles.menuItem}>
                  <div className={styles.itemMain}>
                    <div className={styles.itemLeft}>
                      {item.image_url && (
                        <div className={styles.itemImageWrapper}>
                          <Image 
                            src={item.image_url} 
                            alt={item.name}
                            width={100}
                            height={100}
                            className={styles.itemImage}
                          />
                        </div>
                      )}
                      <div className={styles.itemInfo}>
                        <h3 className={styles.itemName}>{item.name}</h3>
                        {item.description && (
                          <p className={styles.itemDescription}>{item.description}</p>
                        )}
                      </div>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={styles.priceDots}></span>
                      <span className={styles.itemPrice}>GHS {item.price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerDivider}></div>
        <p className={styles.footerText}>
          <span className={styles.footerIcon}>✦</span>
          Powered by MenuQR Africa
          <span className={styles.footerIcon}>✦</span>
        </p>
      </footer>
    </div>
  )
}