"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getActiveHotelId } from "../active-hotel";
import { fetchHousekeepingRooms, updateRoomHousekeeping, bulkUpdateHousekeeping, type HousekeepingStatus } from "../db";

type StatusFilter = "ALL" | HousekeepingStatus;

const STATUS_CONFIG: Record<HousekeepingStatus, { label: string; color: string; bg: string; border: string; icon: string; dot: string }> = {
  CLEAN:       { label: "Clean",       color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-300", icon: "✅", dot: "bg-emerald-500" },
  DIRTY:       { label: "Dirty",       color: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-300",    icon: "🧹", dot: "bg-rose-500" },
  INSPECTED:   { label: "Inspected",   color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-300",    icon: "🔍", dot: "bg-blue-500" },
  MAINTENANCE: { label: "Maintenance", color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-300",   icon: "🔧", dot: "bg-amber-500" },
};

export default function HousekeepingPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [staffName, setStaffName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      const hotelId = getActiveHotelId() || undefined;
      const data = await fetchHousekeepingRooms(hotelId);
      setRooms(data);
    } catch (err) {
      console.error("[housekeeping]", err);
      showToast("⚠ Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
    const handler = () => loadRooms();
    window.addEventListener("hotel-changed", handler);
    return () => window.removeEventListener("hotel-changed", handler);
  }, [loadRooms]);

  const stats = useMemo(() => {
    const s: Record<HousekeepingStatus, number> = { CLEAN: 0, DIRTY: 0, INSPECTED: 0, MAINTENANCE: 0 };
    rooms.forEach((r) => {
      const st = (r.housekeeping_status || "CLEAN") as HousekeepingStatus;
      if (s[st] !== undefined) s[st]++;
    });
    return s;
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (filter !== "ALL") list = list.filter((r) => (r.housekeeping_status || "CLEAN") === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => 
        (r.room_number || "").toLowerCase().includes(q) ||
        (r.room_type || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rooms, filter, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredRooms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRooms.map((r) => r.id)));
    }
  };

  const handleUpdateStatus = async (roomId: string, status: HousekeepingStatus) => {
    try {
      await updateRoomHousekeeping(roomId, status, staffName || undefined);
      setRooms((prev) => prev.map((r) => r.id === roomId ? { 
        ...r, 
        housekeeping_status: status, 
        last_cleaned_at: (status === 'CLEAN' || status === 'INSPECTED') ? new Date().toISOString() : r.last_cleaned_at,
        last_cleaned_by: staffName || r.last_cleaned_by,
      } : r));
      showToast(`✓ Room marked as ${STATUS_CONFIG[status].label}`);
    } catch (err: any) {
      showToast(`⚠ ${err.message || "Failed to update"}`);
    }
  };

  const handleBulkUpdate = async (status: HousekeepingStatus) => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await bulkUpdateHousekeeping(ids, status, staffName || undefined);
      setRooms((prev) => prev.map((r) => selectedIds.has(r.id) ? { 
        ...r, 
        housekeeping_status: status,
        last_cleaned_at: (status === 'CLEAN' || status === 'INSPECTED') ? new Date().toISOString() : r.last_cleaned_at,
        last_cleaned_by: staffName || r.last_cleaned_by,
      } : r));
      showToast(`✓ ${selectedIds.size} room${selectedIds.size > 1 ? "s" : ""} marked as ${STATUS_CONFIG[status].label}`);
      setSelectedIds(new Set());
    } catch (err: any) {
      showToast(`⚠ ${err.message || "Failed to update"}`);
    }
  };

  const getStatusOf = (r: any): HousekeepingStatus => (r.housekeeping_status || "CLEAN") as HousekeepingStatus;

  const formatTimeAgo = (iso?: string) => {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="flex flex-col bg-[#f8f9fa] min-h-screen">
      {/* HEADER */}
      <div className="px-6 py-5 bg-white border-b border-gray-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">🧹</span> Housekeeping
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage room cleaning status · {rooms.length} rooms total
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text" placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 w-64"
              />
            </div>
            <input
              type="text" placeholder="Staff name (optional)"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="px-3 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 w-52"
            />
            <button onClick={loadRooms} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="px-6 py-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button
            onClick={() => setFilter("ALL")}
            className={`p-4 rounded-xl border text-left transition ${filter === "ALL" ? "bg-gray-900 text-white border-gray-900 shadow-lg" : "bg-white border-gray-200 hover:border-gray-400"}`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-wider ${filter === "ALL" ? "text-white/70" : "text-gray-500"}`}>Total Rooms</p>
            <p className={`text-3xl font-bold mt-1 ${filter === "ALL" ? "text-white" : "text-gray-900"}`}>{rooms.length}</p>
          </button>

          {(Object.keys(STATUS_CONFIG) as HousekeepingStatus[]).map((status) => {
            const cfg = STATUS_CONFIG[status];
            const isActive = filter === status;
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`p-4 rounded-xl border text-left transition relative overflow-hidden ${
                  isActive ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-2 ring-${cfg.color.split('-')[1]}-400 shadow-lg` : "bg-white border-gray-200 hover:border-gray-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? cfg.color : "text-gray-500"}`}>{cfg.label}</p>
                  <span className="text-lg">{cfg.icon}</span>
                </div>
                <p className={`text-3xl font-bold mt-1 ${isActive ? cfg.color : "text-gray-900"}`}>{stats[status]}</p>
                <div className={`absolute bottom-0 left-0 right-0 h-1 ${cfg.dot}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedIds.size > 0 && (
        <div className="px-6 mb-3">
          <div className="bg-gray-900 text-white rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">{selectedIds.size}</span>
              <span className="text-sm font-medium">room{selectedIds.size > 1 ? "s" : ""} selected</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleBulkUpdate("CLEAN")} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs font-bold transition">✅ Mark Clean</button>
              <button onClick={() => handleBulkUpdate("DIRTY")} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 rounded-lg text-xs font-bold transition">🧹 Mark Dirty</button>
              <button onClick={() => handleBulkUpdate("INSPECTED")} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs font-bold transition">🔍 Inspected</button>
              <button onClick={() => handleBulkUpdate("MAINTENANCE")} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold transition">🔧 Maintenance</button>
              <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 border border-white/30 hover:bg-white/10 rounded-lg text-xs font-bold transition ml-2">Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* ROOMS GRID */}
      <div className="px-6 pb-8 flex-1">
        {loading && <div className="text-center py-12 text-gray-500">⏳ Loading rooms...</div>}
        {!loading && filteredRooms.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-4xl mb-2">🏨</p>
            <p className="font-semibold text-gray-700">
              {rooms.length === 0 ? "No rooms configured" : "No rooms match this filter"}
            </p>
          </div>
        )}
        {!loading && filteredRooms.length > 0 && (
          <>
            {/* Select All row */}
            <div className="flex items-center justify-between mb-3 px-1">
              <button onClick={selectAll} className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-2">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${selectedIds.size === filteredRooms.length && filteredRooms.length > 0 ? "bg-gray-900 border-gray-900" : "border-gray-400"}`}>
                  {selectedIds.size === filteredRooms.length && filteredRooms.length > 0 && <span className="text-white text-[10px]">✓</span>}
                </div>
                Select all ({filteredRooms.length})
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredRooms.map((room) => {
                const status = getStatusOf(room);
                const cfg = STATUS_CONFIG[status];
                const isSelected = selectedIds.has(room.id);
                return (
                  <div
                    key={room.id}
                    className={`relative bg-white rounded-2xl border-2 transition overflow-hidden group ${
                      isSelected ? "border-gray-900 ring-2 ring-gray-900/20 shadow-lg" : `${cfg.border} hover:shadow-lg`
                    }`}
                  >
                    {/* Selection checkbox */}
                    <button
                      onClick={() => toggleSelect(room.id)}
                      className={`absolute top-2 right-2 w-6 h-6 rounded-lg border-2 flex items-center justify-center z-10 transition ${
                        isSelected ? "bg-gray-900 border-gray-900" : "bg-white/90 border-gray-300 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </button>

                    {/* Status strip */}
                    <div className={`h-1.5 ${cfg.dot}`} />

                    {/* Content */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{room.room_number}</p>
                          <p className="text-[10px] text-gray-500 font-medium truncate max-w-[100px]">{room.room_type}</p>
                        </div>
                        <span className="text-2xl">{cfg.icon}</span>
                      </div>

                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${cfg.bg} ${cfg.border} border mb-3`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                      </div>

                      <div className="text-[10px] text-gray-400 mb-3 leading-relaxed">
                        <p>🧑‍🔧 {room.last_cleaned_by || "—"}</p>
                        <p>⏱ {formatTimeAgo(room.last_cleaned_at)}</p>
                      </div>

                      {/* Quick action buttons */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {status !== "CLEAN" && (
                          <button
                            onClick={() => handleUpdateStatus(room.id, "CLEAN")}
                            className="col-span-2 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide transition"
                          >
                            ✅ Mark Clean
                          </button>
                        )}
                        {status !== "DIRTY" && (
                          <button
                            onClick={() => handleUpdateStatus(room.id, "DIRTY")}
                            className="py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide transition"
                          >
                            🧹 Dirty
                          </button>
                        )}
                        {status !== "MAINTENANCE" && (
                          <button
                            onClick={() => handleUpdateStatus(room.id, "MAINTENANCE")}
                            className="py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide transition"
                          >
                            🔧 Repair
                          </button>
                        )}
                        {status === "CLEAN" && (
                          <button
                            onClick={() => handleUpdateStatus(room.id, "INSPECTED")}
                            className="col-span-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide transition"
                          >
                            🔍 Inspect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-2.5 rounded-xl text-sm z-[100] shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}