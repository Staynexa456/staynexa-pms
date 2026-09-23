"use client";

import React, { useState, useEffect } from "react";
import type { InventoryRoom } from "../lib/inventory";

type Props = {
  hotelId: string;
  existingRoomTypes: string[];
  editingRoom?: InventoryRoom | null;
  onClose: () => void;
  onSave: (data: {
    room_number: string;
    room_type: string;
    base_price: number;
  }) => Promise<void>;
};

export default function AddRoomModal({
  hotelId,
  existingRoomTypes,
  editingRoom,
  onClose,
  onSave,
}: Props) {
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState(existingRoomTypes[0] || "Standard Room");
  const [newRoomType, setNewRoomType] = useState("");
  const [basePrice, setBasePrice] = useState("2500");
  const [useCustomType, setUseCustomType] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingRoom) {
      setRoomNumber(editingRoom.room_number);
      setRoomType(editingRoom.room_type);
      setBasePrice(String(editingRoom.base_price || 0));
      if (!existingRoomTypes.includes(editingRoom.room_type)) {
        setUseCustomType(true);
        setNewRoomType(editingRoom.room_type);
      }
    }
  }, [editingRoom, existingRoomTypes]);

  const handleSave = async () => {
    if (!roomNumber.trim()) {
      alert("Room number is required");
      return;
    }
    const finalType = useCustomType ? newRoomType.trim() : roomType;
    if (!finalType) {
      alert("Room type is required");
      return;
    }
    const priceNum = Number(basePrice) || 0;
    if (priceNum < 0) {
      alert("Base price must be positive");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        room_number: roomNumber.trim(),
        room_type: finalType,
        base_price: priceNum,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl">
              {editingRoom ? "✏️" : "➕"}
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">
                {editingRoom ? "Edit Room" : "Add New Room"}
              </h3>
              <p className="text-slate-300 text-xs mt-0.5">
                {editingRoom
                  ? `Room ${editingRoom.room_number}`
                  : "Create a new room in your property"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Room Number *
            </label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g., 101, A-201, Suite-01"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Room Type *
              </label>
              <button
                onClick={() => setUseCustomType(!useCustomType)}
                className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider"
              >
                {useCustomType ? "← Use Existing" : "+ Custom Type"}
              </button>
            </div>

            {useCustomType ? (
              <input
                type="text"
                value={newRoomType}
                onChange={(e) => setNewRoomType(e.target.value)}
                placeholder="e.g., Presidential Suite"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              />
            ) : (
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              >
                {existingRoomTypes.length === 0 && (
                  <option value="Standard Room">Standard Room</option>
                )}
                {existingRoomTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Base Price (₹) *
            </label>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="e.g., 2500"
              min={0}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 font-bold"
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              💡 এই base price থেকে 5টি occupancy tier auto-calculate হবে rate calendar-এ
            </p>
          </div>

          {/* Live Preview */}
          <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl border border-teal-200">
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-2">
              📊 Auto-Calculated Rate Preview
            </p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { label: "1 Adult", pct: 85 },
                { label: "2 Adults", pct: 100 },
                { label: "Extra", pct: 35 },
                { label: "Child 7-12", pct: 25 },
                { label: "Child 0-6", pct: 15 },
              ].map((occ) => {
                const price = Math.round((Number(basePrice) || 0) * occ.pct / 100);
                return (
                  <div key={occ.label} className="bg-white rounded-lg p-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">
                      {occ.label}
                    </p>
                    <p className="text-sm font-bold text-teal-700 mt-1">
                      ₹{price.toLocaleString("en-IN")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !roomNumber.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : editingRoom ? "Update Room" : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  );
}