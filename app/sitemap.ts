// app/sitemap.ts
import { MetadataRoute } from 'next'
import { supabase } from './supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ✅ FIX: 'status: published' এর বদলে 'is_published: true' করা হয়েছে
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, created_at')
    .eq('is_published', true)

  const blogUrls = (posts || []).map((post) => ({
    url: `https://staynexa.in/blog/${post.slug}`,
    lastModified: new Date(post.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: 'https://staynexa.in',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: 'https://staynexa.in/blog',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: 'https://staynexa.in/pricing',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://staynexa.in/features',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://staynexa.in/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://staynexa.in/contact',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...blogUrls, // ব্লগ পোস্টগুলোর লিংক এখানে যুক্ত হলো
  ]
}