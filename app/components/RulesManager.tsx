"use client";

import React, { useState } from "react";
import {
  type RateRule,
  RULE_TYPE_INFO,
  formatAdjustment,
  formatScope,
  DAY_NAMES,
} from "../lib/rate-rules";

export default function RulesManager({
  rules,
  loading,
  onEdit,
  onDelete,
  onToggle,
  onAdd,
}: {
  rules: RateRule[];
  loading: boolean;
  onEdit: (rule: RateRule) => void;
  onDelete: (rule: RateRule) => void;
  onToggle: (rule: RateRule) => void;
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all" ? rules : rules.filter((r) => r.rule_type === filter);

  const activeCount = rules.filter((r) => r.is_active).length;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
        <p className="text-sm text-slate-500 font-semibold">Loading rules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ Header Bar ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <div>
            <h3 className="text-sm font-bold text-slate-700">
              Auto-Apply Rules
            </h3>
            <p className="text-[10px] text-slate-400">
              {activeCount} active · {rules.length} total
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 ml-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filter === "all"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600"
            }`}
          >
            All ({rules.length})
          </button>
          {(Object.keys(RULE_TYPE_INFO) as any[]).map((t) => {
            const count = rules.filter((r) => r.rule_type === t).length;
            if (count === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filter === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                <span>{RULE_TYPE_INFO[t as keyof typeof RULE_TYPE_INFO].icon}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onAdd}
          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-teal-500/30"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Rule
        </button>
      </div>

      {/* ═══ Rules List ═══ */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl opacity-40">🎯</span>
          </div>
          <p className="text-base font-bold text-slate-700">
            {filter === "all" ? "No rules yet" : `No ${filter} rules`}
          </p>
          <p className="text-sm text-slate-400 mt-2 mb-6">
            {filter === "all"
              ? "Create rules to automate your pricing"
              : "Try a different filter"}
          </p>
          {filter === "all" && (
            <button
              onClick={onAdd}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold"
            >
              + Create First Rule
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rule) => {
            const info = RULE_TYPE_INFO[rule.rule_type];
            const isInactive = !rule.is_active;

            return (
              <div
                key={rule.id}
                className={`bg-white rounded-2xl border-2 transition-all ${
                  isInactive
                    ? "border-slate-200 opacity-60"
                    : "border-slate-200 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-100/50"
                }`}
              >
                <div className="p-5 flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl shrink-0">
                    {info.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-base font-bold text-slate-800">
                        {rule.name}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full uppercase tracking-wider">
                        {info.label}
                      </span>
                      {!rule.is_active && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full uppercase tracking-wider">
                          INACTIVE
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                        P{rule.priority}
                      </span>
                    </div>

                    {rule.description && (
                      <p className="text-xs text-slate-500 mb-2">
                        {rule.description}
                      </p>
                    )}

                    {/* Condition Summary */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
                      {rule.rule_type === "seasonal" && (
                        <span>
                          📅 {rule.start_date} → {rule.end_date}
                        </span>
                      )}
                      {rule.rule_type === "day_of_week" && (
                        <span>
                          📆{" "}
                          {(rule.days_of_week || [])
                            .map(
                              (d) =>
                                DAY_NAMES.find((x) => x.value === d)?.label
                            )
                            .join(", ")}
                        </span>
                      )}
                      {rule.rule_type === "los" && (
                        <span>
                          🏨 {rule.min_nights}-{rule.max_nights} nights
                        </span>
                      )}
                      {rule.rule_type === "last_minute" && (
                        <span>
                          ⏰ Within {rule.advance_days} days before check-in
                        </span>
                      )}
                      {rule.rule_type === "occupancy" && (
                        <span>
                          📊 Occupancy ≥ {rule.min_occupancy}%
                        </span>
                      )}
                    </div>

                    {/* Adjustment + Scope */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full ${
                          rule.adjustment_value > 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {formatAdjustment(rule)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatScope(rule)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onToggle(rule)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        rule.is_active
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {rule.is_active ? "✓ Active" : "Inactive"}
                    </button>
                    <button
                      onClick={() => onEdit(rule)}
                      className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                      title="Edit"
                    >
                      <svg
                        className="w-4 h-4"
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
                      onClick={() => onDelete(rule)}
                      className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Delete"
                    >
                      <svg
                        className="w-4 h-4"
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}