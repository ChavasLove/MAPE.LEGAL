import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mape.legal'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/dashboard', '/portal', '/api', '/login', '/auth'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
