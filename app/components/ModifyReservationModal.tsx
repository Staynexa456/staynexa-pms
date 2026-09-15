"use client";

import { useState } from "react";
import type { Booking } from "../types";

export default function ModifyReservationModal({
  booking,
  onClose,
  onSave,
}: {
  booking: Booking;
  onClose: () => void;
  onSave: (data: {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    amount: number;
    ratePlan: string;
  }) => Promise<void>;
}) {
  const [checkIn, setCheckIn] = useState(booking.checkIn);
  const [checkOut, setCheckOut] = useState(booking.checkOut);
  const [adults, setAdults] = useState(booking.adults);
  const [children, setChildren] = useState(booking.children);
  const [amount, setAmount] = useState(booking.amount);
  const [ratePlan, setRatePlan] = useState(booking.ratePlan || "EP");
  const [saving, setSaving] = useState(false);

  const nights = Math.max(
    1,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Modify Reservation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Guest summary */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Guest</p>
            <p className="font-semibold text-gray-900">{booking.primaryGuest.name}</p>
            <p className="text-sm text-gray-500 mt-0.5">{booking.primaryGuest.phone}</p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Check-in
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Check-out
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Nights display */}
          <div className="bg-teal-50 border border-teal-100 rounded-md px-3 py-2">
            <p className="text-sm text-teal-700">
              🌙 <strong>{nights}</strong> night{nights === 1 ? "" : "s"}
            </p>
          </div>

          {/* Guests */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Adults
              </label>
              <input
                type="number"
                min={1}
                value={adults}
                onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Children
              </label>
              <input
                type="number"
                min={0}
                value={children}
                onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Rate Plan */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Rate Plan
            </label>
            <select
              value={ratePlan}
              onChange={(e) => setRatePlan(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500"
            >
              <option value="EP">EP — European Plan (Room only)</option>
              <option value="CP">CP — Continental Plan (Room + Breakfast)</option>
              <option value="MAP">MAP — Modified American Plan</option>
              <option value="AP">AP — American Plan (All meals)</option>
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Total Amount (₹)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 text-base font-medium"
            />
            <p className="text-xs text-gray-500 mt-1">
              Per night: ₹{nights > 0 ? (amount / nights).toFixed(2) : "0.00"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-white transition"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ checkIn, checkOut, adults, children, amount, ratePlan });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
