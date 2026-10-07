// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useActiveHotel } from "../lib/use-active-hotel";
import { fetchBookings } from "../db";

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function fmtFull(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatPrettyDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const date = new Date(y, m - 1, d);
  return `${days[date.getDay()]}, ${d} ${months[m - 1]} ${y}`;
}

type KpiType = "arrivals" | "departures" | "newbookings" | "inhouse";

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════
export default function DashboardPage() {
  const { hotelId, loading: hotelLoading } = useActiveHotel();

  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKpi, setActiveKpi] = useState<KpiType>("arrivals");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [detailsBooking, setDetailsBooking] = useState<any | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ═══ Load bookings ═══
  const loadBookings = useCallback(async () => {
    if (!hotelId) return;
    try {
      setLoading(true);
      const data = await fetchBookings(hotelId);
      setAllBookings(data || []);
    } catch (err) {
      console.error("[Dashboard] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (!hotelLoading && hotelId) {
      loadBookings();
    }
  }, [hotelId, hotelLoading, loadBookings]);

  useEffect(() => {
    const handler = () => loadBookings();
    window.addEventListener("booking-updated", handler);
    window.addEventListener("hotel-changed", handler);
    return () => {
      window.removeEventListener("booking-updated", handler);
      window.removeEventListener("hotel-changed", handler);
    };
  }, [loadBookings]);

  // ═══ Filter by selected date ═══
  const arrivals = useMemo(() => {
    return allBookings.filter((b: any) => {
      const ci = (b.check_in || b.checkIn || "").split("T")[0];
      return ci === selectedDate;
    });
  }, [allBookings, selectedDate]);

  const departures = useMemo(() => {
    return allBookings.filter((b: any) => {
      const co = (b.check_out || b.checkOut || "").split("T")[0];
      return co === selectedDate;
    });
  }, [allBookings, selectedDate]);

  const newBookings = useMemo(() => {
    return allBookings.filter((b: any) => {
      const created = (b.created_at || b.createdAt || "").split("T")[0];
      return created === selectedDate;
    });
  }, [allBookings, selectedDate]);

  const inHouse = useMemo(() => {
    return allBookings.filter((b: any) => {
      const status = (b.status || "").toUpperCase();
      return status === "CHECKED-IN" || status === "PENDING DEPARTURE";
    });
  }, [allBookings]);

  // ═══ KPI counts for selected date ═══
  const kpiCounts = {
    arrivals: arrivals.length,
    departures: departures.length,
    newbookings: newBookings.length,
    inhouse: inHouse.length,
  };

  // ═══ Sub-filter logic ═══
  const filteredList = useMemo(() => {
    let base: any[] = [];
    if (activeKpi === "arrivals") base = arrivals;
    else if (activeKpi === "departures") base = departures;
    else if (activeKpi === "newbookings") base = newBookings;
    else if (activeKpi === "inhouse") base = inHouse;

    if (subFilter === "all") return base;

    if (activeKpi === "arrivals") {
      if (subFilter === "checkedin") base = base.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN");
      else if (subFilter === "pending") base = base.filter((b) => (b.status || "").toUpperCase() === "CONFIRMED");
    } else if (activeKpi === "departures") {
      if (subFilter === "checkedout") base = base.filter((b) => (b.status || "").toUpperCase() === "CHECKED-OUT");
      else if (subFilter === "pending") base = base.filter((b) => {
        const s = (b.status || "").toUpperCase();
        return s === "CHECKED-IN" || s === "PENDING DEPARTURE";
      });
    } else if (activeKpi === "newbookings") {
      if (subFilter === "confirmed") base = base.filter((b) => (b.status || "").toUpperCase() === "CONFIRMED");
      else if (subFilter === "checkedin") base = base.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN");
    } else if (activeKpi === "inhouse") {
      if (subFilter === "checkedin") base = base.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN");
      else if (subFilter === "pendingout") base = base.filter((b) => (b.status || "").toUpperCase() === "PENDING DEPARTURE");
    }

    return base;
  }, [activeKpi, subFilter, arrivals, departures, newBookings, inHouse]);

  // ═══ Sub-filter counts ═══
  const subFilterData = useMemo(() => {
    if (activeKpi === "arrivals") {
      return [
        { key: "all", label: "All Arrivals", count: arrivals.length },
        { key: "checkedin", label: "Checked In", count: arrivals.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN").length },
        { key: "pending", label: "Pending Arrival", count: arrivals.filter((b) => (b.status || "").toUpperCase() === "CONFIRMED").length },
      ];
    }
    if (activeKpi === "departures") {
      return [
        { key: "all", label: "All Departures", count: departures.length },
        { key: "checkedout", label: "Checked Out", count: departures.filter((b) => (b.status || "").toUpperCase() === "CHECKED-OUT").length },
        { key: "pending", label: "Pending Check-out", count: departures.filter((b) => {
          const s = (b.status || "").toUpperCase();
          return s === "CHECKED-IN" || s === "PENDING DEPARTURE";
        }).length },
      ];
    }
    if (activeKpi === "newbookings") {
      return [
        { key: "all", label: "All Bookings", count: newBookings.length },
        { key: "confirmed", label: "Confirmed", count: newBookings.filter((b) => (b.status || "").toUpperCase() === "CONFIRMED").length },
        { key: "checkedin", label: "Checked In", count: newBookings.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN").length },
      ];
    }
    if (activeKpi === "inhouse") {
      return [
        { key: "all", label: "All In-House", count: inHouse.length },
        { key: "checkedin", label: "Checked In", count: inHouse.filter((b) => (b.status || "").toUpperCase() === "CHECKED-IN").length },
        { key: "pendingout", label: "Pending Departure", count: inHouse.filter((b) => (b.status || "").toUpperCase() === "PENDING DEPARTURE").length },
      ];
    }
    return [];
  }, [activeKpi, arrivals, departures, newBookings, inHouse]);

  // Reset sub-filter when KPI changes
  useEffect(() => {
    setSubFilter("all");
  }, [activeKpi]);

  // ═══ PDF Download ═══
  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 80, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Staynexa PMS", 40, 40);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 184, 166);
      doc.text(activeKpi.toUpperCase() + " REPORT", 40, 60);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(`Date: ${formatPrettyDate(selectedDate)}`, pageWidth - 40, 45, { align: "right" });

      autoTable(doc, {
        startY: 110,
        head: [["#", "Guest", "Room", "Status", "Check-in", "Check-out", "Balance"]],
        body: filteredList.map((b: any, i: number) => [
          String(i + 1),
          b.guestName || b.primaryGuest?.name || "Guest",
          b.roomNumber || b.room?.room_number || "—",
          b.status || "—",
          (b.check_in || b.checkIn || "—").split("T")[0],
          (b.check_out || b.checkOut || "—").split("T")[0],
          b.balance > 0 ? fmtFull(b.balance) : "Paid",
        ]),
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        margin: { left: 40, right: 40 },
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Staynexa PMS · Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 25,
          { align: "center" }
        );
      }

      doc.save(`Staynexa-${activeKpi}-${selectedDate}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("PDF failed");
    } finally {
      setDownloading(false);
    }
  };

  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setSelectedDate(next);
  };

  if (loading || hotelLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-slate-500 font-semibold text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const kpiConfig: { key: KpiType; label: string; icon: string; color: string }[] = [
    { key: "arrivals", label: "Arrivals", icon: "🛬", color: "emerald" },
    { key: "departures", label: "Departures", icon: "🛫", color: "rose" },
    { key: "newbookings", label: "New Bookings", icon: "✨", color: "indigo" },
    { key: "inhouse", label: "In-House", icon: "👥", color: "sky" },
  ];

  const colorMap: any = {
    emerald: { bg: "bg-emerald-500", light: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", ring: "ring-emerald-500/20" },
    rose: { bg: "bg-rose-500", light: "bg-rose-50", border: "border-rose-300", text: "text-rose-700", ring: "ring-rose-500/20" },
    indigo: { bg: "bg-indigo-500", light: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700", ring: "ring-indigo-500/20" },
    sky: { bg: "bg-sky-500", light: "bg-sky-50", border: "border-sky-300", text: "text-sky-700", ring: "ring-sky-500/20" },
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-5">

        {/* ═══ HEADER with DATE PICKER ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-xs text-slate-500 mt-0.5">Click any date to view bookings for that day</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Prev */}
              <button
                onClick={() => changeDate(-1)}
                className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-sm font-bold"
              >
                ←
              </button>

              {/* Date Picker */}
              <div className="relative">
                <button
                  onClick={() => setCalendarOpen(!calendarOpen)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800"
                >
                  📅 {formatPrettyDate(selectedDate)}
                </button>

                {calendarOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setCalendarOpen(false)} />
                    <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-72">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          setCalendarOpen(false);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-teal-500"
                      />
                      <div className="mt-3 space-y-1">
                        <button
                          onClick={() => { setSelectedDate(todayISO()); setCalendarOpen(false); }}
                          className="w-full text-left text-xs font-bold px-3 py-2 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100"
                        >
                          📍 Today ({formatPrettyDate(todayISO())})
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Next */}
              <button
                onClick={() => changeDate(1)}
                className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-sm font-bold"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* ═══ KPI CARDS (Clickable) ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiConfig.map((k) => {
            const c = colorMap[k.color];
            const isActive = activeKpi === k.key;
            const count = kpiCounts[k.key];
            return (
              <button
                key={k.key}
                onClick={() => setActiveKpi(k.key)}
                className={`relative text-left p-5 rounded-2xl border-2 transition-all ${
                  isActive
                    ? `${c.light} ${c.border} ring-4 ${c.ring} shadow-md`
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center text-white text-lg mb-3 shadow-sm`}>
                  {k.icon}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k.label}</p>
                <p className={`text-3xl font-bold mt-1 ${isActive ? c.text : "text-slate-900"}`}>{count}</p>
              </button>
            );
          })}
        </div>

        {/* ═══ SUB-FILTERS + LIST ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${colorMap[kpiConfig.find(k => k.key === activeKpi)!.color].bg} flex items-center justify-center text-white text-lg shadow-sm`}>
                {kpiConfig.find(k => k.key === activeKpi)!.icon}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {kpiConfig.find(k => k.key === activeKpi)!.label}
                </h2>
                <p className="text-[11px] text-slate-500">{formatPrettyDate(selectedDate)} · {filteredList.length} items</p>
              </div>
            </div>
            <button
              onClick={downloadPDF}
              disabled={downloading}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
            >
              {downloading ? "…" : "📄 Download PDF"}
            </button>
          </div>

          {/* Sub-filter tabs (only 2-3 options per KPI) */}
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
            {subFilterData.map((sf) => (
              <button
                key={sf.key}
                onClick={() => setSubFilter(sf.key)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  subFilter === sf.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sf.label} <span className="opacity-70">({sf.count})</span>
              </button>
            ))}
          </div>

          {/* List */}
          <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
            {filteredList.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-3 opacity-20">📭</p>
                <p className="text-sm font-semibold text-slate-500">No bookings found</p>
                <p className="text-xs text-slate-400 mt-1">Nothing on {formatPrettyDate(selectedDate)} for this filter</p>
              </div>
            ) : (
              filteredList.map((b: any) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  onView={() => setDetailsBooking(b)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══ DETAILS MODAL ═══ */}
      {detailsBooking && (
        <BookingDetailsModal
          booking={detailsBooking}
          onClose={() => setDetailsBooking(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// BOOKING ROW
// ═══════════════════════════════════════════════
function BookingRow({ booking, onView }: { booking: any; onView: () => void }) {
  const name = booking.guestName || booking.primaryGuest?.name || "Guest";
  const room = booking.roomNumber || booking.room?.room_number || "—";
  const status = booking.status || "—";
  const balance = booking.balance || 0;

  const statusColors: any = {
    "CONFIRMED": "bg-amber-100 text-amber-700",
    "CHECKED-IN": "bg-emerald-100 text-emerald-700",
    "CHECKED-OUT": "bg-blue-100 text-blue-700",
    "PENDING DEPARTURE": "bg-orange-100 text-orange-700",
    "CANCELLED": "bg-rose-100 text-rose-700",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 transition">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
        <p className="text-[11px] text-slate-500 truncate">
          Room {room} · {(booking.check_in || booking.checkIn || "—").split("T")[0]} → {(booking.check_out || booking.checkOut || "—").split("T")[0]}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {balance > 0 && (
          <span className="text-xs font-bold text-rose-600 hidden sm:block">{fmtFull(balance)}</span>
        )}
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusColors[status] || "bg-slate-100 text-slate-600"}`}>
          {status}
        </span>
        <button
          onClick={onView}
          className="text-[10px] font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition"
        >
          View
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// DETAILS MODAL
// ═══════════════════════════════════════════════
function BookingDetailsModal({ booking, onClose }: any) {
  const name = booking.guestName || booking.primaryGuest?.name || "Guest";
  const total = (booking.amount || 0) + (booking.tax || 0);
  const paid = booking.paid || 0;
  const balance = total - paid;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{name}</h3>
              <p className="text-[10px] text-slate-500">{booking.booking_ref || booking.bookingRef || "—"}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-lg">
            ×
          </button>
        </div>
        <div className="p-6 space-y-2">
          <Row label="Room" value={booking.roomNumber || booking.room?.room_number || "—"} />
          <Row label="Status" value={booking.status || "—"} />
          <Row label="Check-in" value={(booking.check_in || booking.checkIn || "—").split("T")[0]} />
          <Row label="Check-out" value={(booking.check_out || booking.checkOut || "—").split("T")[0]} />
          {booking.adults !== undefined && <Row label="Adults" value={String(booking.adults)} />}
          {booking.children !== undefined && <Row label="Children" value={String(booking.children)} />}
          <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
            <Row label="Total Amount" value={fmtFull(total)} />
            <Row label="Paid" value={fmtFull(paid)} highlight="emerald" />
            {balance > 0 && <Row label="Balance Due" value={fmtFull(balance)} highlight="rose" />}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: any) {
  const colors: any = { rose: "text-rose-600 font-bold", emerald: "text-emerald-600 font-bold" };
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm ${highlight ? colors[highlight] : "font-semibold text-slate-800"}`}>{value}</span>
    </div>
  );
}