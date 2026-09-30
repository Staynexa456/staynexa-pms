"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { useActiveHotel } from "../../lib/use-active-hotel";
import { uploadHeroBanner } from "../../lib/booking-engine"; // ছবি আপলোডের জন্য

export default function RoomTypeDetailsPage() {
  const { hotelId } = useActiveHotel();
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]); // আপলোড করা ছবির লিস্ট

  useEffect(() => { if (hotelId) loadRoomTypes(); }, [hotelId]);

  async function loadRoomTypes() {
    setLoading(true);
    // ১. প্রথমে room_type_details থেকে ডেটা আনার চেষ্টা করুন
    const { data: details } = await supabase
      .from("room_type_details")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("room_type");

    // ২. যদি খালি থাকে, তাহলে rooms টেবিল থেকে ইউনিক রুম টাইপ বের করে আনুন
    if (!details || details.length === 0) {
      const { data: rooms } = await supabase
        .from("rooms")
        .select("room_type, base_price, max_adults, max_children, max_infants, bed_type, bed_count, room_size, view_type, floor_type, description, amenities, photos")
        .eq("hotel_id", hotelId);

      const uniqueTypes = new Map();
      (rooms || []).forEach((r: any) => {
        if (!uniqueTypes.has(r.room_type)) {
          uniqueTypes.set(r.room_type, {
            room_type: r.room_type,
            description: r.description || "",
            base_price: r.base_price || 0,
            max_adults: r.max_adults || 2,
            max_children: r.max_children || 0,
            max_infants: r.max_infants || 0,
            bed_type: r.bed_type || "",
            bed_count: r.bed_count || 1,
            room_size: r.room_size || "",
            view_type: r.view_type || "",
            floor_type: r.floor_type || "",
            amenities: Array.isArray(r.amenities) ? r.amenities : [],
            photos: Array.isArray(r.photos) ? r.photos : [],
            is_active: true,
          });
        }
      });
      setRoomTypes(Array.from(uniqueTypes.values()));
    } else {
      setRoomTypes(details);
    }
    setLoading(false);
  }

  const handleEditClick = (room: any) => {
    setEditingRoom({
      ...room,
      amenities: Array.isArray(room.amenities) ? room.amenities.join(", ") : (room.amenities || ""),
    });
    setPhotoUrls(Array.isArray(room.photos) ? room.photos : []);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingRoom({
      room_type: "",
      description: "",
      base_price: 0,
      max_adults: 2,
      max_children: 0,
      max_infants: 0,
      bed_type: "",
      bed_count: 1,
      room_size: "",
      view_type: "",
      floor_type: "",
      amenities: "",
      is_active: true,
    });
    setPhotoUrls([]);
    setIsModalOpen(true);
  };

  // ✅ ছবি আপলোড করার ফাংশন
  const handlePhotoUpload = async (file: File) => {
    if (!hotelId || !file) return;
    setUploading(true);
    try {
      const url = await uploadHeroBanner(file, hotelId);
      setPhotoUrls((prev) => [...prev, url]);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // ✅ ছবি রিমুভ করার ফাংশন
  const removePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!editingRoom || !hotelId || !editingRoom.room_type) {
      alert("Please enter a room type name.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        hotel_id: hotelId,
        room_type: editingRoom.room_type,
        description: editingRoom.description || null,
        base_price: Number(editingRoom.base_price) || 0, // বেস প্রাইস ডেটাবেসে সেভ হবে ফলব্যাক হিসেবে
        max_adults: Number(editingRoom.max_adults) || 2,
        max_children: Number(editingRoom.max_children) || 0,
        max_infants: Number(editingRoom.max_infants) || 0,
        bed_type: editingRoom.bed_type || null,
        bed_count: Number(editingRoom.bed_count) || 1,
        room_size: editingRoom.room_size || null,
        view_type: editingRoom.view_type || null,
        floor_type: editingRoom.floor_type || null,
        amenities: editingRoom.amenities.split(",").map((s: string) => s.trim()).filter(Boolean),
        photos: photoUrls, // আপলোড করা ছবিগুলো এখানে সেভ হবে
        is_active: editingRoom.is_active,
        updated_at: new Date().toISOString(),
      };

      // ১. room_type_details টেবিলে সেভ করা
      const { error } = await supabase
        .from("room_type_details")
        .upsert(payload, { onConflict: "hotel_id,room_type" });
      
      if (error) throw error;

      // ২. rooms টেবিলেও সিঙ্ক করা (যাতে বুকিং ইঞ্জিন ফলব্যাক পায়)
      await supabase
        .from("rooms")
        .update({
          description: payload.description,
          max_adults: payload.max_adults,
          max_children: payload.max_children,
          max_infants: payload.max_infants,
          bed_type: payload.bed_type,
          bed_count: payload.bed_count,
          room_size: payload.room_size,
          view_type: payload.view_type,
          floor_type: payload.floor_type,
          amenities: payload.amenities,
          photos: payload.photos,
        })
        .eq("hotel_id", hotelId)
        .eq("room_type", editingRoom.room_type);

      // ৩. ক্যাশ রিভ্যালিডেট করা (রিয়েল-টাইম আপডেটের জন্য)
      await fetch('/api/revalidate', { method: 'POST' }).catch(() => {});

      await loadRoomTypes();
      setIsModalOpen(false);
      setEditingRoom(null);
      setPhotoUrls([]);
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading room types...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Room Type Details</h1>
          <p className="text-sm text-slate-500">Manage descriptions, photos, amenities, sizes for your booking engine.</p>
        </div>
        <button
          onClick={handleAddClick}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md transition"
        >
          + Add Room Type
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roomTypes.map((room, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-slate-800">{room.room_type}</h3>
                {!room.is_active && <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">INACTIVE</span>}
              </div>
              <p className="text-xs text-slate-500 mb-3 line-clamp-2">{room.description || "No description set."}</p>
              
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-600 mb-3 bg-slate-50 p-3 rounded-xl">
                <span>💰 Starting from ₹{room.base_price}/night</span>
                <span>👤 {room.max_adults} Adults</span>
                {room.max_children > 0 && <span>🧒 {room.max_children} Children</span>}
                {room.room_size && <span>📐 {room.room_size}</span>}
                {room.view_type && <span>👁️ {room.view_type}</span>}
                {room.bed_type && <span>🛏️ {room.bed_type}</span>}
              </div>

              {room.amenities && Array.isArray(room.amenities) && room.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {room.amenities.slice(0, 5).map((a: string, i: number) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold">✓ {a}</span>
                  ))}
                  {room.amenities.length > 5 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">+{room.amenities.length - 5}</span>}
                </div>
              )}

              {room.photos && Array.isArray(room.photos) && room.photos.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {room.photos.slice(0, 4).map((url: string, i: number) => (
                    <img key={i} src={url} alt="Room" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => handleEditClick(room)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition mt-2"
            >
              ✏️ Edit Details
            </button>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h2 className="text-lg font-bold text-slate-800">{editingRoom.id ? "Edit Room Type" : "Add Room Type"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Room Type Name *</label>
                  <input
                    type="text"
                    value={editingRoom.room_type}
                    onChange={(e) => setEditingRoom({ ...editingRoom, room_type: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none"
                    placeholder="e.g. Deluxe Room"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Base Price (₹/night)</label>
                  <input
                    type="number"
                    value={editingRoom.base_price}
                    readOnly
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed outline-none"
                  />
                  <p className="text-[10px] text-amber-600 mt-1">⚠️ Price is managed on the Rates page. This is only a fallback.</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Description</label>
                <textarea
                  value={editingRoom.description || ""}
                  onChange={(e) => setEditingRoom({ ...editingRoom, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none resize-none"
                  placeholder="Describe the room for guests..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Max Adults</label>
                  <input type="number" value={editingRoom.max_adults} onChange={(e) => setEditingRoom({ ...editingRoom, max_adults: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Max Children</label>
                  <input type="number" value={editingRoom.max_children} onChange={(e) => setEditingRoom({ ...editingRoom, max_children: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Max Infants</label>
                  <input type="number" value={editingRoom.max_infants} onChange={(e) => setEditingRoom({ ...editingRoom, max_infants: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Bed Type</label>
                  <input type="text" value={editingRoom.bed_type || ""} onChange={(e) => setEditingRoom({ ...editingRoom, bed_type: e.target.value })} placeholder="King / Queen" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Bed Count</label>
                  <input type="number" value={editingRoom.bed_count} onChange={(e) => setEditingRoom({ ...editingRoom, bed_count: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Room Size</label>
                  <input type="text" value={editingRoom.room_size || ""} onChange={(e) => setEditingRoom({ ...editingRoom, room_size: e.target.value })} placeholder="e.g. 300 sqft" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">View Type</label>
                  <input type="text" value={editingRoom.view_type || ""} onChange={(e) => setEditingRoom({ ...editingRoom, view_type: e.target.value })} placeholder="e.g. City View / Garden" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Floor Type</label>
                  <input type="text" value={editingRoom.floor_type || ""} onChange={(e) => setEditingRoom({ ...editingRoom, floor_type: e.target.value })} placeholder="e.g. High Floor" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Amenities (Comma separated)</label>
                <input type="text" value={editingRoom.amenities} onChange={(e) => setEditingRoom({ ...editingRoom, amenities: e.target.value })} placeholder="WiFi, AC, TV, Hot Water, Mini Bar" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 outline-none" />
              </div>

              {/* ✅ Photo Upload Section */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Photos</label>
                <div className="flex gap-2 mb-3">
                  <label className="px-4 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-teal-700 transition flex items-center gap-2">
                    {uploading ? "Uploading..." : "📤 Upload Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {photoUrls.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {photoUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="Room" className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editingRoom.is_active} onChange={(e) => setEditingRoom({ ...editingRoom, is_active: e.target.checked })} className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-sm font-medium text-slate-700">Show in Booking Engine</span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition">
                {saving ? "Saving..." : "Save Details"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
