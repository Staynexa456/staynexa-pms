// app/admin/blog/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../supabase"; // ✅ এখানে পাথ ঠিক করা হয়েছে
import Link from "next/link";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  cover_image: string;
  status: string;
  created_at: string;
};

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Form States
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");

  // ডাটাবেস থেকে ব্লগ পোস্ট নিয়ে আসা
  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // টাইটেল থেকে অটোমেটিক স্লাগ তৈরি করা
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    // স্পেসের জায়গায় '-' বসিয়ে ছোট হাতের অক্ষরে রূপান্তর
    const generatedSlug = newTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    setSlug(generatedSlug);
  };

  // নতুন পোস্ট সেভ করা
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: "", text: "" });

    const { error } = await supabase.from("blog_posts").insert([
      {
        title,
        slug,
        content,
        cover_image: coverImage,
        status: "published",
      },
    ]);

    if (error) {
      setMessage({ type: "error", text: "পোস্ট সেভ করতে সমস্যা হয়েছে: " + error.message });
    } else {
      setMessage({ type: "success", text: "পোস্ট সফলভাবে পাবলিশ হয়েছে!" });
      // ফর্ম রিসেট করা
      setTitle("");
      setSlug("");
      setContent("");
      setCoverImage("");
      fetchPosts(); // লিস্ট আপডেট করা
    }
    setSubmitting(false);
  };

  // পোস্ট ডিলিট করা
  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত এই পোস্টটি ডিলিট করতে চান?")) return;

    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (!error) {
      fetchPosts();
    } else {
      alert("ডিলিট করা সম্ভব হয়নি!");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Blog Editor</h1>
        <Link href="/blog" target="_blank" className="text-sm text-blue-400 hover:underline">
          View Public Blog &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* বাম দিকে: নতুন পোস্ট লেখার ফর্ম */}
        <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4">Create New Post</h2>
          
          {message.text && (
            <div className={`p-3 rounded-md mb-4 text-sm ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Post Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={handleTitleChange}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. 5 Tips to Increase Hotel Bookings"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">URL Slug (Auto-generated)</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Cover Image URL</label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Content (Markdown Supported)</label>
              <textarea
                required
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                placeholder="Write your blog content here..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
            >
              {submitting ? "Publishing..." : "Publish Post"}
            </button>
          </form>
        </div>

        {/* ডান দিকে: পোস্টের লিস্ট */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4">Published Posts</h2>
          
          {loading ? (
            <p className="text-slate-400">Loading posts...</p>
          ) : posts.length === 0 ? (
            <p className="text-slate-400">No posts found.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {posts.map((post) => (
                <div key={post.id} className="p-3 bg-slate-800 rounded-lg border border-slate-700 flex flex-col gap-2">
                  <h3 className="text-white font-medium line-clamp-2">{post.title}</h3>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-400">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-xs text-red-400 hover:text-red-300 bg-red-400/10 px-2 py-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}