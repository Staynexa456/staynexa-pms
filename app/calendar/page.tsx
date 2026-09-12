"use client";

import React, { useState } from "react";
import { bookings as seedBookings, rooms, statusColors, statusLabels, type Booking } from "../data";

function getDates(startDate: string, days: number): Date[] {
  const dates: Date[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortFmt(d: Date): { day: string; date: number; month: string } {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] };
}

function bookingSpansDate(b: Booking, date: Date): boolean {
  const dateStr = fmt(date);
  return b.checkIn <= dateStr && b.checkOut > dateStr;
}

function prettyDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const legendItems = [
  { label: "Confirmed", color: "bg-amber-400" },
  { label: "Checked-in", color: "bg-emerald-500" },
  { label: "Checked-out / Due out", color: "bg-rose-500" },
  { label: "Blocked", color: "bg-blue-500" },
  { label: "Cancelled", color: "bg-gray-300" },
];

// ─── EMPTY FORM ───
const emptyForm = {
  guest: "",
  phone: "",
  source: "direct" as Booking["source"],
  roomNumber: rooms[0].number,
  checkIn: "2026-09-13",
  checkOut: "2026-09-15",
  adults: 2,
  children: 0,
  amount: 0,
};

export default function CalendarPage() {
  const [startDate, setStartDate] = useState("2026-09-12");
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // New reservation modal
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const daysToShow = 14;
  const dates = getDates(startDate, daysToShow);

  const shiftDates = (offset: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    setStartDate(fmt(d));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const updateStatus = (id: string, newStatus: Booking["status"], message: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );
    if (selected?.id === id) setSelected({ ...selected, status: newStatus });
    showToast(message);
  };

  // Validate form
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.guest.trim()) errs.guest = "Guest name is required";
    if (!form.roomNumber) errs.roomNumber = "Room is required";
    if (!form.checkIn) errs.checkIn = "Check-in date is required";
    if (!form.checkOut) errs.checkOut = "Check-out date is required";
    if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn) {
      errs.checkOut = "Check-out must be after check-in";
    }
    if (form.amount < 0) errs.amount = "Amount cannot be negative";
    return errs;
  };

  // Submit form
  const handleCreate = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const room = rooms.find((r) => r.number === form.roomNumber);
    const newBooking: Booking = {
      id: `SN-${Math.floor(1000 + Math.random() * 9000)}`,
      guest: form.guest.trim(),
      phone: form.phone || "NA",
      source: form.source,
      roomNumber: form.roomNumber,
      roomType: room?.type || "Room",
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      status: "CONFIRMED",
      amount: Number(form.amount) || 0,
      adults: Number(form.adults) || 1,
      children: Number(form.children) || 0,
    };

    setBookings((prev) => [...prev, newBooking]);
    setShowNew(false);
    setForm(emptyForm);
    setErrors({});
    showToast(`✅ Reservation created for ${newBooking.guest}`);
  };

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy">Calendar</h1>
          <p className="text-muted mt-1 text-sm">
            Tape chart view · {rooms.length} rooms · {bookings.length} bookings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDates(-7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">← Prev week</button>
          <button onClick={() => setStartDate("2026-09-12")} className="px-4 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Today</button>
          <button onClick={() => shiftDates(7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Next week →</button>
          <button
            onClick={() => setShowNew(true)}
            className="ml-2 px-4 py-2 bg-navy text-cream rounded-lg text-sm font-semibold hover:bg-navy-light transition shadow-sm"
          >
            + New Reservation
          </button>
        </div>
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs items-center">
        <span className="text-muted font-medium">Status:</span>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${item.color}`} />
            <span className="text-navy/70">{item.label}</span>
          </div>
        ))}
        <span className="ml-auto text-gold-dark font-medium">💡 Click any booking to open details</span>
      </div>

      {/* TAPE CHART */}
      <div className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1400px]">
            <div className="flex border-b border-cream-dark bg-cream-dark/40">
              <div className="w-32 shrink-0 px-4 py-3 text-xs font-semibold text-navy uppercase tracking-wide border-r border-cream-dark">Rooms</div>
              {dates.map((d, i) => {
                const s = shortFmt(d);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday = fmt(d) === "2026-09-13";
                return (
                  <div key={i} className={`flex-1 min-w-[80px] px-2 py-2 text-center border-r border-cream-dark ${isWeekend ? "bg-gold/10" : ""} ${isToday ? "bg-gold/20" : ""}`}>
                    <div className="text-[10px] font-medium text-muted uppercase">{s.day}</div>
                    <div className={`text-sm font-semibold ${isToday ? "text-gold-dark" : isWeekend ? "text-gold-dark" : "text-navy"}`}>
                      {s.date} {s.month}
                    </div>
                  </div>
                );
              })}
            </div>

            {rooms.map((room) => (
              <div key={room.number} className="flex border-b border-cream-dark last:border-b-0 hover:bg-cream/30 transition-colors">
                <div className="w-32 shrink-0 px-4 py-3 border-r border-cream-dark flex flex-col justify-center">
                  <div className="text-sm font-bold text-navy">{room.number}</div>
                  <div className="text-[10px] text-muted truncate">{room.type}</div>
                </div>
                <div className="flex flex-1 relative">
                  {dates.map((d, i) => {
                    const currentBookings = bookings.filter(
                      (b) => b.roomNumber === room.number && bookingSpansDate(b, d)
                    );
                    return (
                      <div key={i} className="flex-1 min-w-[80px] h-14 border-r border-cream-dark relative">
                        {currentBookings.map((b) => {
                          const isFirstDay = fmt(d) === b.checkIn;
                          if (!isFirstDay) return null;
                          const startIdx = dates.findIndex((dd) => fmt(dd) === b.checkIn);
                          const endIdx = dates.findIndex((dd) => fmt(dd) === b.checkOut);
                          const span = endIdx === -1 ? dates.length - startIdx : endIdx - startIdx;
                          return (
                            <button
                              key={b.id}
                              onClick={() => setSelected(b)}
                              className={`absolute top-2 left-1 h-10 ${statusColors[b.status]} rounded-md shadow-sm flex items-center px-2 hover:opacity-90 hover:scale-[1.02] transition-all z-10 overflow-hidden text-left cursor-pointer`}
                              style={{ width: `calc(${span} * 100% - 0.5rem)`, minWidth: "100%" }}
                            >
                              <div className="flex flex-col truncate leading-tight w-full">
                                <span className="text-[11px] font-semibold truncate">{b.guest}</span>
                                <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">{statusLabels[b.status]}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted uppercase tracking-wide">Total Rooms</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{rooms.length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-amber-400">
          <p className="text-xs text-muted uppercase tracking-wide">Confirmed</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{bookings.filter((b) => b.status === "CONFIRMED").length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs text-muted uppercase tracking-wide">In-house</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{bookings.filter((b) => b.status === "CHECKED-IN").length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-rose-500">
          <p className="text-xs text-muted uppercase tracking-wide">Due out</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{bookings.filter((b) => b.status === "PENDING DEPARTURE").length}</p>
        </div>
        <div className="bg-white border border-cream-dark rounded-xl p-4 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-xs text-muted uppercase tracking-wide">Blocked</p>
          <p className="font-serif text-2xl font-semibold text-navy mt-1">{bookings.filter((b) => b.status === "BLOCKED").length}</p>
        </div>
      </div>

      {/* ───── NEW RESERVATION MODAL ───── */}
      {showNew && (
        <>
          <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-50" onClick={() => setShowNew(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center">
                <div>
                  <p className="text-xs text-gold-dark uppercase tracking-widest font-semibold">Staynexa</p>
                  <h2 className="font-serif text-xl font-semibold text-navy mt-0.5">New Reservation</h2>
                </div>
                <button onClick={() => setShowNew(false)} className="text-2xl text-muted hover:text-navy leading-none">×</button>
              </div>

              {/* Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <Field label="Guest name" error={errors.guest} required>
                  <input
                    type="text"
                    value={form.guest}
                    onChange={(e) => setForm({ ...form, guest: e.target.value })}
                    placeholder="e.g. Vinay Verma"
                    className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                  />
                </Field>

                <Field label="Phone" error={errors.phone}>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g. 91 9886143941"
                    className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Room" error={errors.roomNumber} required>
                    <select
                      value={form.roomNumber}
                      onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                    >
                      {rooms.map((r) => (
                        <option key={r.number} value={r.number}>
                          {r.number} — {r.type}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Source">
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value as Booking["source"] })}
                      className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                    >
                      <option value="direct">Direct</option>
                      <option value="agoda">Agoda</option>
                      <option value="makemytrip">MakeMyTrip</option>
                      <option value="expedia">Expedia</option>
                      <option value="booking">Booking.com</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Check-in" error={errors.checkIn} required>
                    <input
                      type="date"
                      value={form.checkIn}
                      onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                      className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                    />
                  </Field>
                  <Field label="Check-out" error={errors.checkOut} required>
                    <input
                      type="date"
                      value={form.checkOut}
                      onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                      className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Adults">
                    <input
                      type="number"
                      min={1}
                      value={form.adults}
                      onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                    />
                  </Field>
                  <Field label="Children">
                    <input
                      type="number"
                      min={0}
                      value={form.children}
                      onChange={(e) => setForm({ ...form, children: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                    />
                  </Field>
                  <Field label="Amount (₹)" error={errors.amount}>
                    <input
                      type="number"
                      min={0}
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                    />
                  </Field>
                </div>

                {/* Live preview of bar */}
                <div className="bg-cream/50 border border-cream-dark rounded-lg p-3 mt-2">
                  <p className="text-xs text-muted uppercase tracking-wide mb-2">Preview</p>
                  <div className={`h-9 rounded-md ${statusColors.CONFIRMED} flex items-center px-3 text-[11px] font-semibold`}>
                    {form.guest || "Guest name"} · CONFIRMED
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-cream-dark flex gap-2 justify-end bg-cream/30">
                <button
                  onClick={() => { setShowNew(false); setErrors({}); }}
                  className="px-4 py-2 rounded-lg border border-cream-dark text-navy font-medium hover:bg-cream transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="px-5 py-2 rounded-lg bg-navy text-cream font-semibold hover:bg-navy-light transition"
                >
                  Create Reservation
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ───── BOOKING DETAILS PANEL ───── */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-40" onClick={() => setSelected(null)} />
          <aside className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className={`p-6 ${statusColors[selected.status].split(" ")[0]} text-white`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs uppercase tracking-widest opacity-80">Booking · {selected.id}</p>
                  <h2 className="font-serif text-2xl font-semibold mt-1">{selected.guest}</h2>
                  <p className="text-sm opacity-90 mt-1">{selected.phone}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
              </div>
              <div className="mt-3 inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-semibold tracking-wide">
                {statusLabels[selected.status]}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Room</p>
                  <p className="text-navy font-semibold mt-1">🔑 {selected.roomNumber}</p>
                  <p className="text-xs text-muted mt-0.5">{selected.roomType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Source</p>
                  <p className="text-navy font-semibold mt-1 capitalize">{selected.source}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Check-in</p>
                  <p className="text-navy font-semibold mt-1">{prettyDate(selected.checkIn)}</p>
                  <p className="text-xs text-muted">12:00 PM</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Check-out</p>
                  <p className="text-navy font-semibold mt-1">{prettyDate(selected.checkOut)}</p>
                  <p className="text-xs text-muted">11:00 AM</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-1">Guests</p>
                <p className="text-navy font-medium">
                  {selected.adults} adult{selected.adults !== 1 ? "s" : ""}
                  {selected.children > 0 && ` · ${selected.children} child${selected.children !== 1 ? "ren" : ""}`}
                </p>
              </div>
              {selected.notes && (
                <div className="bg-cream/60 border border-cream-dark rounded-lg p-3">
                  <p className="text-xs text-muted uppercase tracking-wide">Notes</p>
                  <p className="text-sm text-navy mt-1">{selected.notes}</p>
                </div>
              )}
              <div className="border-t border-cream-dark pt-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted">Total amount</span>
                  <span className="font-serif text-2xl font-semibold text-navy">
                    ₹{selected.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-cream-dark p-4 bg-cream/40 space-y-2">
              {selected.status === "CONFIRMED" && (
                <button onClick={() => updateStatus(selected.id, "CHECKED-IN", `✅ ${selected.guest} checked in`)} className="w-full py-3 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition">
                  ✅ Check-In Guest
                </button>
              )}
              {(selected.status === "CHECKED-IN" || selected.status === "PENDING DEPARTURE") && (
                <button onClick={() => updateStatus(selected.id, "CHECKED-OUT", `🚪 ${selected.guest} checked out`)} className="w-full py-3 rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-600 transition">
                  🚪 Check-Out Guest
                </button>
              )}
              {selected.status === "BLOCKED" && (
                <button onClick={() => updateStatus(selected.id, "CONFIRMED", `🔓 Room ${selected.roomNumber} unblocked`)} className="w-full py-3 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition">
                  🔓 Unblock Room
                </button>
              )}
              {selected.status !== "CANCELLED" && selected.status !== "CHECKED-OUT" && (
                <button onClick={() => updateStatus(selected.id, "CANCELLED", `❌ ${selected.guest}'s booking cancelled`)} className="w-full py-3 rounded-lg border border-cream-dark text-navy font-semibold hover:bg-cream transition">
                  ❌ Cancel Booking
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {/* ───── TOAST ───── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-cream px-6 py-3 rounded-full shadow-2xl z-[60] text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── REUSABLE FIELD ───
function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-navy/70 uppercase tracking-wide block mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
}
