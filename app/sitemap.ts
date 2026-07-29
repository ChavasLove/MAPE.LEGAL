import type { MetadataRoute } from 'next'

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mape.legal').replace(/\/+$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const rutas: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/pequena-mineria', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/comercializacion', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/mercados', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/verificar', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/precio', priority: 0.8, changeFrequency: 'daily' },
    { path: '/politica-de-precios', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/precios', priority: 0.7, changeFrequency: 'daily' },
    { path: '/equipos', priority: 0.6, changeFrequency: 'weekly' },
    { path: '/registro', priority: 0.6, changeFrequency: 'weekly' },
    { path: '/aviso-legal', priority: 0.4, changeFrequency: 'yearly' },
  ]
  return rutas.map((r) => ({
    url: r.path === '/' ? BASE : `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
