// app/admin/blog/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import Link from "next/link";

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    if (data) setPosts(data);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
  };

  // 📸 ছবি আপলোড করার ফাংশন
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const fileName = `${Date.now()}-${file.name.replace(/\s/g, "-")}`;
    
    // Supabase Storage-এ আপলোড
    const { error } = await supabase.storage.from("blog-images").upload(fileName, file);
    
    if (error) {
      alert("ছবি আপলোডে সমস্যা হয়েছে: " + error.message);
    } else {
      // আপলোড হওয়া ছবির Public URL বের করা
      const { data } = supabase.storage.from("blog-images").getPublicUrl(fileName);
      setCoverImage(data.publicUrl);
    }
    setUploadingImage(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: "", text: "" });

    const { error } = await supabase.from("blog_posts").insert([{ title, slug, content, cover_image: coverImage, status: "published" }]);

    if (error) {
      setMessage({ type: "error", text: "Error: " + error.message });
    } else {
      setMessage({ type: "success", text: "Post published successfully!" });
      setTitle(""); setSlug(""); setContent(""); setCoverImage("");
      fetchPosts();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("blog_posts").delete().eq("id", id);
    fetchPosts();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Blog Editor</h1>
        <Link href="/blog" target="_blank" className="text-sm text-blue-400 hover:underline">View Public Blog &rarr;</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
              <input type="text" required value={title} onChange={handleTitleChange} className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white outline-none" placeholder="Post title..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">URL Slug</label>
              <input type="text" required value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-400 outline-none text-sm" />
            </div>

            {/* 📸 ছবি আপলোড ফিল্ড */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Cover Image</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer" 
              />
              {uploadingImage && <p className="text-xs text-blue-400 mt-2">Uploading image...</p>}
              {coverImage && !uploadingImage && (
                <div className="mt-3 relative w-full h-40 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                  <img src={coverImage} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setCoverImage("")} className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">Remove</button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Content</label>
              <textarea required rows={10} value={content} onChange={(e) => setContent(e.target.value)} className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white outline-none font-mono text-sm" placeholder="Write content here..." />
            </div>

            <button type="submit" disabled={submitting || uploadingImage} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
              {submitting ? "Publishing..." : "Publish Post"}
            </button>
          </form>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4">Published Posts</h2>
          {loading ? <p className="text-slate-400">Loading...</p> : posts.length === 0 ? <p className="text-slate-400">No posts found.</p> : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {posts.map((post) => (
                <div key={post.id} className="p-3 bg-slate-800 rounded-lg border border-slate-700 flex flex-col gap-2">
                  <h3 className="text-white font-medium line-clamp-2">{post.title}</h3>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-400">{new Date(post.created_at).toLocaleDateString()}</span>
                    <button onClick={() => handleDelete(post.id)} className="text-xs text-red-400 hover:text-red-300 bg-red-400/10 px-2 py-1 rounded">Delete</button>
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