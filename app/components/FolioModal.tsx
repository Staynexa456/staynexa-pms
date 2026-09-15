"use client";

import { useState, useEffect, useCallback } from "react";
import type { Booking } from "../types";
import {
  fetchPaymentsForBooking,
  fetchAddonsForBooking,
  recordPayment,
  addBookingAddon,
  deleteAddon,
  type PaymentRecord,
} from "../db";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type AddonRecord = {
  id: string;
  description: string;
  amount: number;
  created_at: string;
};

type FolioProps = {
  booking: Booking;
  onClose: () => void;
  refreshKey: number;
  onOpenPaymentManager: () => void;
  onSettleDues: () => void;
  onCheckInOrOut: () => void;
  onPaymentMade: () => void;
  onBookingUpdate: () => void;
};

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export default function FolioModal(props: FolioProps) {
  const {
    booking,
    onClose,
    refreshKey,
    onOpenPaymentManager,
    onSettleDues,
    onCheckInOrOut,
    onPaymentMade,
    onBookingUpdate,
  } = props;

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [addons, setAddons] = useState<AddonRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [threeDotOpen, setThreeDotOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);
  const [addonOpen, setAddonOpen] = useState(false);
  const [addonDesc, setAddonDesc] = useState("");
  const [addonAmount, setAddonAmount] = useState("");
  const [taxExempt, setTaxExempt] = useState(false);

  // ═══ ADDON SELECTION STATE ═══
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [p, a] = await Promise.all([
        fetchPaymentsForBooking(booking.id),
        fetchAddonsForBooking(booking.id).catch(() => []),
      ]);
      setPayments(p);
      setAddons(a);
      // Clear selections when data reloads
      setSelectedAddonIds([]);
    } catch (err) {
      console.error("Failed to load folio:", err);
    } finally {
      setLoading(false);
    }
  }, [booking.id]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // ═══ TOTALS ═══
  const roomCharge = booking.amount || 0;
  const addonsTotal = addons.reduce((s, a) => s + (a.amount || 0), 0);
  const totalWithTax = roomCharge + addonsTotal;
  const totalTax = taxExempt ? 0 : Math.round((totalWithTax / 1.05) * 0.05 * 100) / 100;
  const totalExclTax = totalWithTax - totalTax;
  const gst = Math.round((totalTax / 2) * 100) / 100;
  const cgst = Math.round(((totalTax - gst) / 2) * 100) / 100;
  const sgst = Math.round((totalTax - gst - cgst) * 100) / 100;

  const totalPaid = payments
    .filter((p) => (p.method || "").toLowerCase() !== "addon")
    .reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = Math.max(0, totalWithTax - totalPaid);

  const paidByMode = (mode: string) =>
    payments
      .filter((p) => {
        const m = (p.method || "").toLowerCase();
        if (m === "addon") return false;
        return m.includes(mode.toLowerCase());
      })
      .reduce((s, p) => s + (p.amount || 0), 0);

  // ═══ PAYMENT ═══
  const submitPayment = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      alert("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const clean = paymentMode?.replace(" payment", "").replace("Offline ", "").trim() || "Cash";
      await recordPayment({ bookingId: booking.id, amount: amt, method: clean, reference, note });
      showToast(`💰 ₹${amt.toFixed(2)} recorded via ${clean}`);
      setPaymentMode(null);
      setAmount("");
      setReference("");
      setNote("");
      await loadData();
      onPaymentMade();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ═══ ADDON ═══
  const submitAddon = async () => {
    const amt = parseFloat(addonAmount);
    if (!addonDesc || !amt || amt <= 0) {
      alert("Enter description and amount");
      return;
    }
    try {
      await addBookingAddon({ bookingId: booking.id, description: addonDesc, amount: amt });
      showToast(`✅ Addon "${addonDesc}" added (₹${amt})`);
      setAddonOpen(false);
      setAddonDesc("");
      setAddonAmount("");
      await loadData();
      onPaymentMade();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  // ═══ ADDON SELECTION & DELETE ═══
  const toggleAddonSelection = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllAddons = () => {
    if (selectedAddonIds.length === addons.length && addons.length > 0) {
      setSelectedAddonIds([]);
    } else {
      setSelectedAddonIds(addons.map((a) => a.id));
    }
  };

  const deleteSelectedAddons = async () => {
    if (selectedAddonIds.length === 0) return;
    if (!confirm(`Delete ${selectedAddonIds.length} selected addon(s)? This cannot be undone.`)) return;

    try {
      const count = selectedAddonIds.length;
      for (const id of selectedAddonIds) {
        await deleteAddon(id);
      }
      showToast(`🗑 Deleted ${count} addon(s)`);
      setSelectedAddonIds([]);
      await loadData();
      onPaymentMade();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[80] flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm">V</div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Vishara Elite</p>
            <p className="text-[10px] text-gray-500">Summary Invoice</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500">Tax Invoice#</p>
          <p className="text-sm font-semibold text-gray-900">
            {booking.bookingRef || `SFBOOKING_${booking.id.slice(0, 8)}`}
          </p>
          <div className="flex items-center gap-2 relative">
            <button onClick={() => setThreeDotOpen(!threeDotOpen)} className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600">⋮</button>
            <button onClick={loadData} className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600">⟳</button>
            <button onClick={() => showToast("🖨 Printing...")} className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600">🖨</button>
            <button onClick={onClose} className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600 text-xl">×</button>
            {threeDotOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setThreeDotOpen(false)} />
                <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl w-[520px] p-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <div className="space-y-1">
                      {["Print Registration card","Print C form","Email folio details","Folio log","Edit rate plan","Apply Coupon code / Discount / Offer","Add hotel addons","Tax exempt status","Add Company Details"].map((a) => (
                        <button key={a} onClick={() => { setThreeDotOpen(false); if (a === "Add hotel addons") { setAddonOpen(true); } else if (a === "Tax exempt status") { setTaxExempt(!taxExempt); showToast(`✅ Tax exempt ${!taxExempt ? "enabled" : "disabled"}`); } else { setInfoModal({ title: a, message: `Confirm ${a}?` }); } }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">{a}</button>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {["Lock booking","Unlock booking","Unassign room","Assign Room","Modify checkout","Move Room","Scanty Baggage","Add new room to group booking","Download Booking Voucher"].map((a) => (
                        <button key={a} onClick={() => { setThreeDotOpen(false); setInfoModal({ title: a, message: `Confirm ${a}?` }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">{a}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-full">
          {/* LEFT */}
          <div className="lg:col-span-2 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-base font-semibold text-gray-900">
                Bill to : <span className="underline">{booking.primaryGuest.name}</span>
              </p>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700">Guest list</button>
              <select className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium"><option>{booking.source?.toUpperCase() || "DIRECT"}</option></select>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${booking.status === "CHECKED-IN" ? "bg-teal-100 text-teal-700" : booking.status === "CONFIRMED" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>
                {booking.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 text-sm">
              <div className="space-y-2.5">
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Address</span><span className="text-gray-900 text-xs flex-1">{booking.primaryGuest.address || "—"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Email</span><span className="text-gray-900 text-xs flex-1">{booking.primaryGuest.email || "—"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Phone</span><span className="text-gray-900 text-xs flex-1">{booking.primaryGuest.phone || "—"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Room type</span><span className="text-gray-900 text-xs flex-1 font-medium">{booking.roomType || "—"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Rate plan</span><span className="text-gray-900 text-xs flex-1">{booking.ratePlan || "EP"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Access code</span><span className="text-gray-900 text-xs flex-1">{booking.roomNumber} - NA</span></div>
              </div>
              <div className="space-y-2.5">
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Checkin</span><span className="text-gray-900 text-xs">{new Date(booking.checkIn).toLocaleDateString("en-IN")} 12:00 PM</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Checkout</span><span className="text-gray-900 text-xs">{new Date(booking.checkOut).toLocaleDateString("en-IN")} 11:00 AM</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Room ID</span><span className="text-gray-900 text-xs font-medium">{booking.roomNumber}</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Adults/Children/Infant</span><span className="text-gray-900 text-xs">{booking.adults}/{booking.children}/{booking.infants || 0}</span></div>
              </div>
            </div>

            {/* Invoice table */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 w-8">
                      <input
                        type="checkbox"
                        className="rounded cursor-pointer"
                        checked={addons.length > 0 && selectedAddonIds.length === addons.length}
                        onChange={toggleSelectAllAddons}
                        title="Select all addons"
                      />
                    </th>
                    <th className="py-2 text-[10px] uppercase text-gray-500">Date</th>
                    <th className="py-2 text-[10px] uppercase text-gray-500">Description</th>
                    <th className="py-2 text-[10px] uppercase text-gray-500 text-right">Sub-total</th>
                    <th className="py-2 text-[10px] uppercase text-gray-500 text-right">Tax</th>
                    <th className="py-2 text-[10px] uppercase text-gray-500 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3"></td>
                    <td className="py-3">{new Date(booking.checkIn).toLocaleDateString("en-IN")}</td>
                    <td className="py-3">Booking Price</td>
                    <td className="py-3 text-right">{roomCharge.toFixed(2)}</td>
                    <td className="py-3 text-right">{(roomCharge * 0.05).toFixed(2)}</td>
                    <td className="py-3 text-right font-semibold">{roomCharge.toFixed(2)}</td>
                  </tr>
                  {addons.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b border-gray-100 transition-colors ${
                        selectedAddonIds.includes(a.id) ? "bg-rose-50" : ""
                      }`}
                    >
                      <td className="py-3">
                        <input
                          type="checkbox"
                          className="rounded cursor-pointer"
                          checked={selectedAddonIds.includes(a.id)}
                          onChange={() => toggleAddonSelection(a.id)}
                        />
                      </td>
                      <td className="py-3">{new Date(a.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="py-3">{a.description}</td>
                      <td className="py-3 text-right">{a.amount.toFixed(2)}</td>
                      <td className="py-3 text-right">{(a.amount * 0.05).toFixed(2)}</td>
                      <td className="py-3 text-right font-semibold">{a.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Delete selected addons bar */}
              {addons.length > 0 && (
                <div className="flex items-center gap-3 mt-3 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={addons.length > 0 && selectedAddonIds.length === addons.length}
                      onChange={toggleSelectAllAddons}
                    />
                    <span className="text-gray-700 font-medium">
                      Select All ({selectedAddonIds.length}/{addons.length})
                    </span>
                  </label>
                  {selectedAddonIds.length > 0 && (
                    <button
                      onClick={deleteSelectedAddons}
                      className="ml-auto px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded hover:bg-rose-700 transition"
                    >
                      🗑 Delete {selectedAddonIds.length} Selected
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="bg-white border-l border-gray-200 flex flex-col">
            <div className="bg-teal-500 text-white text-center py-3">
              <p className="text-sm font-semibold">Folio summary</p>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
              <div>
                <p className="text-center text-xs font-semibold text-teal-700 underline mb-3">Booking Amount Breakdown</p>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600">Room charge</span><span>Rs. {roomCharge.toFixed(2)}</span></div>
                  {addonsTotal > 0 && <div className="flex justify-between"><span className="text-gray-600">Addons</span><span>Rs. {addonsTotal.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>Rs. {totalTax.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-2"><span className="font-medium">Total with taxes</span><span className="font-medium">Rs. {totalWithTax.toFixed(2)}</span></div>
                </div>
              </div>
              <div>
                <p className="text-center text-xs font-semibold text-teal-700 underline mb-3">Payment Breakdown</p>
                <div className="space-y-2">
                  {paidByMode("cash") > 0 && <div className="flex justify-between"><span className="text-gray-600">Cash</span><span>Rs. {paidByMode("cash").toFixed(2)}</span></div>}
                  {paidByMode("upi") > 0 && <div className="flex justify-between"><span className="text-gray-600">UPI</span><span>Rs. {paidByMode("upi").toFixed(2)}</span></div>}
                  {paidByMode("card") > 0 && <div className="flex justify-between"><span className="text-gray-600">Card</span><span>Rs. {paidByMode("card").toFixed(2)}</span></div>}
                  <div className="flex justify-between border-t pt-2"><span className="font-medium">Payment made</span><span className="font-medium">Rs. {totalPaid.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-medium">Balance due</span><span className={`font-medium ${balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>Rs. {balanceDue.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 flex justify-between items-center relative">
              <button onClick={() => setSettleOpen(!settleOpen)} className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-md">Settle dues</button>
              {settleOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSettleOpen(false)} />
                  <div className="absolute bottom-full left-4 mb-2 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl min-w-[240px] py-1">
                    {["Cash payment","Offline card payment","Offline cheque payment","UPI payment","Bank transfer","Other payment modes","Cash deposit"].map((opt) => (
                      <button key={opt} onClick={() => { setSettleOpen(false); setPaymentMode(opt); setAmount(balanceDue > 0 ? balanceDue.toFixed(2) : ""); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">{opt}</button>
                    ))}
                    <div className="border-t mt-1 pt-1">
                      <button onClick={() => { setSettleOpen(false); onOpenPaymentManager(); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">View/Manage payments</button>
                      <button onClick={() => { setSettleOpen(false); showToast("✨ Payment link copied!"); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Send payment link</button>
                    </div>
                  </div>
                </>
              )}
              {booking.status === "CHECKED-IN" && (
                <button onClick={onCheckInOrOut} className="px-5 py-2.5 bg-teal-500 text-white text-xs font-semibold rounded-md">Check-out</button>
              )}
              {booking.status === "CONFIRMED" && (
                <button onClick={onCheckInOrOut} className="px-5 py-2.5 bg-teal-500 text-white text-xs font-semibold rounded-md">Check-in</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {paymentMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">{paymentMode}</h3>
              <button onClick={() => setPaymentMode(null)} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (₹)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2.5 border rounded-md text-lg font-semibold" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reference</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full px-3 py-2.5 border rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note</label>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2.5 border rounded-md" />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setPaymentMode(null)} className="px-5 py-2.5 border rounded-md text-sm">Cancel</button>
              <button onClick={submitPayment} disabled={saving} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold disabled:opacity-50">{saving ? "Saving..." : "Submit"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADDON MODAL */}
      {addonOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Add Hotel Addon</h3>
            <input type="text" value={addonDesc} onChange={(e) => setAddonDesc(e.target.value)} placeholder="Description" className="w-full px-3 py-2.5 border rounded-md mb-3" autoFocus />
            <input type="number" value={addonAmount} onChange={(e) => setAddonAmount(e.target.value)} placeholder="Amount (₹)" className="w-full px-3 py-2.5 border rounded-md mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setAddonOpen(false)} className="px-5 py-2.5 border rounded-md text-sm">Cancel</button>
              <button onClick={submitAddon} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* INFO MODAL */}
      {infoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2">{infoModal.title}</h3>
              <p className="text-sm text-gray-600">{infoModal.message}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setInfoModal(null)} className="px-5 py-2.5 border rounded-md text-sm">Close</button>
              <button onClick={() => { showToast("✅ Confirmed"); setInfoModal(null); }} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-medium z-[110]">
          {toast}
        </div>
      )}
    </div>
  );
}
