// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../supabase";

type Stats = {
  totalHotels: number;
  totalOwners: number;
  pendingHotels: number;
  pendingPayments: number;
  totalSubscriptions: number;
  featureRequests: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalHotels: 0,
    totalOwners: 0,
    pendingHotels: 0,
    pendingPayments: 0,
    totalSubscriptions: 0,
    featureRequests: 0,
  });
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        setEmail(sessionData?.session?.user?.email || null);

        const [hotelsRes, pendingHotelsRes, ownersRes, featureReqRes] = await Promise.all([
          supabase.from("hotels").select("id", { count: "exact", head: true }),
          supabase.from("hotels").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("hotels").select("owner_id"),
          supabase.from("feature_requests").select("id", { count: "exact", head: true }),
        ]);

        const uniqueOwners = new Set(
          (ownersRes.data || []).map((h: any) => h.owner_id).filter(Boolean)
        );

        setStats({
          totalHotels: hotelsRes.count || 0,
          pendingHotels: pendingHotelsRes.count || 0,
          totalOwners: uniqueOwners.size,
          pendingPayments: 0,
          totalSubscriptions: 0,
          featureRequests: featureReqRes.count || 0,
        });
      } catch (err) {
        console.error("[Admin] Load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
          <p className="text-purple-300 text-sm font-medium">Loading Admin…</p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: "Total Hotels",
      value: stats.totalHotels,
      icon: "🏨",
      href: "/admin/hotels",
      color: "from-purple-500 to-purple-700",
    },
    {
      label: "Pending Approval",
      value: stats.pendingHotels,
      icon: "⏳",
      href: "/admin/pending-hotels",
      color: "from-amber-500 to-amber-700",
    },
    {
      label: "Total Owners",
      value: stats.totalOwners,
      icon: "👥",
      href: "/admin/owners",
      color: "from-teal-500 to-teal-700",
    },
    {
      label: "Feature Requests",
      value: stats.featureRequests,
      icon: "💡",
      href: "/admin/feature-requests",
      color: "from-pink-500 to-pink-700",
    },
    {
      label: "Payments",
      value: stats.pendingPayments,
      icon: "💳",
      href: "/admin/payments",
      color: "from-emerald-500 to-emerald-700",
    },
    {
      label: "Subscriptions",
      value: stats.totalSubscriptions,
      icon: "📋",
      href: "/admin/subscriptions",
      color: "from-blue-500 to-blue-700",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}
      <div className="border-b border-purple-900/30 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-lg font-bold">
              👑
            </div>
            <div>
              <h1 className="text-lg font-bold">Staynexa Admin</h1>
              <p className="text-xs text-purple-300/70">
                {email || "Platform Admin"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-900/30 rounded-lg transition"
            >
              ← Back to PMS
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* HERO */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Admin Dashboard</h2>
          <p className="text-purple-300/70 text-sm">
            Manage all hotels, owners, payments, and platform operations.
          </p>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          {cards.map((card, i) => (
            <Link
              key={i}
              href={card.href}
              className="group relative overflow-hidden rounded-2xl border border-purple-900/30 bg-slate-900/50 p-5 hover:border-purple-500/50 transition-all"
            >
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${card.color}`} />
              <div className="text-3xl mb-3">{card.icon}</div>
              <p className="text-[10px] uppercase tracking-widest text-purple-300/70 font-semibold mb-1">
                {card.label}
              </p>
              <p className="text-3xl font-bold text-white">{card.value}</p>
            </Link>
          ))}
        </div>

        {/* QUICK LINKS */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "🏨", label: "Manage Hotels", desc: "View & edit all hotels", href: "/admin/hotels" },
              { icon: "⏳", label: "Pending Approvals", desc: "Approve new hotel registrations", href: "/admin/pending-hotels" },
              { icon: "👥", label: "Owners", desc: "Manage hotel owners", href: "/admin/owners" },
              { icon: "💳", label: "Payments", desc: "View all payment transactions", href: "/admin/payments" },
              { icon: "💡", label: "Feature Requests", desc: "Review user suggestions", href: "/admin/feature-requests" },
              { icon: "⚙️", label: "Settings", desc: "Platform configuration", href: "/admin/settings" },
            ].map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="group flex items-start gap-4 p-5 rounded-2xl border border-purple-900/30 bg-slate-900/50 hover:bg-slate-900/80 hover:border-purple-500/50 transition-all"
              >
                <div className="text-3xl shrink-0">{action.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white mb-1">{action.label}</p>
                  <p className="text-xs text-purple-300/70">{action.desc}</p>
                </div>
                <span className="text-purple-400 text-sm group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* SYSTEM INFO */}
        <div className="rounded-2xl border border-purple-900/30 bg-slate-900/50 p-6">
          <h3 className="text-sm font-bold mb-4 text-purple-300">System Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-purple-300/60 mb-1">Platform</p>
              <p className="font-semibold">Staynexa PMS</p>
            </div>
            <div>
              <p className="text-purple-300/60 mb-1">Version</p>
              <p className="font-semibold">1.0.0</p>
            </div>
            <div>
              <p className="text-purple-300/60 mb-1">Environment</p>
              <p className="font-semibold">Production</p>
            </div>
            <div>
              <p className="text-purple-300/60 mb-1">Status</p>
              <p className="font-semibold text-emerald-400">● Live</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
