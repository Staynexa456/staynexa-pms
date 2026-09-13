"use client";

import React, { useState, useEffect } from "react";
import { rooms, roomCategories } from "./data";
import { fetchRates } from "./db-rates";
import type { Guest } from "./types";
import { emptyGuest } from "./types";

const ALL_SOURCES = ["walkin", "booking engine", "booking", "goibibo", "agoda", "cleartrip", "expedia", "hyperguest", "ixigo"];

export type ReservationFormData = {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  ratePlan: string;
  source: string;
  segment: string;
  subSegment: string;
  adults: number;
  children: number;
  infants: number;
  primaryGuest: Guest;
  amount: number;
  tax: number;
  notes: string;
  collectPayment: boolean;
  paymentMethod: string;
};

export default function CreateReservationModal({
  initialRoom,
  initialCheckIn,
  initialCheckOut,
  onClose,
  onSubmit,
  onBlockRoom,
}: {
  initialRoom?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  onClose: () => void;
  onSubmit: (data: ReservationFormData) => Promise<void>;
  onBlockRoom: (data: { roomNumber: string; checkIn: string; checkOut: string; reason: string }) => Promise<void>;
}) {
  const [roomNumber, setRoomNumber] = useState(initialRoom || rooms[0].number);
  const [checkIn, setCheckIn] = useState(initialCheckIn || "2026-09-13");
  const [checkOut, setCheckOut] = useState(initialCheckOut || "2026-09-14");
  const [ratePlan, setRatePlan] = useState("EP");
  const [source, setSource] = useState("DIRECT");
  const [segment, setSegment] = useState("WALK-IN");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [guest, setGuest] = useState<Guest>({ ...emptyGuest });
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [taxExempt, setTaxExempt] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [editPrices, setEditPrices] = useState(false);
  const [perNightPrice, setPerNightPrice] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [collectPayment, setCollectPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);

  const room = rooms.find((r) => r.number === roomNumber);
  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
  const totalExclTax = perNightPrice * nights;
  const totalWithTax = totalExclTax + taxAmount;

  // Auto-fetch rate when room/dates change
  useEffect(() => {
    (async () => {
      try {
        const rates = await fetchRates(checkIn, checkOut);
        const match = rates.find(
          (r) => r.room_type === room?.type && r.rate_plan === ratePlan && r.rate_date === checkIn
        );
        if (match) {
          setPerNightPrice(match.single_price ?? match.price);
          setTaxAmount(match.single_price ? (match.single_price * 0.05) : 0);
        } else {
          // Default from base rates
          setPerNightPrice(2500);
          setTaxAmount(125);
        }
      } catch {
        setPerNightPrice(2500);
        setTaxAmount(125);
      }
    })();
  }, [roomNumber, checkIn, checkOut, ratePlan, room]);

  const handleGuestChange = (field: keyof Guest, value: string) => {
    setGuest((prev) => ({ ...prev, [field]: value }));
  };

  const lookupPincode = async (pincode: string) => {
    if (pincode.length !== 6) return;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        setGuest((prev) => ({ ...prev, city: po.District || prev.city, state: po.State || prev.state }));
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = async () => {
    if (!guest.name.trim()) return alert("Guest name is required");
    setSaving(true);
    try {
      await onSubmit({
        roomNumber,
        checkIn,
        checkOut,
        ratePlan,
        source,
        segment,
        subSegment: segment,
        adults,
        children,
        infants,
        primaryGuest: guest,
        amount: totalWithTax,
        tax: taxAmount,
        notes: couponCode ? `Coupon: ${couponCode}` : "",
        collectPayment,
        paymentMethod,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[250]" onClick={onClose} />
      <div className="fixed inset-2 md:inset-6 lg:inset-10 bg-white rounded-2xl shadow-2xl z-[260] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-cream-dark flex justify-between items-center bg-cream/30">
          <h2 className="font-serif text-xl font-semibold text-navy">Create reservation</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowBlockDialog(true)}
              className="text-sm text-navy font-medium underline hover:text-rose-500 transition"
            >
              Block room?
            </button>
            <button onClick={onClose} className="text-3xl text-muted hover:text-navy leading-none">×</button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ═══ LEFT COLUMN ═══ */}
          <div className="border border-cream-dark rounded-xl p-5 bg-white">
            {/* Room header */}
            <div className="mb-5">
              <p className="text-sm text-muted uppercase tracking-wide">Room:</p>
              <p className="font-serif text-lg font-semibold text-navy">
                {room?.type} | {roomNumber} | {nights} night{nights > 1 ? "s" : ""}
              </p>
            </div>

            {/* Check-in / Check-out */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-navy block mb-1">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                />
              </div>
            </div>

            {/* Adults / Children / Infants */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div>
                <label className="text-xs font-medium text-navy block mb-1">Adults</label>
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                >
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">Children (7-12 yrs)</label>
                <select
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                >
                  {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">Infants (0-6 yrs)</label>
                <select
                  value={infants}
                  onChange={(e) => setInfants(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                >
                  {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {/* Guest Details */}
            <div className="mb-3">
              <h3 className="font-serif text-base font-semibold text-navy mb-3">Guest Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Full name *"
                  value={guest.name}
                  onChange={(e) => handleGuestChange("name", e.target.value)}
                  className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={guest.email}
                  onChange={(e) => handleGuestChange("email", e.target.value)}
                  className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
                />
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={guest.phone}
                  onChange={(e) => handleGuestChange("phone", e.target.value)}
                  className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={guest.address}
                  onChange={(e) => handleGuestChange("address", e.target.value)}
                  className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={guest.city}
                  onChange={(e) => handleGuestChange("city", e.target.value)}
                  className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
                />
                <input
                  type="text"
                  placeholder="Zip Code"
                  value={guest.pincode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    handleGuestChange("pincode", v);
                    if (v.length === 6) lookupPincode(v);
                  }}
                  className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
                />
              </div>

              {showMoreFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <select
                    value={guest.idType || ""}
                    onChange={(e) => handleGuestChange("idType", e.target.value)}
                    className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                  >
                    <option value="">Select an ID type</option>
                    <option>Aadhaar</option>
                    <option>PAN</option>
                    <option>Passport</option>
                    <option>Driving License</option>
                    <option>Voter ID</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Govt ID Number"
                    value={guest.idNumber || ""}
                    onChange={(e) => handleGuestChange("idNumber", e.target.value)}
                    className="px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
                  />
                </div>
              )}

              <button
                onClick={() => setShowMoreFields(!showMoreFields)}
                className="mt-3 text-xs text-navy font-medium px-3 py-1.5 border border-navy rounded-lg hover:bg-navy hover:text-cream transition"
              >
                {showMoreFields ? "Hide more fields" : "Show more fields"}
              </button>
            </div>
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div className="border border-cream-dark rounded-xl p-5 bg-white">
            <h3 className="font-serif text-base font-semibold text-navy mb-4">Pricing &amp; Preferences</h3>

            {/* Rate Plan / Segment / Sub-segment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Rate plan</label>
                <select
                  value={ratePlan}
                  onChange={(e) => setRatePlan(e.target.value)}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                >
                  <option>EP</option>
                  <option>CP</option>
                  <option>MAP</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Segment</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                >
                  <option>DIRECT</option>
                  <option>OTA</option>
                  <option>CORPORATE</option>
                  <option>TRAVEL AGENT</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Sub-segment</label>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                >
                  <option>WALK-IN</option>
                  <option>CORPORATE</option>
                  <option>FAMILY</option>
                  <option>COUPLE</option>
                </select>
              </div>
            </div>

            {/* Tax exempt toggle */}
            <div className="flex items-center justify-between py-3 border-t border-cream-dark">
              <span className="text-sm font-medium text-navy">Tax exempt</span>
              <button
                onClick={() => setTaxExempt(!taxExempt)}
                className={`w-12 h-6 rounded-full transition relative ${taxExempt ? "bg-emerald-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${taxExempt ? "left-6" : "left-0.5"}`} />
              </button>
            </div>

            {/* Coupons */}
            <div className="border-t border-cream-dark py-3">
              <p className="text-sm font-medium text-navy mb-2">Coupons / Offers / Discount</p>
              <div className="flex gap-2">
                <select className="flex-1 px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white">
                  <option>Coupon code</option>
                </select>
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy"
                />
              </div>
            </div>

            {/* Prices */}
            <div className="border-t border-cream-dark py-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-navy">Prices</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Edit prices</span>
                  <button
                    onClick={() => setEditPrices(!editPrices)}
                    className={`w-10 h-5 rounded-full transition relative ${editPrices ? "bg-emerald-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition ${editPrices ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Per night excluding taxes *</label>
                  <input
                    type="number"
                    value={perNightPrice}
                    onChange={(e) => setPerNightPrice(Number(e.target.value))}
                    readOnly={!editPrices}
                    className={`w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy ${!editPrices ? "bg-cream/40" : "bg-white"}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Total excluding tax *</label>
                  <input
                    type="text"
                    value={totalExclTax}
                    readOnly
                    className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-cream/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Total tax *</label>
                  <input
                    type="number"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value))}
                    readOnly={!editPrices}
                    className={`w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy ${!editPrices ? "bg-cream/40" : "bg-white"}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted font-semibold block mb-1">Total with tax *</label>
                  <input
                    type="text"
                    value={totalWithTax.toFixed(2)}
                    readOnly
                    className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-emerald-50 font-semibold"
                  />
                </div>
              </div>

              <button className="mt-3 text-xs text-navy underline hover:text-gold-dark">
                View day wise split of room prices?
              </button>
            </div>

            {/* Collect payment toggle */}
            <div className="flex items-center justify-between py-3 border-t border-cream-dark">
              <span className="text-sm font-medium text-navy">Collect payment</span>
              <button
                onClick={() => setCollectPayment(!collectPayment)}
                className={`w-12 h-6 rounded-full transition relative ${collectPayment ? "bg-emerald-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${collectPayment ? "left-6" : "left-0.5"}`} />
              </button>
            </div>

            {collectPayment && (
              <div className="mt-3">
                <label className="text-xs font-medium text-navy block mb-1">Payment method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white"
                >
                  <option>Cash</option>
                  <option>Card</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                </select>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full mt-5 py-3 bg-navy text-cream rounded-lg font-semibold hover:bg-navy-light transition disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create reservation"}
            </button>
          </div>
        </div>
      </div>

      {/* Block Room Dialog */}
      {showBlockDialog && (
        <BlockRoomDialog
          roomNumber={roomNumber}
          checkIn={checkIn}
          checkOut={checkOut}
          onClose={() => setShowBlockDialog(false)}
          onConfirm={async (reason) => {
            await onBlockRoom({ roomNumber, checkIn, checkOut, reason });
            setShowBlockDialog(false);
          }}
        />
      )}
    </>
  );
}

// ─── BLOCK ROOM DIALOG ───
function BlockRoomDialog({
  roomNumber,
  checkIn,
  checkOut,
  onClose,
  onConfirm,
}: {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("Maintenance");
  const [saving, setSaving] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-navy/60 z-[270]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[280] w-full max-w-md p-6">
        <h3 className="font-serif text-xl font-semibold text-navy mb-4">Block Room {roomNumber}</h3>
        <p className="text-sm text-muted mb-4">
          From {checkIn} to {checkOut}
        </p>
        <label className="text-xs font-medium text-navy block mb-1">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm text-navy bg-white mb-5"
        >
          <option>Maintenance</option>
          <option>AC Servicing</option>
          <option>Deep Cleaning</option>
          <option>Out of Order</option>
          <option>VIP Hold</option>
          <option>Staff Hold</option>
        </select>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-cream-dark rounded-lg font-medium text-navy hover:bg-cream">
            Cancel
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              await onConfirm(reason);
              setSaving(false);
            }}
            disabled={saving}
            className="px-5 py-2 bg-rose-500 text-white rounded-lg font-semibold hover:bg-rose-600 disabled:opacity-50"
          >
            {saving ? "Blocking…" : "Block Room"}
          </button>
        </div>
      </div>
    </>
  );
}
