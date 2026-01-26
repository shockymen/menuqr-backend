import Image from 'next/image'
import styles from './modern-minimal.module.css'

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

export default function ModernMinimal({ business, categories, items, primaryColor = '#ffc107' }: Props) {
  const featuredItems = items.filter(item => item.is_featured)
  const itemsByCategory = categories.map(category => ({
    category,
    items: items.filter(item => item.category_id === category.id)
  })).filter(group => group.items.length > 0)

  return (
    <div className={styles.container} style={{ '--primary-color': primaryColor } as React.CSSProperties}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          {business.logo_url && (
            <div className={styles.logoWrapper}>
              <Image 
                src={business.logo_url} 
                alt={business.name}
                width={120}
                height={120}
                className={styles.logo}
              />
            </div>
          )}
          <h1 className={styles.title}>{business.display_name || business.name}</h1>
          {business.description && (
            <p className={styles.subtitle}>{business.description}</p>
          )}
          <div className={styles.businessInfo}>
            <span>📍 {business.city}, {business.country}</span>
            {business.phone && (
              <>
                <span className={styles.divider}>•</span>
                <a href={`tel:${business.phone}`} className={styles.phone}>📞 {business.phone}</a>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {featuredItems.length > 0 && (
          <section className={styles.featured}>
            <h2 className={styles.sectionTitle}>✨ Chef&apos;s Specials</h2>
            <div className={styles.featuredGrid}>
              {featuredItems.map(item => (
                <div key={item.id} className={styles.featuredCard}>
                  {item.image_url && (
                    <div className={styles.featuredImage}>
                      <Image 
                        src={item.image_url} 
                        alt={item.name}
                        width={400}
                        height={300}
                        className={styles.image}
                      />
                    </div>
                  )}
                  <div className={styles.featuredContent}>
                    <h3 className={styles.featuredName}>{item.name}</h3>
                    <p className={styles.featuredDesc}>{item.description}</p>
                    <span className={styles.featuredPrice}>GHS {item.price.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {itemsByCategory.map(({ category, items }) => (
          <section key={category.id} className={styles.category}>
            <div className={styles.categoryHeader}>
              <h2 className={styles.categoryTitle}>{category.name}</h2>
              {category.description && (
                <p className={styles.categoryDesc}>{category.description}</p>
              )}
            </div>
            <div className={styles.itemsGrid}>
              {items.map(item => (
                <div key={item.id} className={styles.itemCard}>
                  {item.image_url && (
                    <div className={styles.itemImage}>
                      <Image 
                        src={item.image_url} 
                        alt={item.name}
                        width={300}
                        height={200}
                        className={styles.image}
                      />
                    </div>
                  )}
                  <div className={styles.itemContent}>
                    <div className={styles.itemHeader}>
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
        <p>Powered by <strong>MenuQR Africa</strong></p>
      </footer>
    </div>
  )
}