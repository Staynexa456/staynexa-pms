"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"plans" | "hotels">("plans");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPlans(); }, []);

  async function loadPlans() {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("display_order", { ascending: true });
    
    if (error) console.error("Error loading plans:", error);
    setPlans(data || []);
    setLoading(false);
  }

  // ✅ নতুন প্ল্যান তৈরির জন্য ফর্ম ওপেন করা
  const handleCreateClick = () => {
    setEditingPlan({
      name: "",
      description: "",
      price_monthly: 0,
      price_yearly: 0,
      is_popular: false,
      is_active: true,
      features: [],
      max_rooms: 5,
      max_bookings: 50,
      max_users: 1,
      display_order: plans.length + 1,
    });
    setIsModalOpen(true);
  };

  // ✅ এডিট বাটনে ক্লিক করলে ফর্ম ওপেন করা
  const handleEditClick = (plan: any) => {
    setEditingPlan({ ...plan }); // কপি করা হচ্ছে যাতে সঠিকভাবে এডিট করা যায়
    setIsModalOpen(true);
  };

  // ✅ প্ল্যান সেভ করা (নতুন হলে Insert, পুরনো হলে Update)
  const handleSavePlan = async () => {
    if (!editingPlan) return;
    setSaving(true);
    try {
      const payload = {
        name: editingPlan.name,
        description: editingPlan.description,
        price_monthly: Number(editingPlan.price_monthly),
        price_yearly: Number(editingPlan.price_yearly),
        is_popular: editingPlan.is_popular,
        is_active: editingPlan.is_active,
        features: editingPlan.features || [],
        max_rooms: Number(editingPlan.max_rooms),
        max_bookings: Number(editingPlan.max_bookings),
        max_users: Number(editingPlan.max_users),
        display_order: Number(editingPlan.display_order) || 0,
      };

      if (editingPlan.id) {
        // Update
        const { error } = await supabase
          .from("subscription_plans")
          .update(payload)
          .eq("id", editingPlan.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("subscription_plans")
          .insert(payload);
        if (error) throw error;
      }

      await loadPlans();
      setIsModalOpen(false);
      setEditingPlan(null);
    } catch (err: any) {
      alert("Failed to save plan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ✅ প্ল্যান ডিলিট করা
  const handleDeletePlan = async (id: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    try {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
      if (error) throw error;
      loadPlans();
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  const totalPlans = plans.length;
  const activePlans = plans.filter(p => p.is_active).length;

  if (loading) return <div className="p-6 text-white bg-slate-950 min-h-screen">Loading plans...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto bg-slate-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Subscriptions</h1>
          <p className="text-sm text-slate-400 mt-1">Manage plans and assign them to hotels</p>
        </div>
        <button
          onClick={handleCreateClick}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-600/20 transition"
        >
          + Create Plan
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Plans</p>
          <p className="text-3xl font-bold text-white mt-1">{totalPlans}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Plans</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{activePlans}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Expiring Soon</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">0</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Expired</p>
          <p className="text-3xl font-bold text-rose-400 mt-1">0</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("plans")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition ${activeTab === "plans" ? "bg-purple-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"}`}
        >
          Plans ({totalPlans})
        </button>
        <button
          onClick={() => setActiveTab("hotels")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition ${activeTab === "hotels" ? "bg-purple-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"}`}
        >
          Hotel Subscriptions (4)
        </button>
      </div>

      {/* Plans Grid */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-slate-900 border-2 rounded-3xl p-6 flex flex-col justify-between transition-all ${
                plan.is_popular ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-slate-800"
              }`}
            >
              {plan.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-400 mb-5">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">₹{plan.price_monthly}</span>
                  <span className="text-sm text-slate-400">/mo</span>
                  <p className="text-xs text-slate-500 mt-1">
                    or ₹{plan.price_yearly}/year
                  </p>
                </div>

                {/* Limits */}
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-4 flex-wrap">
                  <span>🛏️ {plan.max_rooms} rooms</span>
                  <span>📅 {plan.max_bookings} bookings</span>
                  <span>👤 {plan.max_users} users</span>
                </div>

                {/* Features List */}
                <div className="space-y-2 mb-6">
                  {(plan.features || []).map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="text-emerald-400">✓</span> {feature}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => handleEditClick(plan)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePlan(plan.id)}
                  className="px-3 py-2.5 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-bold rounded-xl transition"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {isModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 sticky top-0 z-10">
              <h2 className="text-lg font-bold text-white">
                {editingPlan.id ? "Edit Plan" : "Create New Plan"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-xl font-bold">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Plan Name</label>
                  <input
                    type="text"
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
                    placeholder="e.g. Pro"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Description</label>
                  <input
                    type="text"
                    value={editingPlan.description}
                    onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
                    placeholder="e.g. Most popular for growing hotels"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Monthly Price (₹)</label>
                  <input
                    type="number"
                    value={editingPlan.price_monthly}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price_monthly: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Yearly Price (₹)</label>
                  <input
                    type="number"
                    value={editingPlan.price_yearly}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price_yearly: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Max Rooms</label>
                  <input
                    type="number"
                    value={editingPlan.max_rooms}
                    onChange={(e) => setEditingPlan({ ...editingPlan, max_rooms: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Max Bookings</label>
                  <input
                    type="number"
                    value={editingPlan.max_bookings}
                    onChange={(e) => setEditingPlan({ ...editingPlan, max_bookings: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Max Users</label>
                  <input
                    type="number"
                    value={editingPlan.max_users}
                    onChange={(e) => setEditingPlan({ ...editingPlan, max_users: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Features (Comma separated)</label>
                <textarea
                  value={(editingPlan.features || []).join(", ")}
                  onChange={(e) => setEditingPlan({ ...editingPlan, features: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white resize-none"
                  placeholder="e.g. 5 Rooms, 50 bookings/month, 1 user"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.is_popular}
                    onChange={(e) => setEditingPlan({ ...editingPlan, is_popular: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-slate-300">Mark as Popular</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.is_active}
                    onChange={(e) => setEditingPlan({ ...editingPlan, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-slate-300">Active</span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {saving ? "Saving..." : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
