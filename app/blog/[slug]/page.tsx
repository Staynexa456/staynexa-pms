// app/blog/[slug]/page.tsx
import { supabase } from "../../supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, content, cover_image")
    .eq("slug", params.slug)
    .eq("status", "published")
    .single();

  if (!post) return { title: "Post Not Found | Staynexa Blog" };

  // Markdown চিহ্নগুলো বাদ দিয়ে শুধু টেক্সট বের করা (SEO-এর জন্য)
  const plainTextContent = post.content.replace(/<[^>]+>/g, "").replace(/[#*`_]/g, "").substring(0, 160);

  return {
    title: `${post.title} | Staynexa Blog`,
    description: plainTextContent,
    openGraph: {
      title: post.title,
      description: plainTextContent,
      images: post.cover_image ? [{ url: post.cover_image }] : [],
      type: "article",
    },
  };
}

export default async function SingleBlogPost({ params }: { params: { slug: string } }) {
  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", params.slug)
    .eq("status", "published")
    .single();

  if (!post) notFound();

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

          {/* Markdown রেন্ডারার */}
          <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>
        </div>
      </article>
    </div>
  );
}