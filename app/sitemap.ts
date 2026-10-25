// app/sitemap.ts
import { MetadataRoute } from 'next'
import { supabase } from './supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ডাটাবেস থেকে সব পাবলিশড ব্লগ পোস্টের স্লাগ নিয়ে আসা
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, created_at')
    .eq('status', 'published')

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
      url: 'https://staynexa.in/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...blogUrls, // ব্লগ পোস্টগুলোর লিংক এখানে যুক্ত হলো
  ]
}