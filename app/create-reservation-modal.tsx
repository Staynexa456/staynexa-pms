// app/create-reservation-modal.tsx
"use client";

import React, { useState, useEffect } from "react";
import type { Guest, Booking } from "./types";

export type ReservationFormData = {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  ratePlan: string;
  source: string;
  primaryGuest: Guest;
  adults: number;
  children: number;
  infants: number;
  amount: number;
  tax: number;
  notes: string;
};

type Props = {
  initialRoom?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  onClose: () => void;
  onSubmit: (data: ReservationFormData) => Promise<void>;
  onBlockRoom?: (data: { roomNumber: string; checkIn: string; checkOut: string; reason: string }) => Promise<void>;
};

export default function CreateReservationModal({
  initialRoom,
  initialCheckIn,
  initialCheckOut,
  onClose,
  onSubmit,
  onBlockRoom,
}: Props) {
  const [form, setForm] = useState<ReservationFormData>({
    roomNumber: initialRoom || "",
    checkIn: initialCheckIn || "",
    checkOut: initialCheckOut || "",
    ratePlan: "EP",
    source: "direct",
    primaryGuest: {
      name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "",
    },
    adults: 1,
    children: 0,
    infants: 0,
    amount: 2500,
    tax: 0,
    notes: "",
  });

  const [blockMode, setBlockMode] = useState(false);
  const [blockReason, setBlockReason] = useState("Maintenance");

  const handleSubmit = async () => {
    if (blockMode && onBlockRoom) {
      await onBlockRoom({
        roomNumber: form.roomNumber,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        reason: blockReason,
      });
    } else {
      await onSubmit(form);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[700px] max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-navy">
            {blockMode ? "Block Room" : "Create Reservation"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Room Number</label>
              <input
                type="text"
                value={form.roomNumber}
                onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Rate Plan</label>
              <select
                value={form.ratePlan}
                onChange={(e) => setForm({ ...form, ratePlan: e.target.value })}
                className="border p-2 rounded w-full"
              >
                <option value="EP">EP</option>
                <option value="CP">CP</option>
                <option value="MAP">MAP</option>
                <option value="AP">AP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Check-In</label>
              <input
                type="date"
                value={form.checkIn}
                onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Check-Out</label>
              <input
                type="date"
                value={form.checkOut}
                onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>
          </div>

          {blockMode ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Block Reason</label>
              <select
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="Maintenance">Maintenance</option>
                <option value="Out of order">Out of order</option>
                <option value="Renovation">Renovation</option>
                <option value="Hold for owner">Hold for owner</option>
              </select>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Guest Name</label>
                  <input
                    type="text"
                    value={form.primaryGuest.name}
                    onChange={(e) => setForm({ ...form, primaryGuest: { ...form.primaryGuest, name: e.target.value } })}
                    className="border p-2 rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.primaryGuest.phone}
                    onChange={(e) => setForm({ ...form, primaryGuest: { ...form.primaryGuest, phone: e.target.value } })}
                    className="border p-2 rounded w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Adults</label>
                  <input
                    type="number"
                    min={1}
                    value={form.adults}
                    onChange={(e) => setForm({ ...form, adults: parseInt(e.target.value) || 1 })}
                    className="border p-2 rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Children</label>
                  <input
                    type="number"
                    min={0}
                    value={form.children}
                    onChange={(e) => setForm({ ...form, children: parseInt(e.target.value) || 0 })}
                    className="border p-2 rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Infants</label>
                  <input
                    type="number"
                    min={0}
                    value={form.infants}
                    onChange={(e) => setForm({ ...form, infants: parseInt(e.target.value) || 0 })}
                    className="border p-2 rounded w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Amount (excl. tax)</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    className="border p-2 rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tax</label>
                  <input
                    type="number"
                    value={form.tax}
                    onChange={(e) => setForm({ ...form, tax: parseFloat(e.target.value) || 0 })}
                    className="border p-2 rounded w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="border p-2 rounded w-full"
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t flex justify-between items-center">
          {!blockMode && onBlockRoom && (
            <button
              onClick={() => setBlockMode(true)}
              className="text-sm text-rose-600 hover:underline"
            >
              Block room instead?
            </button>
          )}
          {blockMode && (
            <button
              onClick={() => setBlockMode(false)}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to reservation
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-navy hover:bg-cream">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className={`px-5 py-2 rounded-lg text-white font-semibold ${blockMode ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-500 hover:bg-emerald-600"}`}
            >
              {blockMode ? "Block Room" : "Create Reservation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
