"use client";

import { useState, useEffect } from "react";
import type { Booking, Payment } from "../types";
import { getPaid, getBalance } from "../types";
import { fetchPaymentsForBooking, type PaymentRecord } from "../db";

export default function FolioModal({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const data = await fetchPaymentsForBooking(booking.id);
      setPayments(data);
    } catch (err) {
      console.error("Failed to load payments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id]);

  // Calculated totals
  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000
    )
  );

  const totalWithTax = booking.amount || 0;
  const totalTax = booking.tax || Math.round(totalWithTax * 0.05);
  const totalExclTax = totalWithTax - totalTax;
  const gst = Math.round(totalTax / 2);
  const cgst = Math.round((totalTax - gst) / 2);
  const sgst = totalTax - gst - cgst;

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = Math.max(0, totalWithTax - totalPaid);

  const paidByMode = (mode: string) =>
    payments
      .filter((p) => p.method.toLowerCase().includes(mode.toLowerCase()))
      .reduce((s, p) => s + (p.amount || 0), 0);

  const handleSettleDues = () => {
    alert("Settle Dues — opens the Settle Dues dropdown (coming next)");
  };

  const handleCheckOut = () => {
    alert("Check-out — confirmation flow (coming next)");
  };

  return (
    <div className="fixed inset-0 bg-white z-[80] flex flex-col overflow-hidden">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* TOP HEADER                                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm">
            V
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Vishara Elite</p>
            <p className="text-[10px] text-gray-500">Current Invoice Mode: Summary Invoice ▾</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500">Tax Invoice#</p>
          <p className="text-sm font-semibold text-gray-900">
            {booking.bookingRef || `SFBOOKING_${booking.id.slice(0, 8)}`}
          </p>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600">⋮</button>
            <button className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600">⟳</button>
            <button className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600">🖨</button>
            <button
              onClick={onClose}
              className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600 text-xl"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* BODY — 2 columns                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-full">
          {/* ═══════════════════════════════════════════════════ */}
          {/* LEFT — Invoice details                             */}
          {/* ═══════════════════════════════════════════════════ */}
          <div className="lg:col-span-2 bg-white p-6 space-y-5">

            {/* Bill-to header */}
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-base font-semibold text-gray-900">
                Bill to : <span className="underline">{booking.primaryGuest.name}</span>
              </p>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50">
                Guest list
              </button>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-xs">+</button>
              <select className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium">
                <option>{booking.source?.toUpperCase() || "DIRECT"}</option>
              </select>
              <select className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium">
                <option>WALK-IN</option>
              </select>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                  booking.status === "CHECKED-IN"
                    ? "bg-teal-100 text-teal-700"
                    : booking.status === "CONFIRMED"
                    ? "bg-amber-100 text-amber-700"
                    : booking.status === "CHECKED-OUT"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {booking.status}
              </span>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 text-sm">
              {/* Left column */}
              <div className="space-y-2.5">
                <div className="flex gap-4">
                  <span className="w-32 text-gray-500 text-xs">Address</span>
                  <span className="text-gray-900 text-xs flex-1">
                    {booking.primaryGuest.address || "—"}
                    {booking.primaryGuest.city ? `, ${booking.primaryGuest.city}` : ""}
                    {booking.primaryGuest.state ? `, ${booking.primaryGuest.state}` : ""}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-32 text-gray-500 text-xs">Email</span>
                  <span className="text-gray-900 text-xs flex-1">
                    {booking.primaryGuest.email || "—"}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-32 text-gray-500 text-xs">Phone</span>
                  <span className="text-gray-900 text-xs flex-1">
                    {booking.primaryGuest.phone || "—"}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-32 text-gray-500 text-xs">GST Number</span>
                  <span className="text-gray-900 text-xs flex-1 underline cursor-pointer">
                    Edit GST number
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-32 text-gray-500 text-xs">Booking reference id</span>
                  <span className="text-gray-900 text-xs flex-1 underline cursor-pointer">
                    Edit booking reference id
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-32 text-gray-500 text-xs">Room type</span>
                  <span className="text-gray-900 text-xs flex-1 font-medium">
                    {booking.roomType || "—"}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-32 text-gray-500 text-xs">Rate plans</span>
                  <span className="text-gray-900 text-xs flex-1">
                    {booking.ratePlan || "EP"}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-32 text-gray-500 text-xs">Access code</span>
                  <span className="text-gray-900 text-xs flex-1">
                    {booking.roomNumber} - NA,
                  </span>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-2.5">
                <div className="flex gap-4">
                  <span className="w-40 text-gray-500 text-xs">Booking made on</span>
                  <span className="text-gray-900 text-xs">
                    {booking.bookingMadeOn
                      ? new Date(booking.bookingMadeOn).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-40 text-gray-500 text-xs">Checkin</span>
                  <span className="text-gray-900 text-xs">
                    {new Date(booking.checkIn).toLocaleString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    12:00 PM
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-40 text-gray-500 text-xs">Checkout</span>
                  <span className="text-gray-900 text-xs">
                    {new Date(booking.checkOut).toLocaleString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    11:00 AM
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-40 text-gray-500 text-xs">Room ID</span>
                  <span className="text-gray-900 text-xs font-medium">
                    {booking.roomNumber}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-40 text-gray-500 text-xs">Nights</span>
                  <span className="text-gray-900 text-xs">{nights}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-40 text-gray-500 text-xs">Adults/Children/Infant</span>
                  <span className="text-gray-900 text-xs">
                    {booking.adults}/{booking.children}/{booking.infants || 0}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-40 text-gray-500 text-xs">Customer Notes</span>
                  <span className="text-teal-600 text-xs underline cursor-pointer">
                    Add / View customer notes (0)
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-40 text-gray-500 text-xs">Booking Notes</span>
                  <span className="text-teal-600 text-xs underline cursor-pointer">
                    Add / View booking notes ({booking.notes ? 1 : 0})
                  </span>
                </div>
              </div>
            </div>

            {/* ═══ Invoice table ═══ */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-2 w-8">
                        <input type="checkbox" className="rounded" />
                      </th>
                      <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider">
                        Date
                      </th>
                      <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider">
                        Description
                      </th>
                      <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider">
                        Type
                      </th>
                      <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider text-right">
                        Sub-total (Rs.)
                      </th>
                      <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider text-right">
                        Cumulative tax %
                      </th>
                      <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider text-right">
                        Tax (Rs.)
                      </th>
                      <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider text-right">
                        Total (Rs.)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">
                        <input type="checkbox" className="rounded" />
                      </td>
                      <td className="py-3 text-gray-700">
                        {new Date(booking.checkIn).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 text-gray-700">Booking Price</td>
                      <td className="py-3 text-gray-700">DEBIT</td>
                      <td className="py-3 text-right text-gray-900 font-medium">
                        {totalExclTax.toFixed(2)}
                      </td>
                      <td className="py-3 text-right text-gray-700">5.00</td>
                      <td className="py-3 text-right text-gray-900">{totalTax.toFixed(2)}</td>
                      <td className="py-3 text-right text-gray-900 font-semibold">
                        {totalWithTax.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <select className="border border-gray-300 rounded px-2 py-1 text-xs">
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                </select>
                <span className="flex-1" />
                <div className="w-6 h-6 rounded bg-teal-500 text-white flex items-center justify-center font-semibold text-xs">
                  1
                </div>
              </div>
            </div>

          </div>

          {/* ═══════════════════════════════════════════════════ */}
          {/* RIGHT — Folio summary                              */}
          {/* ═══════════════════════════════════════════════════ */}
          <div className="bg-white border-l border-gray-200 flex flex-col">

            {/* Header */}
            <div className="bg-teal-500 text-white text-center py-3">
              <p className="text-sm font-semibold">Folio summary</p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">

              {/* Booking Amount Breakdown */}
              <div>
                <p className="text-center text-xs font-semibold text-teal-700 underline mb-3">
                  Booking Amount Breakdown
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total without taxes</span>
                    <span className="text-gray-900">Rs. {totalExclTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total tax amount</span>
                    <span className="text-gray-900">Rs. {totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="text-gray-700 font-medium">Total with taxes and fees</span>
                    <span className="text-gray-900 font-medium">Rs. {totalWithTax.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Room Taxes Breakdown */}
              <div>
                <p className="text-center text-xs font-semibold text-teal-700 underline mb-3">
                  Room Taxes Breakdown
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">GST</span>
                    <span className="text-gray-900">Rs. {gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CGST</span>
                    <span className="text-gray-900">Rs. {cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">SGST</span>
                    <span className="text-gray-900">Rs. {sgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="text-gray-600">Service taxes</span>
                    <span className="text-gray-900">Rs. 0.00</span>
                  </div>
                </div>
              </div>

              {/* Payment Breakdown */}
              <div>
                <p className="text-center text-xs font-semibold text-teal-700 underline mb-3">
                  Payment Breakdown
                </p>
                <div className="space-y-2">
                  {payments.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center">
                      No payments recorded
                    </p>
                  )}
                  {paidByMode("cash") > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cash payment</span>
                      <span className="text-gray-900">Rs. {paidByMode("cash").toFixed(2)}</span>
                    </div>
                  )}
                  {paidByMode("upi") > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">UPI payment</span>
                      <span className="text-gray-900">Rs. {paidByMode("upi").toFixed(2)}</span>
                    </div>
                  )}
                  {paidByMode("card") > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Card payment</span>
                      <span className="text-gray-900">Rs. {paidByMode("card").toFixed(2)}</span>
                    </div>
                  )}
                  {paidByMode("ota") > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">OTA prepaid</span>
                      <span className="text-gray-900">Rs. {paidByMode("ota").toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="text-gray-700 font-medium">Payment made</span>
                    <span className="text-gray-900 font-medium">Rs. {totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-medium">Balance due 🔄</span>
                    <span className={`font-medium ${balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      Rs. {balanceDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer — Settle dues / Check-out */}
            <div className="border-t border-gray-200 p-4 flex justify-between items-center">
              <button
                onClick={handleSettleDues}
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800 transition"
              >
                Settle dues
              </button>
              {booking.status === "CHECKED-IN" ? (
                <button
                  onClick={handleCheckOut}
                  className="px-5 py-2.5 bg-teal-500 text-white text-xs font-semibold rounded-md hover:bg-teal-600 transition"
                >
                  Check-out
                </button>
              ) : booking.status === "CONFIRMED" ? (
                <button
                  onClick={handleCheckOut}
                  className="px-5 py-2.5 bg-teal-500 text-white text-xs font-semibold rounded-md hover:bg-teal-600 transition"
                >
                  Check-in
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
