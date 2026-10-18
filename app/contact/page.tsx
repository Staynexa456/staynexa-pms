// app/contact/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      // ✅ Send email via your existing API
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contactForm", // You can add this to your email templates later
          to: "support@staynexa.in",
          data: {
            name: formData.name,
            email: formData.email,
            subject: formData.subject,
            message: formData.message,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      setStatus({ type: "success", msg: "✅ Message sent successfully! We'll reply within 24 hours." });
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      console.error("[Contact] Error:", err);
      setStatus({ type: "error", msg: "⚠ Something went wrong. Please email us directly at support@staynexa.in" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-bold">Staynexa</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/features" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Features</Link>
            <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Pricing</Link>
            <Link href="/about" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">About</Link>
            <Link href="/contact" className="px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg">Contact</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-semibold text-slate-700">Log in</Link>
            <Link href="/signup" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12">

          {/* LEFT: Contact Info */}
          <div>
            <p className="text-xs font-bold tracking-widest text-teal-600 uppercase mb-3">Get in Touch</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              We'd love to <br className="hidden md:block"/> hear from you.
            </h1>
            <p className="text-lg text-slate-600 mb-10">
              Whether you have a question about features, pricing, or need a demo — our team is ready to answer all your questions.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-sm shrink-0">
                  ✉️
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Email Us</h3>
                  <p className="text-sm text-slate-500 mb-1">Our friendly team is here to help.</p>
                  <a href="mailto:support@staynexa.in" className="text-sm font-semibold text-teal-600 hover:underline">support@staynexa.in</a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-sm shrink-0">
                  📞
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Call Us</h3>
                  <p className="text-sm text-slate-500 mb-1">Mon-Fri from 9am to 6pm IST.</p>
                  <a href="tel:+919876543210" className="text-sm font-semibold text-teal-600 hover:underline">+91 98765 43210</a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-sm shrink-0">
                  📍
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Visit Us</h3>
                  <p className="text-sm text-slate-500 mb-1">Come say hello at our office.</p>
                  <p className="text-sm font-semibold text-slate-800">Agartala, Tripura<br/>India - 799001</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Form */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
            <h2 className="text-2xl font-bold mb-6">Send us a message</h2>

            {status && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${
                status.type === "success" 
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}>
                {status.msg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm"
                    placeholder="you@hotel.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm"
                  placeholder="How can we help?"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm resize-none"
                  placeholder="Tell us more about your hotel..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition disabled:opacity-50 mt-2"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} Staynexa. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}