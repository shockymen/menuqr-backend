import Image from 'next/image'
import styles from './vibrant-playful.module.css'

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

export default function VibrantPlayful({ business, categories, items, primaryColor = '#FF6B6B' }: Props) {
  const featuredItems = items.filter(item => item.is_featured)
  const itemsByCategory = categories.map(category => ({
    category,
    items: items.filter(item => item.category_id === category.id)
  })).filter(group => group.items.length > 0)

  return (
    <div className={styles.container} style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      {/* Vibrant Header */}
      <header className={styles.header}>
        <div className={styles.headerShapes}>
          <div className={styles.circle}></div>
          <div className={styles.triangle}></div>
          <div className={styles.square}></div>
        </div>
        <div className={styles.headerContent}>
          {business.logo_url && (
            <div className={styles.logoWrapper}>
              <Image 
                src={business.logo_url} 
                alt={business.name}
                width={100}
                height={100}
                className={styles.logo}
              />
            </div>
          )}
          <h1 className={styles.businessName}>{business.display_name || business.name}</h1>
          {business.description && (
            <p className={styles.tagline}>{business.description}</p>
          )}
          <div className={styles.info}>
            <span className={styles.badge}>📍 {business.city}</span>
            {business.phone && (
              <span className={styles.badge}>
                <a href={`tel:${business.phone}`}>📞 Call Us</a>
              </span>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Featured Items */}
        {featuredItems.length > 0 && (
          <section className={styles.featured}>
            <div className={styles.titleBox}>
              <h2 className={styles.sectionTitle}>⭐ Must Try!</h2>
            </div>
            <div className={styles.featuredGrid}>
              {featuredItems.map((item, index) => (
                <div key={item.id} className={`${styles.featuredCard} ${styles[`color${(index % 3) + 1}`]}`}>
                  <div className={styles.cardNumber}>{String(index + 1).padStart(2, '0')}</div>
                  {item.image_url && (
                    <div className={styles.cardImage}>
                      <Image 
                        src={item.image_url} 
                        alt={item.name}
                        width={400}
                        height={300}
                        className={styles.image}
                      />
                    </div>
                  )}
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardName}>{item.name}</h3>
                    {item.description && (
                      <p className={styles.cardDesc}>{item.description}</p>
                    )}
                    <div className={styles.cardPriceTag}>
                      <span className={styles.price}>GHS {item.price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {itemsByCategory.map((group, categoryIndex) => (
          <section key={group.category.id} className={styles.category}>
            <div className={`${styles.titleBox} ${styles[`titleColor${(categoryIndex % 4) + 1}`]}`}>
              <h2 className={styles.sectionTitle}>{group.category.name}</h2>
            </div>
            {group.category.description && (
              <p className={styles.categoryDesc}>{group.category.description}</p>
            )}
            <div className={styles.itemsGrid}>
              {group.items.map(item => (
                <div key={item.id} className={styles.itemCard}>
                  {item.image_url && (
                    <div className={styles.itemImage}>
                      <Image 
                        src={item.image_url} 
                        alt={item.name}
                        width={250}
                        height={180}
                        className={styles.image}
                      />
                    </div>
                  )}
                  <div className={styles.itemBody}>
                    <h3 className={styles.itemName}>{item.name}</h3>
                    {item.description && (
                      <p className={styles.itemDesc}>{item.description}</p>
                    )}
                    <div className={styles.itemFooter}>
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
        <div className={styles.footerWave}>
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,0 C150,100 350,0 600,50 C850,100 1050,0 1200,50 L1200,120 L0,120 Z" fill="currentColor"></path>
          </svg>
        </div>
        <div className={styles.footerContent}>
          <p>🎉 Made with MenuQR Africa 🎉</p>
        </div>
      </footer>
    </div>
  )
}