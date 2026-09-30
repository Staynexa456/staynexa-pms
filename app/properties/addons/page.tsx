"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { useActiveHotel } from "../../lib/use-active-hotel";

export default function HotelAddonsPage() {
  const { hotelId } = useActiveHotel();
  const [modules, setModules] = useState<any[]>([]);
  const [myFeatures, setMyFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paySettings, setPaySettings] = useState<any>(null);
  
  // Payment Modal States
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (hotelId) load(); }, [hotelId]);

  async function load() {
    setLoading(true);
    const { data: m } = await supabase.from("feature_modules").select("*").eq("is_active", true).order("display_order");
    const { data: f } = await supabase.from("hotel_features").select("*").eq("hotel_id", hotelId);
    const { data: p } = await supabase.from("platform_payment_settings").select("*").maybeSingle();
    
    setModules(m || []);
    setMyFeatures(f || []);
    setPaySettings(p || { active_gateway: 'upi', upi_id: '', upi_name: '' });
    setLoading(false);
  }

  // ✅ UPI পেমেন্ট মডাল ওপেন করা
  const handleBuyClick = (module: any) => {
    setSelectedFeature(module);
    setUtrNumber("");
  };

  // ✅ UTR সাবমিট করা (পেমেন্ট রিকোয়েস্ট পাঠানো)
  const handleSubmitUtr = async () => {
    if (!utrNumber || utrNumber.length < 8) {
      alert("Please enter a valid 12-digit UTR number.");
      return;
    }
    if (!selectedFeature || !hotelId) return;

    setSubmitting(true);
    try {
      // ১. feature_requests টেবিলে রিকোয়েস্ট পাঠানো
      const { error } = await supabase.from("feature_requests").insert({
        hotel_id: hotelId,
        feature_code: selectedFeature.code,
        status: "pending",
        payment_status: "pending_verification",
        payment_id: utrNumber,
        amount_paid: selectedFeature.price_monthly,
        notes: `Paid via UPI. UTR: ${utrNumber}`,
      });

      if (error) throw error;

      alert("Payment submitted! Admin will verify your UTR and activate the feature shortly.");
      setSelectedFeature(null);
      load();
    } catch (err: any) {
      alert("Failed to submit: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ ডাইনামিক UPI লিংক তৈরি করা (GPay/PhonePe/Paytm ওপেন করার জন্য)
  const generateUpiLink = () => {
    if (!selectedFeature || !paySettings?.upi_id) return "#";
    const amount = selectedFeature.price_monthly;
    const name = encodeURIComponent(paySettings.upi_name || "Staynexa");
    const note = encodeURIComponent(`Payment for ${selectedFeature.name}`);
    return `upi://pay?pa=${paySettings.upi_id}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
  };

  // ✅ ডাইনামিক QR কোড ইমেজ URL
  const generateQrUrl = () => {
    const upiLink = generateUpiLink();
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
  };

  if (loading) return <div className="p-6">Loading add-ons...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Add-ons & Features</h1>
        <p className="text-sm text-slate-500 mt-1">Select the features you want to enable for your hotel.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map(m => {
          const owned = myFeatures.find(f => f.feature_code === m.code && f.is_enabled);
          return (
            <div key={m.code} className={`p-6 border-2 rounded-2xl flex flex-col justify-between transition-all ${owned ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:shadow-lg"}`}>
              <div>
                <p className="text-3xl mb-3">{m.icon}</p>
                <h3 className="font-bold text-lg text-slate-800">{m.name}</h3>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">{m.description}</p>
              </div>
              <div>
                <p className="font-bold text-slate-800 mb-3 text-lg">₹{m.price_monthly}<span className="text-sm font-normal text-slate-500">/month</span></p>
                {owned ? (
                  <span className="block text-center text-emerald-700 font-bold text-sm bg-emerald-100 py-3 rounded-xl">✓ Active</span>
                ) : (
                  <button
                    onClick={() => handleBuyClick(m)}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-teal-600/20"
                  >
                    Pay & Buy Now
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ✅ UPI Payment Modal */}
      {selectedFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedFeature(null)} />
          
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Pay with UPI</h2>
              <button onClick={() => setSelectedFeature(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div className="p-6 flex flex-col items-center text-center">
              <p className="text-sm text-slate-500 mb-1">Paying for</p>
              <p className="text-lg font-bold text-slate-800 mb-4">{selectedFeature.name}</p>
              <p className="text-3xl font-bold text-teal-600 mb-6">₹{selectedFeature.price_monthly}</p>

              {/* QR Code */}
              {paySettings?.upi_id && paySettings.upi_id !== 'yourupi@upi' ? (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4">
                  <img src={generateQrUrl()} alt="UPI QR Code" className="w-48 h-48 mx-auto" />
                  <p className="text-[10px] text-slate-400 mt-2 font-mono">Scan with any UPI App</p>
                </div>
              ) : (
                <div className="bg-amber-50 text-amber-700 text-xs p-4 rounded-xl mb-4">
                  ⚠️ UPI ID not configured in Admin Panel. Please contact support.
                </div>
              )}

              {/* UPI ID Display */}
              {paySettings?.upi_id && (
                <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl mb-6">
                  <span className="text-xs text-slate-500">UPI ID:</span>
                  <span className="text-sm font-bold font-mono text-slate-800">{paySettings.upi_id}</span>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(paySettings.upi_id); alert("Copied!"); }}
                    className="text-[10px] text-teal-600 font-bold ml-2"
                  >
                    Copy
                  </button>
                </div>
              )}

              {/* Deep Link Button */}
              {paySettings?.upi_id && paySettings.upi_id !== 'yourupi@upi' && (
                <a
                  href={generateUpiLink()}
                  className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-teal-500/30 mb-4 block"
                >
                  📱 Pay via GPay / PhonePe / Paytm
                </a>
              )}

              <div className="w-full border-t border-slate-100 pt-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block text-left">
                  Enter 12-digit UTR / Transaction ID
                </label>
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="e.g. 123456789012"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-center font-mono tracking-widest"
                />
                <p className="text-[10px] text-slate-400 mt-1 text-left">
                  After paying, copy the UTR from your UPI app and paste it here.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => setSelectedFeature(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitUtr}
                disabled={submitting || !utrNumber}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition"
              >
                {submitting ? "Submitting..." : "Submit Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
