"use client";

import { useState } from "react";

export default function EnquiryModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      alert("Name and phone required");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name, phone, email, checkIn, checkOut, adults, notes });
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-yellow-50">
          <div>
            <h3 className="text-lg font-bold">📝 New Enquiry</h3>
            <p className="text-xs text-gray-500">Guest enquiry — no room assigned yet</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Guest Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Phone *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Check-in</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Check-out</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Adults</label>
              <input type="number" value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" min={1} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
          <button onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-6 py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving..." : "Save Enquiry"}
          </button>
        </div>
      </div>
    </div>
  );
}