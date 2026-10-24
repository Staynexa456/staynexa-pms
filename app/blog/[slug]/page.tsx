// app/blog/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../supabase"; // ✅ পাথ ঠিক করা হয়েছে: দুই ধাপ পেছনে

export default function SingleBlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPost() {
      if (!slug) return;
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .single();

      if (!error && data) setPost(data);
      setLoading(false);
    }
    fetchPost();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!post) return <div className="min-h-screen flex flex-col justify-center items-center"><h1 className="text-2xl font-bold mb-4">Post Not Found</h1><Link href="/blog" className="text-blue-600 hover:underline">Back to Blog</Link></div>;

  return (
    <div className="min-h-screen bg-white pb-20">
      {post.cover_image && (
        <div className="w-full h-[40vh] md:h-[60vh] relative bg-gray-900">
          <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
        </div>
      )}
      <article className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 ${post.cover_image ? '-mt-20 relative z-10' : 'pt-20'}`}>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
          <Link href="/blog" className="text-sm font-semibold text-blue-600 hover:underline mb-6 inline-block">&larr; Back to all posts</Link>
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">{post.title}</h1>
          <div className="flex items-center text-sm text-gray-500 mb-8 border-b border-gray-100 pb-6">
            <span>Published on {new Date(post.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</div>
        </div>
      </article>
    </div>
  );
}