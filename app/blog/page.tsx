// app/blog/page.tsx
import Link from "next/link";
import { supabase } from "../supabase";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | Staynexa - Hotel Management System",
  description: "Insights, tips, and news to help you run your hotel on autopilot.",
};

export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, content, cover_image, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-100 pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f0fdf4] text-[#059669] text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
          Staynexa Blog
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          Insights for Modern Hoteliers
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Tips, news, and strategies to help you run your hotel on autopilot.
        </p>
      </div>

      {/* Blog Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        {(!posts || posts.length === 0) ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-xl text-gray-500 mb-4">No blog posts published yet.</p>
            <Link href="/" className="text-[#059669] hover:underline font-medium">
              Go Back Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300"
              >
                <div className="h-48 w-full bg-gray-100 overflow-hidden relative">
                  {post.cover_image ? (
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                  )}
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <p className="text-xs text-[#059669] font-semibold tracking-wider uppercase mb-2">
                    {new Date(post.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-[#059669] transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1">
                    {post.content.replace(/<[^>]+>/g, "").replace(/[#*`_]/g, "").substring(0, 150)}...
                  </p>
                  
                  <span className="inline-flex items-center text-sm font-semibold text-[#059669] mt-auto">
                    Read More <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}