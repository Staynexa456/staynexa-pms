"use client";

import { useState } from "react";

export default function BlockRoomModal({
  rooms,
  initialRoom,
  onClose,
  onSave,
}: {
  rooms: any[];
  initialRoom?: string;
  onClose: () => void;
  onSave: (data: { roomNumber: string; checkIn: string; checkOut: string; reason: string }) => Promise<void>;
}) {
  const [roomNumber, setRoomNumber] = useState(initialRoom || rooms[0]?.room_number || "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!roomNumber || !checkIn || !checkOut) {
      alert("Room, check-in, check-out required");
      return;
    }
    setSaving(true);
    try {
      await onSave({ roomNumber, checkIn, checkOut, reason });
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
        <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50">
          <div>
            <h3 className="text-lg font-bold">🔒 Block Room</h3>
            <p className="text-xs text-gray-500">Prevent bookings for this room</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Room *</label>
            <select value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              {rooms.map((r) => (
                <option key={r.id} value={r.room_number}>{r.room_number} — {r.room_type}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">From *</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">To *</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g., Maintenance, Renovation..." className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
          <button onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? "Blocking..." : "Block Room"}
          </button>
        </div>
      </div>
    </div>
  );
}