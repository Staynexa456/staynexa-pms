// app/blog/page.tsx
import Link from "next/link";
import { supabase } from "../supabase";
import { Metadata } from "next";

// ✅ মেইন ব্লগ পেজের স্ট্যাটিক SEO
export const metadata: Metadata = {
  title: "Blog | Staynexa - Hotel Management System",
  description: "Insights, tips, and news to help you run your hotel on autopilot.",
};

// ✅ সার্ভার কম্পোনেন্ট
export default async function BlogPage() {
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, content, cover_image, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          Staynexa Blog
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Insights, tips, and news to help you run your hotel on autopilot.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        {(!posts || posts.length === 0) ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xl text-gray-500 mb-4">No blog posts published yet.</p>
            <Link href="/" className="text-blue-600 hover:underline">
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
                <div className="h-48 w-full bg-gray-200 overflow-hidden relative">
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
                  <p className="text-xs text-blue-600 font-semibold tracking-wider uppercase mb-2">
                    {new Date(post.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1">
                    {post.content.replace(/<[^>]+>/g, "").substring(0, 150)}...
                  </p>
                  
                  <span className="inline-flex items-center text-sm font-semibold text-blue-600 mt-auto">
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