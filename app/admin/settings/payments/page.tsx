"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../supabase";

export default function AdminPaymentSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase.from("platform_payment_settings").select("*").maybeSingle();
    setSettings(data || { active_gateway: "upi", upi_id: "", upi_name: "" });
    setLoading(false);
  }

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const payload = {
        active_gateway: settings.active_gateway,
        upi_id: settings.upi_id,
        upi_name: settings.upi_name,
        razorpay_key_id: settings.razorpay_key_id,
        razorpay_key_secret: settings.razorpay_key_secret,
        cashfree_app_id: settings.cashfree_app_id,
        cashfree_secret_key: settings.cashfree_secret_key,
        updated_at: new Date().toISOString(),
      };

      if (settings.id) {
        await supabase.from("platform_payment_settings").update(payload).eq("id", settings.id);
      } else {
        await supabase.from("platform_payment_settings").insert(payload);
      }
      alert("Settings saved successfully!");
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-white bg-slate-950 min-h-screen">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto bg-slate-950 min-h-screen text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Payment Gateway Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure how hotels pay for their features and subscriptions.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        
        {/* Active Gateway Selection */}
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Active Payment Gateway</label>
          <select
            value={settings.active_gateway}
            onChange={(e) => setSettings({ ...settings, active_gateway: e.target.value })}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
          >
            <option value="upi">UPI Only (Direct Transfer)</option>
            <option value="razorpay">Razorpay (Cards, Netbanking, UPI)</option>
            <option value="cashfree">Cashfree (Coming Soon)</option>
          </select>
          <p className="text-xs text-slate-500 mt-2">
            {settings.active_gateway === 'upi' 
              ? "⚠️ Direct UPI requires manual verification. You must check your bank statement and match the UTR number before approving."
              : "✅ Automated payment verification. Requires API keys below."}
          </p>
        </div>

        {/* UPI Settings */}
        {settings.active_gateway === 'upi' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">UPI ID (VPA)</label>
              <input
                type="text"
                value={settings.upi_id || ""}
                onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })}
                placeholder="e.g. staynexa@okicici"
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">This is the UPI ID where you will receive payments.</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Business Name (for UPI)</label>
              <input
                type="text"
                value={settings.upi_name || ""}
                onChange={(e) => setSettings({ ...settings, upi_name: e.target.value })}
                placeholder="e.g. Staynexa PMS"
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
              />
            </div>
          </div>
        )}

        {/* Razorpay Settings (For Future) */}
        {settings.active_gateway === 'razorpay' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Razorpay Key ID</label>
              <input
                type="text"
                value={settings.razorpay_key_id || ""}
                onChange={(e) => setSettings({ ...settings, razorpay_key_id: e.target.value })}
                placeholder="rzp_live_..."
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Razorpay Key Secret</label>
              <input
                type="password"
                value={settings.razorpay_key_secret || ""}
                onChange={(e) => setSettings({ ...settings, razorpay_key_secret: e.target.value })}
                placeholder="••••••••••••••••"
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none text-white"
              />
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "✓ Save Payment Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
