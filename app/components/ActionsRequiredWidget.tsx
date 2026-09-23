"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { PendingAction } from "../lib/actions-required";

const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
  CHECK_IN: { icon: "🛬", label: "Check-In Due", color: "emerald" },
  CHECK_OUT: { icon: "🛫", label: "Check-Out Due", color: "rose" },
  OVERDUE_IN: { icon: "⏰", label: "Overdue Check-In", color: "red" },
  OVERDUE_OUT: { icon: "🚨", label: "Overdue Check-Out", color: "red" },
  BALANCE_DUE: { icon: "💰", label: "Balance Due", color: "amber" },
  DATA_ISSUE: { icon: "⚠️", label: "Data Issue", color: "orange" },
};

const priorityStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  high: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  low: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
};

export default function ActionsRequiredWidget({
  actions,
  total,
  highPriority,
  mediumPriority,
  onRefresh,
}: {
  actions: PendingAction[];
  total: number;
  highPriority: number;
  mediumPriority: number;
  onRefresh?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");

  const filtered = filter === "all"
    ? actions
    : actions.filter((a) => a.priority === filter);

  const displayed = expanded ? filtered : filtered.slice(0, 5);

  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl">
            ✅
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-emerald-800">All Caught Up!</h3>
            <p className="text-xs text-emerald-600 mt-0.5">
              No pending actions at the moment
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl">
            🎯
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Actions Required</h3>
            <p className="text-slate-300 text-[11px] mt-0.5">
              {total} pending task{total !== 1 ? "s" : ""} need your attention
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {highPriority > 0 && (
            <span className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
              {highPriority} HIGH
            </span>
          )}
          {mediumPriority > 0 && (
            <span className="px-2.5 py-1 bg-amber-500 text-white text-[10px] font-bold rounded-full">
              {mediumPriority} MED
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
        {[
          { k: "all", l: "All", c: total },
          { k: "high", l: "High", c: actions.filter((a) => a.priority === "high").length },
          { k: "medium", l: "Medium", c: actions.filter((a) => a.priority === "medium").length },
          { k: "low", l: "Low", c: actions.filter((a) => a.priority === "low").length },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              filter === f.k
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.l} <span className="opacity-60">({f.c})</span>
          </button>
        ))}
      </div>

      {/* Actions List */}
      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No {filter} priority actions
          </div>
        ) : (
          displayed.map((action) => {
            const p = priorityStyles[action.priority];
            const t = typeConfig[action.type] || typeConfig.BALANCE_DUE;
            return (
              <div key={action.id} className="p-4 hover:bg-slate-50 transition">
                <div className="flex items-start gap-3">
                  {/* Priority Dot */}
                  <div className={`w-2 h-2 rounded-full ${p.dot} mt-2 shrink-0`} />

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-base">{t.icon}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.bg} ${p.text} border ${p.border}`}>
                        {t.label}
                      </span>
                      {action.daysLate !== undefined && action.daysLate > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          {action.daysLate} day{action.daysLate > 1 ? "s" : ""} late
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-bold text-slate-800 truncate">
                      {action.guestName}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {action.roomNumber ? `Room ${action.roomNumber}` : "No room"}
                      {action.roomType && ` · ${action.roomType}`}
                      {action.guestPhone && ` · ${action.guestPhone}`}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1.5">
                      {action.message}
                    </p>

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                      <span>📅 {action.checkIn} → {action.checkOut}</span>
                      {action.balance > 0 && (
                        <span className="text-rose-600 font-semibold">
                          ₹{action.balance.toFixed(0)} due
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0">
                    <Link
                      href="/calendar"
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                        action.priority === "high"
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {action.actionLabel} →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {filtered.length > 5 && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Showing {displayed.length} of {filtered.length}
          </p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-bold text-slate-700 hover:text-slate-900 transition"
          >
            {expanded ? "Show Less ↑" : `Show All (${filtered.length}) ↓`}
          </button>
        </div>
      )}
    </div>
  );
}