// app/blog/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  cover_image: string;
  created_at: string;
};

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      // Supabase থেকে শুধু 'published' পোস্টগুলো নিয়ে আসা
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, content, cover_image, created_at")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setPosts(data);
      }
      setLoading(false);
    }

    fetchPosts();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER SECTION */}
      <div className="bg-white border-b border-gray-200 pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          Staynexa Blog
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Insights, tips, and news to help you run your hotel on autopilot.
        </p>
      </div>

      {/* BLOG POSTS GRID */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : posts.length === 0 ? (
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
                href={`/blog/${post.slug}`} // ক্লিক করলে নির্দিষ্ট পোস্টে যাবে
                className="group flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300"
              >
                {/* Cover Image */}
                <div className="h-48 w-full bg-gray-200 overflow-hidden relative">
                  {post.cover_image ? (
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No Image
                    </div>
                  )}
                </div>

                {/* Content Details */}
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