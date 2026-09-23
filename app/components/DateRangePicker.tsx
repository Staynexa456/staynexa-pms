"use client";

import React, { useState } from "react";

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

export default function DateRangePicker({
  startDate,
  endDate,
  onApply,
  onCancel,
}: {
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string) => void;
  onCancel: () => void;
}) {
  const [viewYear, setViewYear] = useState(() => parseISO(startDate).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseISO(startDate).getMonth());
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const today = new Date();
  const todayStr = fmt(today);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (dateStr: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd("");
    } else {
      if (dateStr < tempStart) {
        setTempEnd(tempStart);
        setTempStart(dateStr);
      } else if (dateStr === tempStart) {
        setTempEnd(dateStr);
      } else {
        setTempEnd(dateStr);
      }
    }
  };

  const handleDayHover = (dateStr: string) => {
    if (tempStart && !tempEnd) {
      setHoverDate(dateStr);
    }
  };

  const isInRange = (dateStr: string): boolean => {
    if (!tempStart) return false;
    if (tempEnd) {
      return dateStr >= tempStart && dateStr <= tempEnd;
    }
    if (hoverDate && hoverDate > tempStart) {
      return dateStr >= tempStart && dateStr <= hoverDate;
    }
    return dateStr === tempStart;
  };

  const isStart = (dateStr: string) => dateStr === tempStart;
  const isEnd = (dateStr: string) => dateStr === tempEnd;

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const daysInPrevMonth = getDaysInMonth(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1
  );

  const calendarDays: { date: Date; dateStr: string; inMonth: boolean }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const d = new Date(
      viewMonth === 0 ? viewYear - 1 : viewYear,
      viewMonth === 0 ? 11 : viewMonth - 1,
      day
    );
    calendarDays.push({ date: d, dateStr: fmt(d), inMonth: false });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(viewYear, viewMonth, i);
    calendarDays.push({ date: d, dateStr: fmt(d), inMonth: true });
  }

  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(
      viewMonth === 11 ? viewYear + 1 : viewYear,
      viewMonth === 11 ? 0 : viewMonth + 1,
      i
    );
    calendarDays.push({ date: d, dateStr: fmt(d), inMonth: false });
  }

  const nights = tempStart && tempEnd
    ? Math.round((parseISO(tempEnd).getTime() - parseISO(tempStart).getTime()) / 86400000)
    : 0;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]"
        onClick={onCancel}
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white rounded-3xl shadow-2xl w-[400px] overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            {MONTHS[viewMonth]} {viewYear}
          </h3>

          <button
            onClick={nextMonth}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day names */}
        <div className="px-5 grid grid-cols-7 gap-1 mb-2">
          {DAYS_SHORT.map((day, i) => (
            <div
              key={i}
              className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="px-5 pb-4">
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, i) => {
              const inRange = isInRange(cell.dateStr);
              const isStartCell = isStart(cell.dateStr);
              const isEndCell = isEnd(cell.dateStr);
              const isToday = cell.dateStr === todayStr;
              const isSelected = isStartCell || isEndCell;

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(cell.dateStr)}
                  onMouseEnter={() => handleDayHover(cell.dateStr)}
                  className={`
                    relative h-10 rounded-lg text-sm font-semibold transition-all
                    ${!cell.inMonth ? "text-slate-300" : "text-slate-700"}
                    ${isSelected ? "bg-slate-900 text-white shadow-md" : ""}
                    ${inRange && !isSelected ? "bg-slate-100 text-slate-900" : ""}
                    ${!isSelected && !inRange && cell.inMonth ? "hover:bg-slate-100" : ""}
                    ${isToday && !isSelected ? "ring-2 ring-teal-500 ring-inset" : ""}
                  `}
                >
                  {cell.date.getDate()}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selection summary */}
        {(tempStart || tempEnd) && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-wider">From</span>
                <span className="font-bold text-slate-900">
                  {tempStart ? parseISO(tempStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </span>
              </div>
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-wider">To</span>
                <span className="font-bold text-slate-900">
                  {tempEnd ? parseISO(tempEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Select"}
                </span>
              </div>
            </div>
            {nights > 0 && (
              <p className="text-[10px] text-teal-600 font-bold mt-1 text-center">
                {nights + 1} days selected
              </p>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (tempStart && tempEnd) {
                onApply(tempStart, tempEnd);
              } else if (tempStart) {
                onApply(tempStart, tempStart);
              }
            }}
            disabled={!tempStart}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply Date
          </button>
        </div>
      </div>
    </>
  );
}