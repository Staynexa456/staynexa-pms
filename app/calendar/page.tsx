"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  bookings as seedBookings,
  rooms,
  statusColors,
  statusLabels,
  type Booking,
} from "../data";

// ─── HELPERS ───
function getDates(startDate: string, days: number): Date[] {
  const out: Date[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return fmt(d);
}
function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}
function shortFmt(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] };
}
function bookingSpansDate(b: Booking, date: Date): boolean {
  const s = fmt(date);
  return b.checkIn <= s && b.checkOut > s;
}
function prettyDate(iso: string): string {
  const d = parseISO(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function prettyDateTime(iso: string, time = "12:00 PM"): string {
  return `${prettyDate(iso)}, ${time}`;
}
function nightsBetween(a: string, b: string): number {
  return Math.max(1, daysBetween(a, b));
}

const legendItems = [
  { label: "Confirmed", color: "bg-amber-400" },
  { label: "Checked-in", color: "bg-emerald-500" },
  { label: "Checked-out / Due out", color: "bg-rose-500" },
  { label: "Blocked", color: "bg-blue-500" },
  { label: "Cancelled", color: "bg-gray-300" },
];

const modifyOptions = [
  "Hold booking", "Set to no show", "Lock booking", "Unassign room",
  "Modify checkin", "Modify checkout", "Split Room", "Move Room", "Send magic link",
];

const CELL_WIDTH = 80;
const ROW_HEIGHT = 56;
const DRAG_THRESHOLD = 5;

export default function CalendarPage() {
  const [startDate, setStartDate] = useState("2026-09-12");
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);

  // Notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // New guest
  const [newGuestInput, setNewGuestInput] = useState("");

  // Payment
  const [paymentInput, setPaymentInput] = useState("");

  // Folio modal
  const [folioFor, setFolioFor] = useState<Booking | null>(null);

  // Reg card modal
  const [regCardFor, setRegCardFor] = useState<Booking | null>(null);

  // Drag
  const dragRef = useRef<{
    bookingId: string;
    startX: number;
    startY: number;
    originRoom: string;
    originCheckIn: string;
    originCheckOut: string;
    hasMoved: boolean;
  } | null>(null);
  const [dragVisual, setDragVisual] = useState<{
    bookingId: string;
    currentX: number;
    currentY: number;
    previewRoom: string;
    previewCheckIn: string;
    previewCheckOut: string;
  } | null>(null);

  const daysToShow = 14;
  const dates = getDates(startDate, daysToShow);

  const shiftDates = (offset: number) => {
    const d = parseISO(startDate);
    d.setDate(d.getDate() + offset);
    setStartDate(fmt(d));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const updateStatus = (id: string, newStatus: Booking["status"], message: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: newStatus,
              notes:
                newStatus === "CHECKED-IN"
                  ? `${b.notes ? b.notes + " · " : ""}Checked in at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                  : newStatus === "CHECKED-OUT"
                  ? `${b.notes ? b.notes + " · " : ""}Checked out at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                  : b.notes,
            }
          : b
      )
    );
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status: newStatus } : prev));
    showToast(message);
  };

  const updateField = <K extends keyof Booking>(id: string, field: K, value: Booking[K], message?: string) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, [field]: value } : prev));
    if (message) showToast(message);
  };

  // FRONT DESK ACTIONS
  const handleCheckIn = (b: Booking) => {
    updateStatus(b.id, "CHECKED-IN", `✅ ${b.guest} checked into Room ${b.roomNumber}`);
  };

  const handleCheckOut = (b: Booking) => {
    const balance = b.amount - b.paid;
    if (balance > 0) {
      showToast(`⚠ Cannot check-out · ₹${balance.toFixed(2)} balance due. Settle first.`);
      return;
    }
    updateStatus(b.id, "CHECKED-OUT", `🚪 ${b.guest} checked out of Room ${b.roomNumber}`);
  };

  const handleSettleFull = (b: Booking) => {
    const balance = b.amount - b.paid;
    if (balance <= 0) {
      showToast("✓ No dues pending");
      return;
    }
    updateField(b.id, "paid", b.amount, `💰 ₹${balance.toFixed(2)} settled · Balance now ₹0`);
  };

  const handleSettlePartial = (b: Booking) => {
    const amount = Number(paymentInput);
    if (!amount || amount <= 0) {
      showToast("⚠ Enter a valid amount");
      return;
    }
    const balance = b.amount - b.paid;
    if (amount > balance) {
      showToast(`⚠ Amount exceeds balance of ₹${balance.toFixed(2)}`);
      return;
    }
    const newPaid = b.paid + amount;
    updateField(b.id, "paid", newPaid, `💰 ₹${amount.toFixed(2)} received · Balance ₹${(b.amount - newPaid).toFixed(2)}`);
    setPaymentInput("");
  };

  const handleAddGuest = (b: Booking) => {
    const name = newGuestInput.trim();
    if (!name) return;
    const list = [...(b.guestList || [b.guest])];
    list.push(name);
    updateField(b.id, "guestList", list, `👤 ${name} added`);
    setNewGuestInput("");
  };

  const handleSaveNotes = (b: Booking) => {
    updateField(b.id, "notes", notesDraft, "📝 Notes updated");
    setEditingNotes(false);
  };

  const handleModifyOption = (label: string) => {
    if (!selected) return;
    setShowModifyMenu(false);
    if (label === "Send magic link") {
      showToast("✨ Magic link sent to guest");
    } else if (label === "Set to no show") {
      updateStatus(selected.id, "CANCELLED", "🚫 Marked as no-show");
    } else if (label === "Lock booking") {
      showToast("🔒 Booking locked");
    } else if (label === "Hold booking") {
      showToast("⏸ Booking on hold");
    } else if (label === "Unassign room") {
      showToast("🚪 Room unassigned");
    } else {
      showToast(`✔ ${label} applied`);
    }
  };

  // DRAG
  const onBarMouseDown = (e: React.MouseEvent | React.TouchEvent, b: Booking) => {
    const point = "touches" in e ? e.touches[0] : e;
    dragRef.current = {
      bookingId: b.id,
      startX: point.clientX,
      startY: point.clientY,
      originRoom: b.roomNumber,
      originCheckIn: b.checkIn,
      originCheckOut: b.checkOut,
      hasMoved: false,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const point = "touches" in e ? e.touches[0] : e;
      const dx = point.clientX - d.startX;
      const dy = point.clientY - d.startY;

      if (!d.hasMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        d.hasMoved = true;
      }

      if (d.hasMoved) {
        const daysOffset = Math.round(dx / CELL_WIDTH);
        const roomsOffset = Math.round(dy / ROW_HEIGHT);
        const roomIdx = rooms.findIndex((r) => r.number === d.originRoom);
        const newRoomIdx = Math.max(0, Math.min(rooms.length - 1, roomIdx + roomsOffset));
        const nights = daysBetween(d.originCheckIn, d.originCheckOut);
        const newCheckIn = addDays(d.originCheckIn, daysOffset);
        const newCheckOut = addDays(newCheckIn, nights);

        setDragVisual({
          bookingId: d.bookingId,
          currentX: point.clientX,
          currentY: point.clientY,
          previewRoom: rooms[newRoomIdx].number,
          previewCheckIn: newCheckIn,
          previewCheckOut: newCheckOut,
        });
      }
    };

    const handleUp = () => {
      const d = dragRef.current;
      if (!d) return;

      if (d.hasMoved && dragVisual) {
        const changed =
          dragVisual.previewRoom !== d.originRoom ||
          dragVisual.previewCheckIn !== d.originCheckIn;
        if (changed) {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === d.bookingId
                ? {
                    ...b,
                    roomNumber: dragVisual.previewRoom,
                    checkIn: dragVisual.previewCheckIn,
                    checkOut: dragVisual.previewCheckOut,
                  }
                : b
            )
          );
          showToast(`📅 Moved to Room ${dragVisual.previewRoom} · ${prettyDate(dragVisual.previewCheckIn)}`);
        }
      }

      if (!d.hasMoved) {
        const booking = bookings.find((b) => b.id === d.bookingId);
        if (booking) setSelected(booking);
      }

      dragRef.current = null;
      setDragVisual(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragVisual, bookings]);

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-navy">Front Office · Calendar</h1>
          <p className="text-muted mt-1 text-sm">
            {rooms.length} rooms · {bookings.length} bookings · Click any booking to manage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDates(-7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">← Prev</button>
          <button onClick={() => setStartDate("2026-09-12")} className="px-4 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Today</button>
          <button onClick={() => shiftDates(7)} className="px-3 py-2 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">Next →</button>
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
        <span className="ml-auto text-gold-dark font-medium">🖱 Drag to move · 👆 Click to manage</span>
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
                const isToday = fmt(d) === "2026-09-12";
                return (
                  <div key={i} className={`flex-1 min-w-[80px] px-2 py-2 text-center border-r border-cream-dark ${isWeekend ? "bg-gold/10" : ""} ${isToday ? "bg-gold/20" : ""}`}>
                    <div className="text-[10px] font-medium text-muted uppercase">{s.day}</div>
                    <div className={`text-sm font-semibold ${isToday || isWeekend ? "text-gold-dark" : "text-navy"}`}>
                      {s.date} {s.month}
                    </div>
                  </div>
                );
              })}
            </div>

            {rooms.map((room) => (
              <div key={room.number} className="flex border-b border-cream-dark last:border-b-0 hover:bg-cream/30 transition-colors" style={{ height: ROW_HEIGHT }}>
                <div className="w-32 shrink-0 px-4 py-2 border-r border-cream-dark flex flex-col justify-center">
                  <div className="text-sm font-bold text-navy">{room.number}</div>
                  <div className="text-[10px] text-muted truncate">{room.type}</div>
                </div>
                <div className="flex flex-1 relative">
                  {dates.map((d, i) => {
                    const currentBookings = bookings.filter((b) => b.roomNumber === room.number && bookingSpansDate(b, d));
                    return (
                      <div key={i} className="flex-1 min-w-[80px] border-r border-cream-dark relative" style={{ height: ROW_HEIGHT }}>
                        {currentBookings.map((b) => {
                          const isFirstDay = fmt(d) === b.checkIn;
                          if (!isFirstDay) return null;
                          const startIdx = dates.findIndex((dd) => fmt(dd) === b.checkIn);
                          const endIdx = dates.findIndex((dd) => fmt(dd) === b.checkOut);
                          const span = endIdx === -1 ? dates.length - startIdx : endIdx - startIdx;
                          const isDragging = dragVisual?.bookingId === b.id;
                          return (
                            <div
                              key={b.id}
                              onMouseDown={(e) => onBarMouseDown(e, b)}
                              onTouchStart={(e) => onBarMouseDown(e, b)}
                              className={`absolute top-2 left-1 h-10 ${statusColors[b.status]} rounded-md shadow-sm flex items-center px-2 z-10 overflow-hidden cursor-grab active:cursor-grabbing select-none transition-opacity ${
                                isDragging ? "opacity-30" : "hover:scale-[1.02] hover:shadow-md"
                              }`}
                              style={{ width: `calc(${span} * 100% - 0.5rem)`, minWidth: "100%" }}
                              title="Drag to move · Click to open"
                            >
                              <div className="flex flex-col truncate leading-tight w-full pointer-events-none">
                                <span className="text-[11px] font-semibold truncate">{b.guest}</span>
                                <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">{statusLabels[b.status]}</span>
                              </div>
                            </div>
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

      {/* DRAG GHOST */}
      {dragVisual && (
        <div className="fixed z-[100] pointer-events-none" style={{ left: dragVisual.currentX + 10, top: dragVisual.currentY + 10 }}>
          <div className="bg-navy text-cream px-3 py-1.5 rounded-md shadow-2xl text-xs font-semibold">
            → Room {dragVisual.previewRoom} · {prettyDate(dragVisual.previewCheckIn)}
          </div>
        </div>
      )}

      {/* ═══ RESERVATION DETAILS ═══ */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-40" onClick={() => { setSelected(null); setShowModifyMenu(false); setEditingNotes(false); }} />
          <aside className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 border-b border-cream-dark flex justify-between items-center ${statusColors[selected.status].split(" ")[0]} text-white`}>
              <div>
                <p className="text-xs uppercase tracking-widest opacity-80">Booking · {selected.id}</p>
                <h2 className="font-serif text-2xl font-semibold mt-0.5">{selected.guest}</h2>
                <p className="text-sm opacity-90">{selected.phone}</p>
              </div>
              <button onClick={() => { setSelected(null); setShowModifyMenu(false); setEditingNotes(false); }} className="text-2xl text-white/80 hover:text-white leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* RESERVATION */}
              <div className="p-6 border-b border-cream-dark">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-lg font-semibold text-navy">Reservation</h3>
                    {selected.source === "goibibo" && <span className="text-sm font-bold text-orange-500">goibibo</span>}
                    {selected.source === "agoda" && <span className="text-sm font-bold text-red-500">agoda</span>}
                    {selected.source === "makemytrip" && <span className="text-sm font-bold text-red-600">make<span className="text-blue-600">MyTrip</span></span>}
                    {selected.source === "expedia" && <span className="text-sm font-bold text-blue-800">Expedia</span>}
                    {selected.source === "booking" && <span className="text-sm font-bold text-indigo-600">Booking.com</span>}
                  </div>
                  <div className="relative">
                    <button onClick={() => setShowModifyMenu(!showModifyMenu)} className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">✏️ Modify</button>
                    {showModifyMenu && (
                      <div className="absolute top-full right-0 mt-2 z-20 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[200px] py-1">
                        {modifyOptions.map((opt) => (
                          <button key={opt} onClick={() => handleModifyOption(opt)} className="w-full text-left px-4 py-2 text-sm text-navy/80 hover:bg-cream transition-colors">{opt}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-navy/70 mb-4">
                  {selected.id}
                  {selected.otaId && ` ( OTA ID : ${selected.otaId}`}
                  {selected.otaPin && ` , PIN : ${selected.otaPin} )`}
                  {selected.otaId && !selected.otaPin && ` )`}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <Row label="Dates" value={`${prettyDateTime(selected.checkIn)} - ${prettyDateTime(selected.checkOut, "11:00 AM")} ( ${nightsBetween(selected.checkIn, selected.checkOut)} Night${nightsBetween(selected.checkIn, selected.checkOut) > 1 ? "s" : ""} )`} />
                  <Row label="Room type" value={`${selected.roomType} ( ${selected.ratePlan} )`} />
                  <Row label="Booked Room No.(s)" value={selected.roomNumber} />
                  <Row label="Booking made on" value={prettyDateTime(selected.bookingMadeOn, "01:52 PM")} />
                  <Row label="Booking source" value={selected.source.toUpperCase()} />
                  {selected.otaId && <Row label="OTA Booking Id" value={selected.otaId} />}
                  {selected.otaPin && <Row label="Reservation PIN" value={selected.otaPin} />}
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  <button onClick={() => setFolioFor(selected)} className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition">View folio</button>
                  <button onClick={() => setRegCardFor(selected)} className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition">Print registration card</button>
                  <button onClick={() => showToast(`✉️ Confirmation emailed to ${selected.email || selected.guest}`)} className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition">Email confirmation</button>
                </div>
              </div>

              {/* FRONT DESK ACTIONS */}
              <div className="p-6 border-b border-cream-dark bg-cream/30">
                <h3 className="font-serif text-lg font-semibold text-navy mb-4">Front Desk Actions</h3>
                <div className="space-y-2">
                  {selected.status === "CONFIRMED" && (
                    <button onClick={() => handleCheckIn(selected)} className="w-full py-3 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition flex items-center justify-center gap-2">
                      ✅ Check-In Guest
                    </button>
                  )}
                  {(selected.status === "CHECKED-IN" || selected.status === "PENDING DEPARTURE") && (
                    <>
                      {selected.amount - selected.paid > 0 && (
                        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800 mb-2">
                          ⚠ Balance ₹{(selected.amount - selected.paid).toFixed(2)} due before check-out
                        </div>
                      )}
                      <button
                        onClick={() => handleCheckOut(selected)}
                        className={`w-full py-3 rounded-lg text-white font-semibold transition ${
                          selected.amount - selected.paid > 0 ? "bg-rose-300 cursor-not-allowed" : "bg-rose-500 hover:bg-rose-600"
                        }`}
                      >
                        🚪 Check-Out Guest
                      </button>
                    </>
                  )}
                  {selected.status === "BLOCKED" && (
                    <button onClick={() => updateStatus(selected.id, "CONFIRMED", `🔓 Room ${selected.roomNumber} unblocked`)} className="w-full py-3 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition">
                      🔓 Unblock Room
                    </button>
                  )}
                  {(selected.status === "CHECKED-OUT" || selected.status === "CANCELLED") && (
                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-sm text-gray-600 text-center">
                      ✓ Booking is {selected.status.toLowerCase()} · No further actions
                    </div>
                  )}
                </div>
              </div>

              {/* GUESTS */}
              <div className="p-6 border-b border-cream-dark">
                <h3 className="font-serif text-lg font-semibold text-navy mb-4">Guests</h3>
                <p className="text-sm text-navy/80 mb-4">
                  {selected.adults} Adults , {selected.children} Children , {selected.infants || 0} Infants
                </p>
                <div className="space-y-2 mb-3">
                  {(selected.guestList || [selected.guest]).map((g, i) => (
                    <div key={i} className="text-sm font-semibold text-navy border-b border-cream-dark pb-2">{g}</div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newGuestInput} onChange={(e) => setNewGuestInput(e.target.value)} placeholder="Guest name" className="flex-1 px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
                  <button onClick={() => handleAddGuest(selected)} className="px-4 py-2 bg-navy text-cream rounded-lg text-sm font-medium hover:bg-navy-light transition">+ Add</button>
                </div>
              </div>

              {/* PAYMENT */}
              <div className="p-6 border-b border-cream-dark">
                <h3 className="font-serif text-lg font-semibold text-navy mb-4">Payment details</h3>
                <div className="space-y-2 text-sm mb-4">
                  <Row label="Final amount with tax" value={`INR ${selected.amount.toLocaleString("en-IN")}`} />
                  <Row label="Payment made" value={`INR ${selected.paid.toLocaleString("en-IN")}`} />
                  <Row label="Balance due" value={`INR ${(selected.amount - selected.paid).toLocaleString("en-IN")}`} valueClass={selected.amount - selected.paid > 0 ? "text-rose-500 font-bold" : "text-emerald-600 font-bold"} />
                </div>
                {selected.paid < selected.amount && (
                  <div className="border-t border-cream-dark pt-4 space-y-3">
                    <p className="text-xs text-muted uppercase tracking-wide">Record payment</p>
                    <div className="flex gap-2">
                      <input type="number" value={paymentInput} onChange={(e) => setPaymentInput(e.target.value)} placeholder="Amount ₹" className="flex-1 px-3 py-2 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold" />
                      <button onClick={() => handleSettlePartial(selected)} className="px-4 py-2 bg-navy text-cream rounded-lg text-sm font-medium hover:bg-navy-light transition">Record</button>
                    </div>
                    <button onClick={() => handleSettleFull(selected)} className="w-full py-2.5 rounded-lg border-2 border-gold text-gold-dark font-semibold hover:bg-gold/10 transition">
                      $ Settle Full Balance (₹{(selected.amount - selected.paid).toFixed(2)})
                    </button>
                  </div>
                )}
                {selected.paid >= selected.amount && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-sm text-emerald-800 text-center">
                    ✓ Fully paid · No dues
                  </div>
                )}
              </div>

              {/* NOTES */}
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg font-semibold text-navy">Notes</h3>
                  {!editingNotes && (
                    <button onClick={() => { setEditingNotes(true); setNotesDraft(selected.notes || ""); }} className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition">
                      {selected.notes ? "Edit notes" : "+ Add notes"}
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={3} className="w-full p-3 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors" placeholder="Enter booking notes…" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 text-sm text-navy/60 hover:text-navy">Cancel</button>
                      <button onClick={() => handleSaveNotes(selected)} className="px-4 py-1.5 bg-navy text-cream rounded-lg text-sm font-medium">Save</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted">{selected.notes ? selected.notes : "No booking notes"}</p>
                )}
              </div>

              {/* Cancel booking at bottom */}
              {selected.status !== "CANCELLED" && selected.status !== "CHECKED-OUT" && (
                <div className="p-6 border-t border-cream-dark">
                  <button
                    onClick={() => {
                      if (confirm(`Cancel booking for ${selected.guest}?`)) {
                        updateStatus(selected.id, "CANCELLED", `❌ Booking cancelled`);
                      }
                    }}
                    className="w-full py-2.5 rounded-lg border border-rose-300 text-rose-600 font-semibold hover:bg-rose-50 transition"
                  >
                    ❌ Cancel Booking
                  </button>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* ═══ FOLIO MODAL ═══ */}
      {folioFor && (
        <FolioModal
          booking={folioFor}
          onClose={() => setFolioFor(null)}
          onSettle={() => {
            handleSettleFull(folioFor);
            setFolioFor({ ...folioFor, paid
