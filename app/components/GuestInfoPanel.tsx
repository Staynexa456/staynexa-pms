"use client";

import { useState } from "react";
import type { Booking, Guest } from "../types";

export default function GuestInfoPanel({
  booking,
  onClose,
  onSave,
}: {
  booking: Booking;
  onClose: () => void;
  onSave: (guest: Guest) => void;
}) {
  const [formData, setFormData] = useState<Guest>({
    ...booking.primaryGuest,
  });
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setFormData((prev) => ({ ...prev, pincode: value }));

    if (value.length === 6) {
      setIsPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${value}`);
        const data = await res.json();
        if (data[0]?.Status === "Success") {
          const postOffice = data[0].PostOffice[0];
          setFormData((prev) => ({
            ...prev,
            city: postOffice.District || "",
            state: postOffice.State || "",
          }));
        }
      } catch (err) {
        console.error("Pincode fetch failed", err);
      } finally {
        setIsPincodeLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-[600px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-navy">Edit Guest Information</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl">✕</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Full Name *</label>
              <input type="text" value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="border p-2 rounded w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ID Type</label>
              <select value={formData.idType || "Aadhaar"} onChange={(e) => setFormData({ ...formData, idType: e.target.value })} className="border p-2 rounded w-full">
                <option value="Aadhaar">Aadhaar</option>
                <option value="PAN">PAN</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
                <option value="Voter ID">Voter ID</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Phone *</label>
              <input type="tel" value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="border p-2 rounded w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
              <input type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="border p-2 rounded w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Pincode (Auto-fills City & State)</label>
            <input type="text" maxLength={6} value={formData.pincode || ""} onChange={handlePincodeChange} className="border p-2 rounded w-full" placeholder="Enter 6-digit Pincode" />
            {isPincodeLoading && <span className="text-xs text-blue-500 mt-1">Looking up location...</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">City</label>
              <input type="text" value={formData.city || ""} readOnly className="border p-2 rounded w-full bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">State</label>
              <input type="text" value={formData.state || ""} readOnly className="border p-2 rounded w-full bg-gray-50" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Address</label>
            <textarea value={formData.address || ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="border p-2 rounded w-full" rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-navy hover:bg-cream">Cancel</button>
          <button onClick={() => onSave(formData)} className="px-5 py-2 bg-navy text-white rounded-lg hover:bg-navy-light font-semibold">Save Guest</button>
        </div>
      </div>
    </div>
  );
}
