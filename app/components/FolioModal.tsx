"use client";

import { useState, useEffect, useCallback } from "react";
import type { Booking } from "../types";
import {
  fetchPaymentsForBooking,
  fetchAddonsForBooking,
  recordPayment,
  addBookingAddon,
  type PaymentRecord,
} from "../db";

type SettleOption =
  | "Cash payment"
  | "Offline card payment"
  | "Offline cheque payment"
  | "UPI payment"
  | "Bank transfer"
  | "Other payment modes"
  | "Cash deposit"
  | "Send payment link";

type MenuAction =
  | "Print Registration card"
  | "Print C form"
  | "Email folio details"
  | "Folio log"
  | "Edit rate plan"
  | "Apply Coupon code / Discount / Offer"
  | "Add hotel addons"
  | "Tax exempt status"
  | "Add Company Details"
  | "Lock booking"
  | "Unlock booking"
  | "Unassign room"
  | "Assign Room"
  | "Modify checkout"
  | "Move Room"
  | "Scanty Baggage"
  | "Add new room to group booking"
  | "Download Booking Voucher";

type AddonRecord = {
  id: string;
  description: string;
  amount: number;
  created_at: string;
};

interface FolioModalProps {
  booking: Booking;
  onClose: () => void;
  onSettleDues?: () => void;
  onCheckInOrOut?: () => void;
  onPaymentMade?: () => void;
  onBookingUpdate?: () => void;
  onOpenPaymentManager?: () => void;
  refreshKey?: number;
}

