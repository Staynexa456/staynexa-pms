"use client";

import { useState, useMemo } from "react";

type RoomGroup = {
  id: string;
  roomType: string;
  quantity: number;
  adultsPerRoom: number;
  ratePerRoom: number;
};

export default function GroupBookingModal({
  rooms,
  onClose,
  onSave,
}: {
  rooms: any[];
  onClose: () => void;
  onSave: (data: {
    groupName: string;
    primaryGuest: string;
    phone: string;
    checkIn: string;
    checkOut: string;
    allocateRooms: boolean;
    groups: RoomGroup[];
    grandTotal: number;
    selectedRoomNumbers: Record<string, string[]>;
  }) => Promise<void>;
}) {
  const [groupName, setGroupName] = useState("");
  const [primaryGuest, setPrimaryGuest] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [allocateRooms, setAllocateRooms] = useState(false);
  const [saving, setSaving] = useState(false);

  // Group by room types
  const roomTypes = useMemo(() => {
    const map = new Map<string, { type: string; count: number; rooms: any[]; basePrice: number }>();
    for (const r of rooms) {
      const t = r.room_type || "Standard Room";
      if (!map.has(t)) {
        map.set(t, {
          type: t,
          count: 0,
          rooms: [],
          basePrice: Number(r.base_price || 0),
        });
      }
      const entry = map.get(t)!;
      entry.count += 1;
      entry.rooms.push(r);
    }
    return Array.from(map.values());
  }, [rooms]);

  const [groups, setGroups] = useState<RoomGroup[]>([
    {
      id: Date.now().toString(),
      roomType: roomTypes[0]?.type || "",
      quantity: 1,
      adultsPerRoom: 2,
      ratePerRoom: roomTypes[0]?.basePrice || 0,
    },
  ]);

  const [selectedRoomNumbers, setSelectedRoomNumbers] = useState<Record<string, string[]>>({});

  const updateGroup = (id: string, patch: Partial<RoomGroup>) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
    );
  };

  const addGroup = () => {
    setGroups((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        roomType: roomTypes[0]?.type || "",
        quantity: 1,
        adultsPerRoom: 2,
        ratePerRoom: roomTypes[0]?.basePrice || 0,
      },
    ]);
  };

  const removeGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const totalRooms = groups.reduce((s, g) => s + (g.quantity || 0), 0);
  const totalAdults = groups.reduce(
    (s, g) => s + (g.quantity || 0) * (g.adultsPerRoom || 0),
    0
  );

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 1;
    const diff =
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
      86400000;
    return Math.max(1, Math.round(diff));
  }, [checkIn, checkOut]);

  const grandTotal = groups.reduce(
    (s, g) => s + (g.quantity || 0) * (g.ratePerRoom || 0) * nights,
    0
  );

  const getAvailableRoomsForType = (type: string) => {
    const all = rooms.filter((r) => (r.room_type || "Standard Room") === type);
    const usedInOtherGroups = new Set<string>();
    for (const g of groups) {
      if (g.roomType === type) {
        for (const rn of selectedRoomNumbers[g.id] || []) {
          usedInOtherGroups.add(rn);
        }
      }
    }
    return all.filter((r) => !usedInOtherGroups.has(r.room_number));
  };

  const handleAllocateToggle = (groupId: string, roomNumber: string) => {
    setSelectedRoomNumbers((prev) => {
      const current = prev[groupId] || [];
      const exists = current.includes(roomNumber);
      return {
        ...prev,
        [groupId]: exists
          ? current.filter((r) => r !== roomNumber)
          : [...current, roomNumber],
      };
    });
  };

  const submit = async () => {
    if (!groupName.trim() || !primaryGuest.trim() || !phone.trim()) {
      alert("Group name, primary contact, and phone are required");
      return;
    }
    if (!checkIn || !checkOut) {
      alert("Check-in and check-out dates are required");
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      alert("Check-out must be after check-in");
      return;
    }
    if (totalRooms === 0) {
      alert("Add at least one room");
      return;
    }

    for (const g of groups) {
      const typeInfo = roomTypes.find((t) => t.type === g.roomType);
      if (!typeInfo) {
        alert(`Room type "${g.roomType}" not found`);
        return;
      }
      if (g.quantity > typeInfo.count) {
        alert(
          `Only ${typeInfo.count} "${g.roomType}" rooms available, but you requested ${g.quantity}`
        );
        return;
      }
      if (allocateRooms) {
        const selected = selectedRoomNumbers[g.id] || [];
        if (selected.length !== g.quantity) {
          alert(
            `Please select exactly ${g.quantity} room number(s) for "${g.roomType}"`
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      await onSave({
        groupName,
        primaryGuest,
        phone,
        checkIn,
        checkOut,
        allocateRooms,
        groups,
        grandTotal,
        selectedRoomNumbers,
      });
      onClose();
    } catch (e: any) {
      alert(e.message || "Failed to save group booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gradient-to-r from-purple-50 to-purple-100">
          <div>
            <h3 className="text-lg font-bold text-purple-900">
              👥 Group Booking
            </h3>
            <p className="text-xs text-purple-600 mt-0.5">
              Book multiple rooms at once for a group
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-purple-400 hover:text-purple-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* GROUP INFO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Group Name *
              </label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Sharma Wedding, Corporate Meet"
                className="w-full px-3 py-2 border rounded-lg text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Primary Contact *
              </label>
              <input
                value={primaryGuest}
                onChange={(e) => setPrimaryGuest(e.target.value)}
                placeholder="Guest name"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Phone *
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Check-in *
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Check-out *
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {nights > 0 && checkIn && checkOut && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-800">
              📅 <strong>{nights}</strong> night{nights > 1 ? "s" : ""} ·{" "}
              <strong>{totalRooms}</strong> room{totalRooms > 1 ? "s" : ""} ·{" "}
              <strong>{totalAdults}</strong> adults
            </div>
          )}

          {/* ALLOCATE ROOMS TOGGLE */}
          <label className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={allocateRooms}
              onChange={(e) => setAllocateRooms(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-blue-900">
              Enable physical room allocation
            </span>
            <span className="text-xs text-blue-600 ml-auto">
              {allocateRooms
                ? "Select specific rooms below"
                : "Rooms will be auto-assigned at check-in"}
            </span>
          </label>

          {/* ROOM GROUPS */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-sm text-gray-900">
                Room Types ({groups.length})
              </h4>
              <button
                onClick={addGroup}
                className="px-3 py-1.5 text-xs font-medium border border-purple-300 text-purple-700 rounded-md hover:bg-purple-50"
              >
                + Add Room Type
              </button>
            </div>

            <div className="space-y-4">
              {groups.map((g) => {
                const typeInfo = roomTypes.find((t) => t.type === g.roomType);
                const available = typeInfo?.count || 0;
                const overCapacity = g.quantity > available;
                const availableRooms = getAvailableRoomsForType(g.roomType);
                const selected = selectedRoomNumbers[g.id] || [];

                return (
                  <div
                    key={g.id}
                    className={`border rounded-xl p-4 ${
                      overCapacity
                        ? "border-rose-300 bg-rose-50/50"
                        : "border-gray-200 bg-gray-50/50"
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      {/* Room Type */}
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                          Room Type
                        </label>
                        <select
                          value={g.roomType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            const typeBase = roomTypes.find(
                              (t) => t.type === newType
                            )?.basePrice;
                            updateGroup(g.id, {
                              roomType: newType,
                              ratePerRoom: typeBase || 0,
                            });
                            setSelectedRoomNumbers((prev) => ({
                              ...prev,
                              [g.id]: [],
                            }));
                          }}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                        >
                          {roomTypes.map((t) => (
                            <option key={t.type} value={t.type}>
                              {t.type} ({t.count} available)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                          Rooms
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={available}
                          value={g.quantity}
                          onChange={(e) =>
                            updateGroup(g.id, {
                              quantity: Number(e.target.value),
                            })
                          }
                          className={`w-full px-3 py-2 border rounded-lg text-sm bg-white ${
                            overCapacity ? "border-rose-500" : ""
                          }`}
                        />
                        {overCapacity && (
                          <p className="text-[10px] text-rose-600 mt-1">
                            Only {available} available
                          </p>
                        )}
                      </div>

                      {/* Adults per room */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                          Adults / Room
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={g.adultsPerRoom}
                          onChange={(e) =>
                            updateGroup(g.id, {
                              adultsPerRoom: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                        />
                      </div>

                      {/* Rate */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                          Rate / Room (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={g.ratePerRoom}
                          onChange={(e) =>
                            updateGroup(g.id, {
                              ratePerRoom: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                        />
                      </div>
                    </div>

                    {/* Row total + Remove */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-600">
                        <strong className="text-gray-900">
                          ₹
                          {(
                            g.quantity *
                            g.ratePerRoom *
                            nights
                          ).toLocaleString("en-IN")}
                        </strong>{" "}
                        for {g.quantity} × {nights} night
                        {nights > 1 ? "s" : ""} · {g.quantity * g.adultsPerRoom}{" "}
                        adults
                      </div>
                      {groups.length > 1 && (
                        <button
                          onClick={() => removeGroup(g.id)}
                          className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    {/* Physical Room Allocation */}
                    {allocateRooms && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-[10px] font-semibold uppercase text-gray-500 mb-2">
                          Select {g.quantity} room{g.quantity > 1 ? "s" : ""}{" "}
                          ({selected.length}/{g.quantity} selected)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {availableRooms.map((r) => {
                            const isSelected = selected.includes(
                              r.room_number
                            );
                            return (
                              <button
                                key={r.id}
                                onClick={() =>
                                  handleAllocateToggle(g.id, r.room_number)
                                }
                                className={`px-3 py-1.5 text-xs rounded-md border font-medium transition ${
                                  isSelected
                                    ? "bg-emerald-500 text-white border-emerald-500"
                                    : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"
                                }`}
                              >
                                {r.room_number}
                              </button>
                            );
                          })}
                          {availableRooms.length === 0 && (
                            <span className="text-xs text-gray-400 italic">
                              No rooms available
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRAND TOTAL */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-300 rounded-xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase font-semibold text-purple-600">
                  Total Rooms
                </p>
                <p className="text-lg font-bold text-purple-900">
                  {totalRooms}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-purple-600">
                  Total Adults
                </p>
                <p className="text-lg font-bold text-purple-900">
                  {totalAdults}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-purple-600">
                  Nights
                </p>
                <p className="text-lg font-bold text-purple-900">{nights}</p>
              </div>
              <div className="text-right md:col-span-1">
                <p className="text-[10px] uppercase font-semibold text-purple-600">
                  Grand Total
                </p>
                <p className="text-2xl font-bold text-purple-900">
                  ₹{grandTotal.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-gray-50 flex justify-between items-center border-t">
          <p className="text-xs text-gray-500">
            {totalRooms} room{totalRooms > 1 ? "s" : ""} ·{" "}
            {totalAdults} adult{totalAdults > 1 ? "s" : ""} · ₹
            {grandTotal.toLocaleString("en-IN")} total
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
            >
              {saving
                ? "Creating..."
                : `Create Group Booking (${totalRooms} room${totalRooms > 1 ? "s" : ""})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}