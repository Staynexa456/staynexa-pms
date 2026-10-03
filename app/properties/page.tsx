"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { getUserHotels, type Hotel } from "../db";
import { getActiveHotelId, setActiveHotelId } from "../active-hotel";

export default function PropertiesPage() {
  const router = useRouter();
  const [hotels, setHotels] = useState<(Hotel & { userRole?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<"plans" | "details">("plans");
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [editingHotel, setEditingHotel] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadHotels(); }, []);

  async function loadHotels() {
    setLoading(true);
    const data = await getUserHotels();
    setHotels(data);
    setLoading(false);
  }

  async function loadPlans() {
    setPlansLoading(true);
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) console.error("Error loading plans:", error);
    setPlans(data || []);
    setPlansLoading(false);
  }

  const handleAddNew = () => {
    setEditingHotel(null);
    setSelectedPlan(null);
    setModalStep("plans");
    setIsModalOpen(true);
    loadPlans();
  };

  const handleEdit = (hotel: any) => {
    setEditingHotel({ ...hotel });
    setSelectedPlan(null);
    setModalStep("details");
    setIsModalOpen(true);
  };

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setEditingHotel({
      name: "", city: "", state: "", address: "", phone: "", email: "", gst_number: "",
    });
    setModalStep("details");
  };

  const handleChangePlan = () => {
    setModalStep("plans");
  };

  const handleSave = async () => {
    if (!editingHotel || !editingHotel.name) {
      alert("Please enter a property name.");
      return;
    }
    setSaving(true);
    try {
      if (editingHotel.id) {
        // Update existing hotel
        const { error } = await supabase
          .from("hotels")
          .update({
            name: editingHotel.name,
            city: editingHotel.city || null,
            state: editingHotel.state || null,
            address: editingHotel.address || null,
            phone: editingHotel.phone || null,
            email: editingHotel.email || null,
            gst_number: editingHotel.gst_number || null,
          })
          .eq("id", editingHotel.id);
        if (error) throw error;
      } else {
        // Create new hotel
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newHotel, error: hotelErr } = await supabase
          .from("hotels")
          .insert({
            name: editingHotel.name,
            city: editingHotel.city || null,
            state: editingHotel.state || null,
            address: editingHotel.address || null,
            phone: editingHotel.phone || null,
            email: editingHotel.email || null,
            gst_number: editingHotel.gst_number || null,
            owner_id: user?.id || null,
            is_active: true,
          })
          .select()
          .single();
        if (hotelErr) throw hotelErr;

        // ✅ ১. ৫টি ডিফল্ট রুম তৈরি
        const defaultRooms = [
          { room_number: "101", room_type: "Standard Room", base_price: 2000, hotel_id: newHotel.id },
          { room_number: "102", room_type: "Standard Room", base_price: 2000, hotel_id: newHotel.id },
          { room_number: "201", room_type: "Deluxe Room", base_price: 3000, hotel_id: newHotel.id },
          { room_number: "202", room_type: "Deluxe Room", base_price: 3000, hotel_id: newHotel.id },
          { room_number: "301", room_type: "Executive Suite", base_price: 5000, hotel_id: newHotel.id },
        ];
        await supabase.from("rooms").insert(defaultRooms);

        // ✅ ২. room_type_details তৈরি
        const uniqueRoomTypes = ["Standard Room", "Deluxe Room", "Executive Suite"];
        const roomTypeDetails = [
          { hotel_id: newHotel.id, room_type: "Standard Room", description: "Comfortable Standard Room with modern amenities.", base_price: 2000, max_adults: 2, max_children: 1, is_active: true },
          { hotel_id: newHotel.id, room_type: "Deluxe Room", description: "Spacious Deluxe Room with premium furnishings.", base_price: 3000, max_adults: 3, max_children: 1, is_active: true },
          { hotel_id: newHotel.id, room_type: "Executive Suite", description: "Luxurious Executive Suite with city view.", base_price: 5000, max_adults: 4, max_children: 2, is_active: true },
        ];
        await supabase.from("room_type_details").insert(roomTypeDetails);

        // ✅ ৩. rate_plans তৈরি (৪টি প্রতি রুম টাইপে)
        const ratePlans: any[] = [];
        uniqueRoomTypes.forEach((rt) => {
          const basePrice = rt === "Standard Room" ? 2000 : rt === "Deluxe Room" ? 3000 : 5000;
          ratePlans.push(
            { hotel_id: newHotel.id, room_type: rt, code: "EP", name: "European Plan", description: "Room only", price_1a: Math.round(basePrice * 0.85), price_2a: basePrice, price_extra_adult: Math.round(basePrice * 0.35), price_child: Math.round(basePrice * 0.25), is_active: true },
            { hotel_id: newHotel.id, room_type: rt, code: "CP", name: "Continental Plan", description: "Room + Breakfast", price_1a: Math.round(basePrice * 1.1), price_2a: Math.round(basePrice * 1.25), price_extra_adult: Math.round(basePrice * 0.4), price_child: Math.round(basePrice * 0.3), is_active: true },
            { hotel_id: newHotel.id, room_type: rt, code: "MAP", name: "Modified American Plan", description: "Room + Breakfast + 1 Meal", price_1a: Math.round(basePrice * 1.3), price_2a: Math.round(basePrice * 1.5), price_extra_adult: Math.round(basePrice * 0.45), price_child: Math.round(basePrice * 0.35), is_active: true },
            { hotel_id: newHotel.id, room_type: rt, code: "AP", name: "American Plan", description: "All Meals", price_1a: Math.round(basePrice * 1.5), price_2a: Math.round(basePrice * 1.75), price_extra_adult: Math.round(basePrice * 0.5), price_child: Math.round(basePrice * 0.4), is_active: true }
          );
        });
        await supabase.from("rate_plans").insert(ratePlans);

        // ✅ হোটেল মালিককে হোটেলের সাথে লিংক করা
        try {
          await supabase.from("hotel_users").insert({
            user_id: user?.id,
            hotel_id: newHotel.id,
            email: user?.email || "",
            role: "owner",
          });
        } catch (e) { console.warn("hotel_users link warning:", e); }

        // ✅ Email: New property created
        if (user?.email) {
          fetch("/api/emails/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "newPropertyCreated",
              to: user.email,
              data: { propertyName: editingHotel.name, city: editingHotel.city },
            }),
          }).catch((e) => console.warn("[Email] Failed:", e));
        }
      }

      await loadHotels();
      closeModal();
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this property?")) return;
    try {
      const { error } = await supabase.from("hotels").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      await loadHotels();
    } catch (err: any) {
      alert("Failed: " + err.message);
    }
  };

  const handleSwitch = (hotel: Hotel) => {
    setActiveHotelId(hotel.id);
    window.dispatchEvent(new CustomEvent("hotel-changed", { detail: hotel.id }));
    router.push("/");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalStep("plans");
    setSelectedPlan(null);
    setEditingHotel(null);
  };

  if (loading) return <div className="p-6">Loading properties...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Properties</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all your hotels from one account</p>
        </div>
        <button onClick={handleAddNew} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md transition">+ Add New Property</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {hotels.map((hotel) => (
          <div key={hotel.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-800">{hotel.name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hotel.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {hotel.is_active !== false ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">📍 {hotel.city || "No city"}{hotel.state ? `, ${hotel.state}` : ""}</p>
              <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-4">
                {hotel.phone && <p>📞 {hotel.phone}</p>}
                {hotel.email && <p>✉️ {hotel.email}</p>}
                {hotel.gst_number && <p>🏢 GST: {hotel.gst_number}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleSwitch(hotel)} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition">Open Dashboard →</button>
              <button onClick={() => handleEdit(hotel)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition">Edit</button>
              <button onClick={() => handleDelete(hotel.id)} className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition">✕</button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {modalStep === "plans" && (
              <>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Choose Your Plan</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Select a subscription plan for your new property</p>
                  </div>
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
                </div>
                <div className="p-6">
                  {plansLoading ? (
                    <div className="text-center py-12">
                      <div className="w-10 h-10 mx-auto mb-3 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
                      <p className="text-sm text-slate-500">Loading plans...</p>
                    </div>
                  ) : plans.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p className="text-3xl mb-2">📋</p>
                      <p>No plans available. Please contact admin.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {plans.map((plan) => (
                        <div key={plan.id} className={`relative p-5 border-2 rounded-2xl flex flex-col justify-between transition-all hover:shadow-lg ${plan.is_popular ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-slate-200"}`}>
                          {plan.is_popular && (
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Most Popular</div>
                          )}
                          <div>
                            <h3 className="text-base font-bold text-slate-800">{plan.name}</h3>
                            <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">{plan.description}</p>
                            <div className="mb-4">
                              <span className="text-2xl font-bold text-slate-900">₹{plan.price_monthly}</span>
                              <span className="text-xs text-slate-500">/mo</span>
                            </div>
                            <div className="space-y-1 mb-4">
                              {(plan.features || []).slice(0, 4).map((feature: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                                  <span className="text-emerald-500 shrink-0">✓</span>
                                  <span className="truncate">{feature}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => handleSelectPlan(plan)} className={`w-full py-2.5 rounded-xl text-xs font-bold transition ${plan.is_popular ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "bg-teal-600 text-white hover:bg-teal-700"}`}>Select {plan.name}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {modalStep === "details" && editingHotel && (
              <>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    {!editingHotel.id && (
                      <button onClick={handleChangePlan} className="text-slate-400 hover:text-teal-600 text-sm font-bold">←</button>
                    )}
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">{editingHotel.id ? "Edit Property" : "Add New Property"}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{editingHotel.id ? "Update your property details" : "Enter your new property details"}</p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
                </div>

                {!editingHotel.id && selectedPlan && (
                  <div className="px-6 pt-6">
                    <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border-2 border-teal-200 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white text-lg shadow-md">💎</div>
                        <div>
                          <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Selected Plan</p>
                          <p className="text-base font-bold text-slate-800">{selectedPlan.name}</p>
                          <p className="text-xs text-slate-600">₹{selectedPlan.price_monthly}/month · {selectedPlan.max_rooms} rooms</p>
                        </div>
                      </div>
                      <button onClick={handleChangePlan} className="text-xs font-bold text-teal-700 hover:text-teal-900 px-3 py-1.5 rounded-lg hover:bg-white transition">Change</button>
                    </div>
                  </div>
                )}

                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Property Name *</label>
                    <input type="text" value={editingHotel.name || ""} onChange={(e) => setEditingHotel({ ...editingHotel, name: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="e.g. The Grand Palace Hotel" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">City</label>
                      <input type="text" value={editingHotel.city || ""} onChange={(e) => setEditingHotel({ ...editingHotel, city: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="Bengaluru" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">State</label>
                      <input type="text" value={editingHotel.state || ""} onChange={(e) => setEditingHotel({ ...editingHotel, state: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="Karnataka" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Full Address</label>
                    <input type="text" value={editingHotel.address || ""} onChange={(e) => setEditingHotel({ ...editingHotel, address: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="123 Main Street, Area" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Phone</label>
                      <input type="text" value={editingHotel.phone || ""} onChange={(e) => setEditingHotel({ ...editingHotel, phone: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="+91 98765 43210" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Email</label>
                      <input type="email" value={editingHotel.email || ""} onChange={(e) => setEditingHotel({ ...editingHotel, email: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="hello@hotel.com" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">GST Number (Optional)</label>
                    <input type="text" value={editingHotel.gst_number || ""} onChange={(e) => setEditingHotel({ ...editingHotel, gst_number: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" placeholder="29ABCDE1234F1Z5" />
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                    <span className="text-amber-500 text-sm">💡</span>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      We'll auto-create 5 default rooms (101, 102, 201, 202, 301), 3 room types, and 12 rate plans so you can start taking bookings immediately.
                    </p>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
                  <button onClick={closeModal} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition">Cancel</button>
                  <button onClick={handleSave} disabled={saving || !editingHotel.name} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition shadow-lg shadow-teal-600/20">
                    {saving ? "Saving..." : (editingHotel.id ? "Save Changes" : "Create Property")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