export default function FolioModal(props: FolioModalProps) {
  const {
    booking,
    onClose,
    onSettleDues,
    onCheckInOrOut,
    onPaymentMade,
    onBookingUpdate,
    onOpenPaymentManager,
    refreshKey,
  } = props;

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [addons, setAddons] = useState<AddonRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [threeDotOpen, setThreeDotOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SettleOption | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);

  const [editRatePlanOpen, setEditRatePlanOpen] = useState(false);
  const [newRatePlan, setNewRatePlan] = useState(booking.ratePlan || "EP");
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [addonOpen, setAddonOpen] = useState(false);
  const [addonDesc, setAddonDesc] = useState("");
  const [addonAmount, setAddonAmount] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyGst, setCompanyGst] = useState("");
  const [taxExemptOpen, setTaxExemptOpen] = useState(false);
  const [taxExempt, setTaxExempt] = useState(false);
  const [scantyOpen, setScantyOpen] = useState(false);
  const [scantyDesc, setScantyDesc] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [paymentsData, addonsData] = await Promise.all([
        fetchPaymentsForBooking(booking.id),
        fetchAddonsForBooking(booking.id).catch(() => []),
      ]);
      setPayments(paymentsData);
      setAddons(addonsData);
    } catch (err) {
      console.error("Failed to load folio data:", err);
    } finally {
      setLoading(false);
    }
  }, [booking.id]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  const nights = Math.max(
    1,
    Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000)
  );

  const roomCharge = booking.amount || 0;
  const addonsTotal = addons.reduce((s, a) => s + (a.amount || 0), 0);
  const totalWithTax = roomCharge + addonsTotal;
  const totalTax = taxExempt ? 0 : Math.round((totalWithTax / 1.05) * 0.05 * 100) / 100;
  const totalExclTax = totalWithTax - totalTax;
  const gst = Math.round((totalTax / 2) * 100) / 100;
  const cgst = Math.round(((totalTax - gst) / 2) * 100) / 100;
  const sgst = Math.round((totalTax - gst - cgst) * 100) / 100;

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = Math.max(0, totalWithTax - totalPaid);

  const paidByMode = (mode: string) =>
    payments
      .filter((p) => p.method.toLowerCase().includes(mode.toLowerCase()))
      .reduce((s, p) => s + (p.amount || 0), 0);

  const handleMenuAction = (action: MenuAction) => {
    setThreeDotOpen(false);
    switch (action) {
      case "Print Registration card":
        setInfoModal({ title: "Print Registration Card?", message: `Print card for "${booking.primaryGuest.name}"?` });
        break;
      case "Print C form":
        setInfoModal({ title: "Print C Form?", message: `Print C Form for "${booking.primaryGuest.name}"?` });
        break;
      case "Email folio details":
        setInfoModal({ title: "Email Folio Details?", message: `Email folio to "${booking.primaryGuest.email || "guest"}"?` });
        break;
      case "Folio log":
        setInfoModal({ title: "Folio Log", message: "Showing all changes and actions for this booking." });
        break;
      case "Edit rate plan":
        setNewRatePlan(booking.ratePlan || "EP");
        setEditRatePlanOpen(true);
        break;
      case "Apply Coupon code / Discount / Offer":
        setCouponCode("");
        setCouponOpen(true);
        break;
      case "Add hotel addons":
        setAddonDesc("");
        setAddonAmount("");
        setAddonOpen(true);
        break;
      case "Tax exempt status":
        setTaxExemptOpen(true);
        break;
      case "Add Company Details":
        setCompanyOpen(true);
        break;
      case "Lock booking":
        setInfoModal({ title: "Lock booking?", message: "Lock this booking?" });
        break;
      case "Unlock booking":
        setInfoModal({ title: "Unlock booking?", message: "Unlock this booking?" });
        break;
      case "Unassign room":
        setInfoModal({ title: "Unassign room?", message: `Unassign Room ${booking.roomNumber}?` });
        break;
      case "Assign Room":
        setInfoModal({ title: "Assign Room", message: "Open room picker to assign a room." });
        break;
      case "Modify checkout":
        setInfoModal({ title: "Modify Check-Out", message: `Change check-out date from "${booking.checkOut}"?` });
        break;
      case "Move Room":
        setInfoModal({ title: "Move Room", message: "Open Move Room modal." });
        break;
      case "Scanty Baggage":
        setScantyDesc("");
        setScantyOpen(true);
        break;
      case "Add new room to group booking":
        setInfoModal({ title: "Add Room to Group", message: "Add another room to this group booking?" });
        break;
      case "Download Booking Voucher":
        setInfoModal({ title: "Download Booking Voucher?", message: "Download the booking voucher PDF?" });
        break;
    }
  };

  const handleSettleOption = (option: SettleOption | "View/Manage payments") => {
    setSettleOpen(false);
    if (option === "View/Manage payments") {
      if (onOpenPaymentManager) {
        onOpenPaymentManager();
      } else {
        setInfoModal({ title: "View/Manage Payments", message: "Opening payment manager..." });
      }
      return;
    }
    if (option === "Send payment link") {
      showToast("✨ Payment link copied to clipboard!");
      return;
    }
    setPaymentMethod(option);
    setAmount(balanceDue > 0 ? balanceDue.toFixed(2) : "");
    setReference("");
    setNote("");
  };

  const submitPayment = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const cleanMethod = paymentMethod
        ? paymentMethod.replace(" payment", "").replace("Offline ", "").trim()
        : "Cash";

      await recordPayment({
        bookingId: booking.id,
        amount: amt,
        method: cleanMethod,
        reference,
        note,
      });

      showToast(`💰 ₹${amt.toFixed(2)} recorded via ${cleanMethod}`);
      setPaymentMethod(null);
      setAmount("");
      setReference("");
      setNote("");

      await loadData();
      onPaymentMade?.();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const submitAddon = async () => {
    const amt = parseFloat(addonAmount);
    if (!addonDesc || !amt || amt <= 0) {
      alert("Please enter description and amount");
      return;
    }

    try {
      await addBookingAddon({
        bookingId: booking.id,
        description: addonDesc,
        amount: amt,
      });

      showToast(`✅ Addon "${addonDesc}" added (₹${amt})`);
      setAddonOpen(false);
      setAddonDesc("");
      setAddonAmount("");

      await loadData();
      onPaymentMade?.();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[80] flex flex-col overflow-hidden">
      {/* HEADER */}
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
                        <button key={a} onClick={() => handleMenuAction(a as MenuAction)} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">{a}</button>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {["Lock booking","Unlock booking","Unassign room","Assign Room","Modify checkout","Move Room","Scanty Baggage","Add new room to group booking","Download Booking Voucher"].map((a) => (
                        <button key={a} onClick={() => handleMenuAction(a as MenuAction)} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">{a}</button>
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
              <button className="px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50">Guest list</button>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-xs">+</button>
              <select className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium"><option>{booking.source?.toUpperCase() || "DIRECT"}</option></select>
              <select className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium"><option>WALK-IN</option></select>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${booking.status === "CHECKED-IN" ? "bg-teal-100 text-teal-700" : booking.status === "CONFIRMED" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>
                {booking.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 text-sm">
              <div className="space-y-2.5">
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Address</span><span className="text-gray-900 text-xs flex-1">{booking.primaryGuest.address || "—"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Email</span><span className="text-gray-900 text-xs flex-1">{booking.primaryGuest.email || "—"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Phone</span><span className="text-gray-900 text-xs flex-1">{booking.primaryGuest.phone || "—"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">GST Number</span><span className="text-gray-900 text-xs flex-1 underline cursor-pointer">Edit GST number</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Booking reference id</span><span className="text-gray-900 text-xs flex-1 underline cursor-pointer">Edit booking reference id</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Room type</span><span className="text-gray-900 text-xs flex-1 font-medium">{booking.roomType || "—"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Rate plans</span><span className="text-gray-900 text-xs flex-1">{booking.ratePlan || "EP"}</span></div>
                <div className="flex gap-4"><span className="w-32 text-gray-500 text-xs">Access code</span><span className="text-gray-900 text-xs flex-1">{booking.roomNumber} - NA,</span></div>
              </div>
              <div className="space-y-2.5">
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Booking made on</span><span className="text-gray-900 text-xs">{booking.bookingMadeOn ? new Date(booking.bookingMadeOn).toLocaleString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Checkin</span><span className="text-gray-900 text-xs">{new Date(booking.checkIn).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} 12:00 PM</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Checkout</span><span className="text-gray-900 text-xs">{new Date(booking.checkOut).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} 11:00 AM</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Room ID</span><span className="text-gray-900 text-xs font-medium">{booking.roomNumber}</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Nights</span><span className="text-gray-900 text-xs">{nights}</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Adults/Children/Infant</span><span className="text-gray-900 text-xs">{booking.adults}/{booking.children}/{booking.infants || 0}</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Customer Notes</span><span className="text-teal-600 text-xs underline cursor-pointer">Add / View customer notes (0)</span></div>
                <div className="flex gap-4"><span className="w-40 text-gray-500 text-xs">Booking Notes</span><span className="text-teal-600 text-xs underline cursor-pointer">Add / View booking notes ({booking.notes ? 1 : 0})</span></div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 w-8"><input type="checkbox" className="rounded" /></th>
                    <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Date</th>
                    <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Description</th>
                    <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Type</th>
                    <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider text-right">Sub-total (Rs.)</th>
                    <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider text-right">Cumulative tax %</th>
                    <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider text-right">Tax (Rs.)</th>
                    <th className="py-2 text-[10px] uppercase font-semibold text-gray-500 tracking-wider text-right">Total (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3"><input type="checkbox" className="rounded" /></td>
                    <td className="py-3 text-gray-700">{new Date(booking.checkIn).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="py-3 text-gray-700">Booking Price</td>
                    <td className="py-3 text-gray-700">DEBIT</td>
                    <td className="py-3 text-right text-gray-900 font-medium">{roomCharge.toFixed(2)}</td>
                    <td className="py-3 text-right text-gray-700">{taxExempt ? "0.00" : "5.00"}</td>
                    <td className="py-3 text-right text-gray-900">{(Math.round(roomCharge / 1.05 * 0.05 * 100) / 100).toFixed(2)}</td>
                    <td className="py-3 text-right text-gray-900 font-semibold">{roomCharge.toFixed(2)}</td>
                  </tr>
                  {addons.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100">
                      <td className="py-3"><input type="checkbox" className="rounded" /></td>
                      <td className="py-3 text-gray-700">{new Date(a.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="py-3 text-gray-700">{a.description}</td>
                      <td className="py-3 text-gray-700">DEBIT</td>
                      <td className="py-3 text-right text-gray-900 font-medium">{a.amount.toFixed(2)}</td>
                      <td className="py-3 text-right text-gray-700">5.00</td>
                      <td className="py-3 text-right text-gray-900">{(a.amount * 0.05).toFixed(2)}</td>
                      <td className="py-3 text-right text-gray-900 font-semibold">{a.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <select className="border border-gray-300 rounded px-2 py-1 text-xs"><option>10</option><option>25</option><option>50</option></select>
                <span className="flex-1" />
                <div className="w-6 h-6 rounded bg-teal-500 text-white flex items-center justify-center font-semibold text-xs">1</div>
              </div>
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
                  <div className="flex justify-between"><span className="text-gray-600">Room charge</span><span className="text-gray-900">Rs. {roomCharge.toFixed(2)}</span></div>
                  {addonsTotal > 0 && (
                    <div className="flex justify-between"><span className="text-gray-600">Addons</span><span className="text-gray-900">Rs. {addonsTotal.toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-gray-600">Total without taxes</span><span className="text-gray-900">Rs. {totalExclTax.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Total tax amount</span><span className="text-gray-900">Rs. {totalTax.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-700 font-medium">Total with taxes and fees</span><span className="text-gray-900 font-medium">Rs. {totalWithTax.toFixed(2)}</span></div>
                </div>
              </div>

              <div>
                <p className="text-center text-xs font-semibold text-teal-700 underline mb-3">Room Taxes Breakdown</p>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600">GST</span><span className="text-gray-900">Rs. {gst.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">CGST</span><span className="text-gray-900">Rs. {cgst.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">SGST</span><span className="text-gray-900">Rs. {sgst.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-600">Service taxes</span><span className="text-gray-900">Rs. 0.00</span></div>
                </div>
              </div>

              <div>
                <p className="text-center text-xs font-semibold text-teal-700 underline mb-3">Payment Breakdown</p>
                <div className="space-y-2">
                  {payments.length === 0 && <p className="text-xs text-gray-400 italic text-center">No payments recorded</p>}
                  {paidByMode("cash") > 0 && <div className="flex justify-between"><span className="text-gray-600">Cash payment</span><span className="text-gray-900">Rs. {paidByMode("cash").toFixed(2)}</span></div>}
                  {paidByMode("upi") > 0 && <div className="flex justify-between"><span className="text-gray-600">UPI payment</span><span className="text-gray-900">Rs. {paidByMode("upi").toFixed(2)}</span></div>}
                  {paidByMode("card") > 0 && <div className="flex justify-between"><span className="text-gray-600">Card payment</span><span className="text-gray-900">Rs. {paidByMode("card").toFixed(2)}</span></div>}
                  {paidByMode("ota") > 0 && <div className="flex justify-between"><span className="text-gray-600">OTA prepaid</span><span className="text-gray-900">Rs. {paidByMode("ota").toFixed(2)}</span></div>}
                  <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-700 font-medium">Payment made</span><span className="text-gray-900 font-medium">Rs. {totalPaid.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-700 font-medium">Balance due 🔄</span><span className={`font-medium ${balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>Rs. {balanceDue.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 flex justify-between items-center relative">
              <button onClick={() => setSettleOpen(!settleOpen)} className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800">Settle dues</button>
              {settleOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSettleOpen(false)} />
                  <div className="absolute bottom-full left-4 mb-2 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl min-w-[240px] py-1">
                    {["Cash payment","Offline card payment","Offline cheque payment","UPI payment","Bank transfer","Other payment modes","Cash deposit"].map((opt) => (
                      <button key={opt} onClick={() => handleSettleOption(opt as SettleOption)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">{opt}</button>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button onClick={() => handleSettleOption("View/Manage payments")} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">View/Manage payments</button>
                      <button onClick={() => handleSettleOption("Send payment link" as any)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Send payment link</button>
                    </div>
                  </div>
                </>
              )}
              {booking.status === "CHECKED-IN" && (
                <button onClick={onCheckInOrOut} className="px-5 py-2.5 bg-teal-500 text-white text-xs font-semibold rounded-md hover:bg-teal-600">Check-out</button>
              )}
              {booking.status === "CONFIRMED" && (
                <button onClick={onCheckInOrOut} className="px-5 py-2.5 bg-teal-500 text-white text-xs font-semibold rounded-md hover:bg-teal-600">Check-in</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {paymentMethod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{paymentMethod}</h3>
              <button onClick={() => setPaymentMethod(null)} className="text-gray-400 hover:text-gray-700 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Amount (₹)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 text-lg font-semibold" placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Reference</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Note</label>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500" />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setPaymentMethod(null)} className="px-5 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700">Cancel</button>
              <button onClick={submitPayment} disabled={saving} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold hover:bg-slate-900 disabled:opacity-50">{saving ? "Saving..." : "Submit"}</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT RATE PLAN */}
      {editRatePlanOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Rate Plan</h3>
            <select value={newRatePlan} onChange={(e) => setNewRatePlan(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 mb-4">
              <option value="EP">EP</option><option value="CP">CP</option><option value="MAP">MAP</option><option value="AP">AP</option>
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditRatePlanOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-md text-sm text-gray-700">Cancel</button>
              <button onClick={() => { showToast(`✅ Rate plan changed to ${newRatePlan}`); setEditRatePlanOpen(false); onBookingUpdate?.(); }} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* COUPON */}
      {couponOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Apply Coupon / Discount</h3>
            <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Enter coupon code" className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 mb-4" autoFocus />
            <div className="flex justify-end gap-3">
              <button onClick={() => setCouponOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-md text-sm text-gray-700">Cancel</button>
              <button onClick={() => { if (!couponCode) return alert("Enter a code"); showToast(`✅ Coupon "${couponCode}" applied`); setCouponOpen(false); }} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* ADDON */}
      {addonOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Hotel Addon</h3>
            <input type="text" value={addonDesc} onChange={(e) => setAddonDesc(e.target.value)} placeholder="Description (e.g., Water, Airport pickup)" className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 mb-3" autoFocus />
            <input type="number" value={addonAmount} onChange={(e) => setAddonAmount(e.target.value)} placeholder="Amount (₹)" className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setAddonOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-md text-sm text-gray-700">Cancel</button>
              <button onClick={submitAddon} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* TAX EXEMPT */}
      {taxExemptOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tax Exempt Status</h3>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} className="w-5 h-5 rounded" />
              <span className="text-sm text-gray-700">Mark this booking as tax exempt</span>
            </label>
            <div className="flex justify-end gap-3">
              <button onClick={() => setTaxExemptOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-md text-sm text-gray-700">Cancel</button>
              <button onClick={() => { showToast(`✅ Tax exempt ${taxExempt ? "enabled" : "disabled"}`); setTaxExemptOpen(false); }} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* COMPANY */}
      {companyOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Company Details</h3>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 mb-3" />
            <input type="text" value={companyGst} onChange={(e) => setCompanyGst(e.target.value)} placeholder="GST number" className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setCompanyOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-md text-sm text-gray-700">Cancel</button>
              <button onClick={() => { if (!companyName) return alert("Enter company name"); showToast(`✅ Company "${companyName}" added`); setCompanyOpen(false); }} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* SCANTY BAGGAGE */}
      {scantyOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Scanty Baggage</h3>
            <textarea value={scantyDesc} onChange={(e) => setScantyDesc(e.target.value)} placeholder="Describe the baggage left behind..." rows={4} className="w-full px-3 py-2.5 border border-gray-300 rounded-md outline-none focus:border-teal-500 mb-4 resize-none" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setScantyOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-md text-sm text-gray-700">Cancel</button>
              <button onClick={() => { showToast("✅ Scanty baggage recorded"); setScantyOpen(false); }} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* INFO */}
      {infoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{infoModal.title}</h3>
              <p className="text-sm text-gray-600">{infoModal.message}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setInfoModal(null)} className="px-5 py-2.5 border border-gray-300 rounded-md text-sm text-gray-700">Close</button>
              <button onClick={() => { showToast("✅ Action confirmed"); setInfoModal(null); }} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-medium z-[110]">
          {toast}
        </div>
      )}
    </div>
  );
}
