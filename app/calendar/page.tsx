"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  bookings as seedBookings,
  rooms,
  statusColors,
  statusLabels,
  type Booking,
} from "../data";

// ─── DATE HELPERS ───
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
  const da = parseISO(a).getTime();
  const db = parseISO(b).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}
function shortFmt(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] };
}
function bookingSpansDate(b: Booking, date: Date): boolean {
  const dateStr = fmt(date);
  return b.checkIn <= dateStr && b.checkOut > dateStr;
}
function prettyDate(iso: string): string {
  const d = parseISO(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function prettyDateTime(iso: string): string {
  const d = parseISO(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, 12:00 PM`;
}
function nightsBetween(a: string, b: string): number {
  return Math.max(1, daysBetween(a, b));
}

// ─── LEGEND ───
const legendItems = [
  { label: "Confirmed", color: "bg-amber-400" },
  { label: "Checked-in", color: "bg-emerald-500" },
  { label: "Checked-out / Due out", color: "bg-rose-500" },
  { label: "Blocked", color: "bg-blue-500" },
  { label: "Cancelled", color: "bg-gray-300" },
];

// ─── MODIFY OPTIONS ───
const modifyOptions = [
  "Hold booking",
  "Set to no show",
  "Lock booking",
  "Unassign room",
  "Modify checkin",
  "Modify checkout",
  "Split Room",
  "Move Room",
  "Send magic link",
];

// Cell dimensions
const CELL_WIDTH = 80;
const ROW_HEIGHT = 56;

export default function CalendarPage() {
  const [startDate, setStartDate] = useState("2026-09-12");
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // ─── DRAG STATE ───
  const [drag, setDrag] = useState<{
    bookingId: string;
    startX: number;
    startY: number;
    offsetDays: number;
    offsetRooms: number;
    originRoom: string;
    originCheckIn: string;
    originCheckOut: string;
  } | null>(null);
  const [preview, setPreview] = useState<{ room: string; checkIn: string; checkOut: string } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

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
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)));
    if (selected?.id === id) setSelected({ ...selected, status: newStatus });
    showToast(message);
  };

  const updateField = <K extends keyof Booking>(id: string, field: K, value: Booking[K], message: string) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
    if (selected?.id === id) setSelected({ ...selected, [field]: value });
    showToast(message);
  };

  // ─── DRAG HANDLERS ───
  const onDragStart = (e: React.MouseEvent | React.TouchEvent, b: Booking) => {
    const point = "touches" in e ? e.touches[0] : e;
    setDrag({
      bookingId: b.id,
      startX: point.clientX,
      startY: point.clientY,
      offsetDays: 0,
      offsetRooms: 0,
      originRoom: b.roomNumber,
      originCheckIn: b.checkIn,
      originCheckOut: b.checkOut,
    });
    setPreview({ room: b.roomNumber, checkIn: b.checkIn, checkOut: b.checkOut });
    e.preventDefault();
  };

  // Global move + up listeners during drag
  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const point = "touches" in e ? e.touches[0] : e;
      const dx = point.clientX - drag.startX;
      const dy = point.clientY - drag.startY;
      const daysOffset = Math.round(dx / CELL_WIDTH);
      const roomsOffset = Math.round(dy / ROW_HEIGHT);

      if (daysOffset !== drag.offsetDays || roomsOffset !== drag.offsetRooms) {
        const roomIdx = rooms.findIndex((r) => r.number === drag.originRoom);
        const newRoomIdx = Math.max(0, Math.min(rooms.length - 1, roomIdx + roomsOffset));

        const nights = daysBetween(drag.originCheckIn, drag.originCheckOut);
        const newCheckIn = addDays(drag.originCheckIn, daysOffset);
        const newCheckOut = addDays(newCheckIn, nights);

        setDrag((d) => (d ? { ...d, offsetDays: daysOffset, offsetRooms: roomsOffset } : d));
        setPreview({
          room: rooms[newRoomIdx].number,
          checkIn: newCheckIn,
          checkOut: newCheckOut,
        });
      }
    };

    const handleUp = () => {
      if (drag && preview) {
        const changed = preview.room !== drag.originRoom || preview.checkIn !== drag.originCheckIn;
        if (changed) {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === drag.bookingId
                ? { ...b, roomNumber: preview.room, checkIn: preview.checkIn, checkOut: preview.checkOut }
                : b
            )
          );
          setBookings((prev) => {
            const updated = prev.find((b) => b.id === drag.bookingId);
            if (updated) {
              showToast(`✅ Moved ${updated.guest} to Room ${preview.room} · ${prettyDate(preview.checkIn)}`);
            }
            return prev;
          });
        }
      }
      setDrag(null);
      setPreview(null);
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
  }, [drag, preview]);

  // Compute preview position for the ghost bar
  const getPreviewPosition = () => {
    if (!preview) return null;
    const roomIdx = rooms.findIndex((r) => r.number === preview.room);
    const dateIdx = dates.findIndex((d) => fmt(d) === preview.checkIn);
    if (roomIdx === -1) return null;
    const nights = daysBetween(preview.checkIn, preview.checkOut);
    // If checkIn not visible, clamp
    const visibleStartIdx = dateIdx === -1 ? 0 : dateIdx;
    return { roomIdx, visibleStartIdx, nights };
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
        <span className="ml-auto text-gold-dark font-medium">🖱 Drag bookings to move them · 💡 Click to see details</span>
      </div>

      {/* TAPE CHART */}
      <div className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1400px]" ref={gridRef}>
            {/* DATE HEADER */}
            <div className="flex border-b border-cream-dark bg-cream-dark/40">
              <div className="w-32 shrink-0 px-4 py-3 text-xs font-semibold text-navy uppercase tracking-wide border-r border-cream-dark">
                Rooms
              </div>
              {dates.map((d, i) => {
                const s = shortFmt(d);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday = fmt(d) === "2026-09-12";
                return (
                  <div
                    key={i}
                    className={`flex-1 min-w-[80px] px-2 py-2 text-center border-r border-cream-dark ${
                      isWeekend ? "bg-gold/10" : ""
                    } ${isToday ? "bg-gold/20" : ""}`}
                  >
                    <div className="text-[10px] font-medium text-muted uppercase">{s.day}</div>
                    <div className={`text-sm font-semibold ${isToday || isWeekend ? "text-gold-dark" : "text-navy"}`}>
                      {s.date} {s.month}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ROOM ROWS */}
            {rooms.map((room, roomIdx) => (
              <div
                key={room.number}
                className="flex border-b border-cream-dark last:border-b-0 hover:bg-cream/30 transition-colors"
                style={{ height: ROW_HEIGHT }}
              >
                {/* ROOM CELL */}
                <div className="w-32 shrink-0 px-4 py-2 border-r border-cream-dark flex flex-col justify-center">
                  <div className="text-sm font-bold text-navy">{room.number}</div>
                  <div className="text-[10px] text-muted truncate">{room.type}</div>
                </div>

                {/* DATE CELLS */}
                <div className="flex flex-1 relative">
                  {dates.map((d, i) => {
                    const currentBookings = bookings.filter(
                      (b) => b.roomNumber === room.number && bookingSpansDate(b, d)
                    );
                    return (
                      <div
                        key={i}
                        className="flex-1 min-w-[80px] border-r border-cream-dark relative"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {currentBookings.map((b) => {
                          const isFirstDay = fmt(d) === b.checkIn;
                          if (!isFirstDay) return null;

                          const startIdx = dates.findIndex((dd) => fmt(dd) === b.checkIn);
                          const endIdx = dates.findIndex((dd) => fmt(dd) === b.checkOut);
                          const span = endIdx === -1 ? dates.length - startIdx : endIdx - startIdx;
                          const isDragging = drag?.bookingId === b.id;

                          return (
                            <div
                              key={b.id}
                              onMouseDown={(e) => onDragStart(e, b)}
                              onTouchStart={(e) => onDragStart(e, b)}
                              onClick={() => {
                                // Only open modal if it wasn't a drag
                                if (!drag || drag.bookingId !== b.id) setSelected(b);
                              }}
                              className={`absolute top-2 left-1 h-10 ${statusColors[b.status]} rounded-md shadow-sm flex items-center px-2 z-10 overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all ${
                                isDragging ? "opacity-30 pointer-events-none" : "hover:scale-[1.02] hover:shadow-md"
                              }`}
                              style={{ width: `calc(${span} * 100% - 0.5rem)`, minWidth: "100%" }}
                              title="Drag to move · Click for details"
                            >
                              <div className="flex flex-col truncate leading-tight w-full pointer-events-none">
                                <span className="text-[11px] font-semibold truncate">{b.guest}</span>
                                <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">
                                  {statusLabels[b.status]}
                                </span>
                              </div>
                              {/* Drag handle indicator */}
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-50 text-[10px] pointer-events-none">
                                ⠿
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

      {/* ─── DRAG GHOST (preview bar following cursor) ─── */}
      {drag && preview && (
        <div
          className="fixed z-[100] pointer-events-none opacity-80"
          style={{
            left: drag.startX + drag.offsetDays * CELL_WIDTH,
            top: drag.startY + drag.offsetRooms * ROW_HEIGHT,
          }}
        >
          <div className="bg-gold text-navy px-3 py-1.5 rounded-md shadow-2xl text-xs font-semibold">
            Move to Room {preview.room} · {prettyDate(preview.checkIn)}
          </div>
        </div>
      )}

      {/* ─── RESERVATION DETAILS PANEL ─── */}
      {selected && (
        <>
          <div
            className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-40"
            onClick={() => {
              setSelected(null);
              setShowModifyMenu(false);
              setEditingNotes(false);
            }}
          />
          <aside className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="font-serif text-xl font-semibold text-navy">Reservation details</h2>
              <button
                onClick={() => {
                  setSelected(null);
                  setShowModifyMenu(false);
                  setEditingNotes(false);
                }}
                className="text-2xl text-muted hover:text-navy leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* RESERVATION */}
              <div className="p-6 border-b border-cream-dark">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-lg font-semibold text-navy">Reservation</h3>
                    {selected.source === "goibibo" && <span className="text-sm font-bold text-orange-500">goibibo</span>}
                    {selected.source === "agoda" && <span className="text-sm font-bold text-red-500">agoda</span>}
                    {selected.source === "makemytrip" && (
                      <span className="text-sm font-bold text-red-600">
                        make<span className="text-blue-600">MyTrip</span>
                      </span>
                    )}
                    {selected.source === "expedia" && <span className="text-sm font-bold text-blue-800">Expedia</span>}
                    {selected.source === "booking" && <span className="text-sm font-bold text-indigo-600">Booking.com</span>}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setShowModifyMenu(!showModifyMenu)}
                      className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition flex items-center gap-1.5"
                    >
                      ✏️ Modify
                    </button>
                    {showModifyMenu && (
                      <div className="absolute top-full right-0 mt-2 z-20 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[200px] py-1">
                        {modifyOptions.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setShowModifyMenu(false);
                              showToast(`✔ ${opt} applied`);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-navy/80 hover:bg-cream transition-colors"
                          >
                            {opt}
                          </button>
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
                  <Row
                    label="Dates"
                    value={`${prettyDateTime(selected.checkIn)} - ${prettyDateTime(selected.checkOut)} ( ${nightsBetween(
                      selected.checkIn,
                      selected.checkOut
                    )} Night${nightsBetween(selected.checkIn, selected.checkOut) > 1 ? "s" : ""} )`}
                  />
                  <Row label="Room type" value={`${selected.roomType} ( ${selected.ratePlan} )`} />
                  <Row label="Booked Room No.(s)" value={selected.roomNumber} />
                  <Row label="Booking made on" value={prettyDateTime(selected.bookingMadeOn)} />
                  <Row label="Booking source" value={selected.source.toUpperCase()} />
                  {selected.otaId && <Row label="OTA Booking Id" value={selected.otaId} />}
                  {selected.otaPin && <Row label="Reservation PIN" value={selected.otaPin} />}
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  <button
                    onClick={() => updateStatus(selected.id, "CHECKED-OUT", `🚪 ${selected.guest} checked out`)}
                    className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                  >
                    Checkout
                  </button>
                  <button
                    onClick={() => showToast("📄 Opening folio…")}
                    className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                  >
                    View folio
                  </button>
                  <button
                    onClick={() => showToast(`✉️ Confirmation emailed to ${selected.email || selected.guest}`)}
                    className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                  >
                    Email booking confirmation
                  </button>
                  <button
                    onClick={() => showToast("🖨 Printing registration card…")}
                    className="px-4 py-2 border border-cream-dark rounded-lg text-xs font-medium text-navy hover:bg-cream transition"
                  >
                    Print registration card
                  </button>
                </div>
              </div>

              {/* GUESTS */}
              <div className="p-6 border-b border-cream-dark">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg font-semibold text-navy">Guests</h3>
                  <button
                    onClick={() => {
                      const list = [...(selected.guestList || [selected.guest])];
                      if (!list.includes("New Guest")) list.push("New Guest");
                      updateField(selected.id, "guestList", list, "👤 Guest added");
                    }}
                    className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition"
                  >
                    + Add Guests
                  </button>
                </div>
                <p className="text-sm text-navy/80 mb-4">
                  {selected.adults} Adults , {selected.children} Children , {selected.infants || 0} Infants
                </p>
                <div className="space-y-2">
                  {(selected.guestList || [selected.guest]).map((g, i) => (
                    <div key={i} className="text-sm font-semibold text-navy border-b border-cream-dark pb-2">
                      {g}
                    </div>
                  ))}
                </div>
              </div>

              {/* PAYMENT */}
              <div className="p-6 border-b border-cream-dark">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg font-semibold text-navy">Payment details</h3>
                  {selected.paid < selected.amount && (
                    <button
                      onClick={() => updateField(selected.id, "paid", selected.amount, `💰 Dues settled`)}
                      className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition"
                    >
                      $ Settle dues
                    </button>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Final amount with tax" value={`INR ${selected.amount.toLocaleString("en-IN")}`} />
                  <Row label="Payment made" value={`INR ${selected.paid.toLocaleString("en-IN")}`} />
                  <Row
                    label="Balance due"
                    value={`INR ${(selected.amount - selected.paid).toLocaleString("en-IN")}`}
                    valueClass={selected.amount - selected.paid > 0 ? "text-rose-500 font-bold" : "text-emerald-600 font-bold"}
                  />
                </div>
              </div>

              {/* NOTES */}
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg font-semibold text-navy">Notes</h3>
                  {!editingNotes && (
                    <button
                      onClick={() => {
                        setEditingNotes(true);
                        setNotesDraft(selected.notes || "");
                      }}
                      className="px-4 py-1.5 border border-cream-dark rounded-lg text-sm font-medium text-navy hover:bg-cream transition"
                    >
                      + Add notes
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      rows={3}
                      className="w-full p-3 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors"
                      placeholder="Enter booking notes…"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 text-sm text-navy/60 hover:text-navy">
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          updateField(selected.id, "notes", notesDraft, "📝 Notes updated");
                          setEditingNotes(false);
                        }}
                        className="px-4 py-1.5 bg-navy text-cream rounded-lg text-sm font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted">{selected.notes ? selected.notes : "No booking notes"}</p>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-cream px-6 py-3 rounded-full shadow-2xl z-[60] text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}

// Row helper
function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1">
      <span className="text-muted">{label}</span>
      <span className={`text-navy font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
