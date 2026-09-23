"use client";

import React, { useState } from "react";
import {
  type InventoryRoom,
  type RoomStatus,
  getStatusColor,
  updateRoom,
} from "../lib/inventory";

const STATUS_OPTIONS: RoomStatus[] = [
  "CLEAN",
  "DIRTY",
  "INSPECTED",
  "MAINTENANCE",
];

export default function RoomCard({
  room,
  onEdit,
  onDelete,
  onRefresh,
}: {
  room: InventoryRoom;
  onEdit: (room: InventoryRoom) => void;
  onDelete: (room: InventoryRoom) => void;
  onRefresh: () => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const statusColor = getStatusColor(room.housekeeping_status);

  const handleStatusChange = async (newStatus: RoomStatus) => {
    setStatusOpen(false);
    if (newStatus === room.housekeeping_status) return;
    setUpdating(true);
    try {
      await updateRoom(room.id, { housekeeping_status: newStatus });
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-100/50 transition-all duration-300 overflow-hidden">
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 w-full h-1 ${statusColor.dot}`} />

      {/* Main content */}
      <div className="p-4">
        {/* Room number + Actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-xl ${statusColor.bg} border-2 ${statusColor.border} flex items-center justify-center text-lg`}
            >
              🚪
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {room.room_number}
              </h3>
              <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                {room.room_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(room)}
              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
              title="Edit"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
            <button
              onClick={() => onDelete(room)}
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Delete"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Base Price */}
        <div className="p-3 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-100 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Base Price
            </span>
            <span className="text-base font-bold text-slate-900">
              ₹{(Number(room.base_price) || 0).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="relative">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            disabled={updating}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg ${statusColor.bg} ${statusColor.text} border-2 ${statusColor.border} text-xs font-bold transition hover:opacity-90`}
          >
            <span className="flex items-center gap-2">
              <span>{statusColor.icon}</span>
              <span className="uppercase tracking-wider">
                {room.housekeeping_status || "CLEAN"}
              </span>
            </span>
            <svg
              className={`w-3 h-3 transition-transform ${
                statusOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {statusOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setStatusOpen(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-2xl p-1 overflow-hidden">
                {STATUS_OPTIONS.map((s) => {
                  const c = getStatusColor(s);
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition hover:bg-slate-50 ${
                        s === room.housekeeping_status
                          ? "bg-slate-50"
                          : ""
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${c.dot}`}
                      />
                      <span className={`${c.text} uppercase tracking-wider`}>
                        {s}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}