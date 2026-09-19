"use client";

import { useState, useEffect } from "react";
import type { Booking, Guest } from "../types";

const ID_TYPES = ["Aadhaar", "PAN", "Passport", "Driving License", "Voter ID"] as const;
type IdType = typeof ID_TYPES[number];

const COUNTRIES = ["India", "USA", "UK", "UAE", "Singapore", "Australia"];
const GENDERS = ["Male", "Female", "Other"];
const CATEGORIES = ["Adult", "Child", "Senior"];

export default function GuestInfoPanel({
  booking,
  onClose,
  onSave,
}: {
  booking: Booking;
  onClose: () => void;
  onSave: (guest: Guest) => Promise<void>;
}) {
  const initialGuest = booking.primaryGuest || (booking as any).guest || {};

  const [form, setForm] = useState<Guest>({
    ...initialGuest,
    name: initialGuest.name || "",
    phone: initialGuest.phone || "",
    email: initialGuest.email || "",
    address: initialGuest.address || "",
    city: initialGuest.city || "",
    state: initialGuest.state || "",
    pincode: initialGuest.pincode || (initialGuest as any).zipCode || "",
  });

  // Load from initial guest if present
  const [idType, setIdType] = useState<IdType>(
    ((initialGuest as any).idType as IdType) || "Aadhaar"
  );
  const [idNumber, setIdNumber] = useState((initialGuest as any).idNumber || "");
  const [country, setCountry] = useState((initialGuest as any).country || "India");
  const [gender, setGender] = useState((initialGuest as any).gender || "Male");
  const [category, setCategory] = useState((initialGuest as any).category || "Adult");
  const [dob, setDob] = useState((initialGuest as any).dob || "");
  const [nationality, setNationality] = useState((initialGuest as any).nationality || "Indian");
  const [occupation, setOccupation] = useState((initialGuest as any).occupation || "");
  const [cameraUpload, setCameraUpload] = useState(false);
  const [doNotRent, setDoNotRent] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState("");

  // Pincode autofill
  const handlePincodeChange = async (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 6);
    setForm((p) => ({ ...p, pincode: clean }));
    setPincodeError("");

    if (clean.length === 6) {
      setPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`);
        const data = await res.json();
        if (data[0]?.Status === "Success" && data[0].PostOffice?.[0]) {
          const po = data[0].PostOffice[0];
          setForm((prev) => ({
            ...prev,
            city: po.District || prev.city,
            state: po.State || prev.state,
          }));
        } else {
          setPincodeError("Invalid pincode");
        }
      } catch {
        setPincodeError("Lookup failed");
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("Guest name is required");
      return;
    }
    setSaving(true);
    try {
      // Send all fields including the new ones
      await onSave({
        ...form,
        // Primary fields
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        // New fields
        idType,
        idNumber: idNumber.trim(),
        country,
        zipCode: form.pincode, // save same value into zipCode column
      } as any);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Guest Information</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">

            {/* Name */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                placeholder="Full name"
              />
            </div>

            {/* ID Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                ID Type
              </label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value as IdType)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
              >
                {ID_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* ID Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                ID Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                placeholder="Enter ID number"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Customer Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                placeholder="email@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Customer Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                placeholder="+91 9876543210"
              />
            </div>

            {/* Address */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Address
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                placeholder="Street address"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                City
              </label>
              <input
                type="text"
                value={form.city}
                readOnly
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-600"
              />
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                State
              </label>
              <input
                type="text"
                value={form.state}
                readOnly
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-600"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Zip Code (Auto-fills City & State)
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={form.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                  placeholder="e.g. 799287"
                />
                {pincodeLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500">
                    Looking up...
                  </span>
                )}
                {form.pincode.length === 6 && !pincodeLoading && !pincodeError && form.city && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600">
                    ✓ {form.city}
                  </span>
                )}
              </div>
              {pincodeError && (
                <p className="text-xs text-red-500 mt-1">{pincodeError}</p>
              )}
            </div>

            {/* Show More Fields */}
            {showMore && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                  >
                    {GENDERS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Guest Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nationality
                  </label>
                  <select
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                  >
                    <option>Indian</option>
                    <option>American</option>
                    <option>British</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </>
            )}

            {/* Toggles */}
            <div className="col-span-2 flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Camera upload?</span>
                <button
                  type="button"
                  onClick={() => setCameraUpload(!cameraUpload)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    cameraUpload ? "bg-gray-800" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      cameraUpload ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Do not Rent</span>
                <button
                  type="button"
                  onClick={() => setDoNotRent(!doNotRent)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    doNotRent ? "bg-red-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      doNotRent ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Upload boxes */}
            <div className="col-span-2 grid grid-cols-2 gap-4 pt-2">
              <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition">
                <input type="file" accept="image/*" className="hidden" />
                <div className="text-2xl mb-2">⬆</div>
                <p className="text-sm font-medium text-gray-700">Upload front id</p>
              </label>
              <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition">
                <input type="file" accept="image/*" className="hidden" />
                <div className="text-2xl mb-2">⬆</div>
                <p className="text-sm font-medium text-gray-700">Upload Back id</p>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <button
            onClick={() => setShowMore(!showMore)}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 underline"
          >
            {showMore ? "Show less" : "More"}
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}