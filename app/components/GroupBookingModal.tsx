"use client";

import { useState } from "react";

type RoomRow = { roomNumber: string; adults: number; rate: number };

export default function GroupBookingModal({
  rooms,
  onClose,
  onSave,
}: {
  rooms: any[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [groupName, setGroupName] = useState("");
  const [primaryGuest, setPrimaryGuest] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [roomRows, setRoomRows] = useState<RoomRow[]>([
    { roomNumber: rooms[0]?.room_number || "", adults: 1, rate: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const addRoom = () => {
    const used = new Set(roomRows.map((r) => r.roomNumber));
    const next = rooms.find((r) => !used.has(r.room_number));
    if (next) setRoomRows([...roomRows, { roomNumber: next.room_number, adults: 1, rate: 0 }]);
  };

  const updateRow = (idx: number, patch: Partial<RoomRow>) => {
    setRoomRows(roomRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => setRoomRows(roomRows.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!groupName.trim() || !primaryGuest.trim() || !phone.trim() || !checkIn || !checkOut) {
      alert("Please fill all required fields");
      return;
    }
    if (roomRows.length === 0) {
      alert("Add at least one room");
      return;
    }
    setSaving(true);
    try {
      await onSave({ groupName, primaryGuest, phone, checkIn, checkOut, roomRows });
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-purple-50">
          <div>
            <h3 className="text-lg font-bold">👥 Group Booking</h3>
            <p className="text-xs text-gray-500">Book multiple rooms at once for a group</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Group Name *</label>
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g., Sharma Wedding" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Primary Contact *</label>
              <input value={primaryGuest} onChange={(e) => setPrimaryGuest(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Phone *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Check-in *</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Check-out *</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-sm">Rooms ({roomRows.length})</h4>
              <button onClick={addRoom} className="px-3 py-1.5 text-xs border rounded-md hover:bg-cream">+ Add Room</button>
            </div>

            {roomRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                <select value={row.roomNumber} onChange={(e) => updateRow(idx, { roomNumber: e.target.value })} className="col-span-4 px-3 py-2 border rounded-lg text-sm">
                  {rooms.map((r) => (
                    <option key={r.id} value={r.room_number}>{r.room_number} — {r.room_type}</option>
                  ))}
                </select>
                <input type="number" value={row.adults} onChange={(e) => updateRow(idx, { adults: Number(e.target.value) })} placeholder="Adults" className="col-span-2 px-3 py-2 border rounded-lg text-sm" min={1} />
                <input type="number" value={row.rate} onChange={(e) => updateRow(idx, { rate: Number(e.target.value) })} placeholder="Rate ₹" className="col-span-3 px-3 py-2 border rounded-lg text-sm" />
                <button onClick={() => removeRow(idx)} className="col-span-1 text-rose-600 text-sm font-medium">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
          <button onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? "Creating..." : `Create Group Booking (${roomRows.length} rooms)`}
          </button>
        </div>
      </div>
    </div>
  );
}