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
  const [editPrices, setEditPrices] = useState(true);
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
          const single = (match as unknown as { single_price?: number }).single_price ?? match.price;
          setPerNightPrice(single);
          setTaxAmount(Number((single * 0.05).toFixed(2)));
        } else {
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
        amount: taxExempt ? totalExclTax : totalWithTax,
        tax: taxExempt ? 0 : taxAmount,
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
      <div className="fixed inset-0 bg-navy/60 backdrop-blur-md z-[250]" onClick={onClose} />
      <div className="fixed inset-2 md:inset-6 lg:inset-10 bg-white rounded-3xl shadow-2xl z-[260] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 border-b border-navy/5 flex justify-between items-center bg-gradient-to-r from-cream/40 via-white to-cream/40">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-semibold">
              Staynexa · Front Office
            </p>
            <h2 className="font-serif text-2xl text-navy mt-0.5">Create Reservation</h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowBlockDialog(true)}
              className="text-sm text-navy font-medium underline decoration-dotted underline-offset-4 hover:text-rose-500 transition"
            >
              Block room?
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-navy/5 hover:text-navy transition text-xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT */}
          <div className="space-y-6">
            {/* Room card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-light p-6 text-cream shadow-lg">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-gold/10 -mr-16 -mt-16" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-semibold">Room</p>
              <h3 className="font-serif text-3xl mt-2">{room?.type}</h3>
              <div className="flex items-center gap-3 mt-4 text-cream/80 text-sm">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
                  Room {roomNumber}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
                  {nights} night{nights > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Check-in">
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="input-premium"
                />
              </Field>
              <Field label="Check-out">
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="input-premium"
                />
              </Field>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-3 gap-4">
              <Field label="Adults">
                <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="input-premium">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Children 7-12">
                <select value={children} onChange={(e) => setChildren(Number(e.target.value))} className="input-premium">
                  {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Infants 0-6">
                <select value={infants} onChange={(e) => setInfants(Number(e.target.value))} className="input-premium">
                  {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>

            {/* Guest details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-navy/60 mb-4">
                Guest Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Full name *" value={guest.name} onChange={(e) => handleGuestChange("name", e.target.value)} className="input-premium md:col-span-2" />
                <input type="email" placeholder="Email address" value={guest.email} onChange={(e) => handleGuestChange("email", e.target.value)} className="input-premium" />
                <input type="tel" placeholder="Phone number" value={guest.phone} onChange={(e) => handleGuestChange("phone", e.target.value)} className="input-premium" />
                <input type="text" placeholder="Address" value={guest.address} onChange={(e) => handleGuestChange("address", e.target.value)} className="input-premium" />
                <input type="text" placeholder="City" value={guest.city} onChange={(e) => handleGuestChange("city", e.target.value)} className="input-premium" />
                <input
                  type="text"
                  placeholder="Pincode"
                  value={guest.pincode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    handleGuestChange("pincode", v);
                    if (v.length === 6) lookupPincode(v);
                  }}
                  className="input-premium"
                />
              </div>

              {showMoreFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <select value={guest.idType || ""} onChange={(e) => handleGuestChange("idType", e.target.value)} className="input-premium">
                    <option value="">Select ID type</option>
                    <option>Aadhaar</option>
                    <option>PAN</option>
                    <option>Passport</option>
                    <option>Driving License</option>
                    <option>Voter ID</option>
                  </select>
                  <input type="text" placeholder="Govt ID Number" value={guest.idNumber || ""} onChange={(e) => handleGuestChange("idNumber", e.target.value)} className="input-premium" />
                </div>
              )}

              <button
                onClick={() => setShowMoreFields(!showMoreFields)}
                className="mt-4 text-xs text-navy font-medium px-4 py-2 rounded-full border border-navy/10 hover:bg-navy hover:text-cream transition"
              >
                {showMoreFields ? "↑ Hide additional fields" : "↓ Show more fields"}
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">
            {/* Segment card */}
            <div className="rounded-2xl border border-navy/5 bg-gradient-to-b from-cream/30 to-white p-5">
              <h3 className="font-serif text-lg text-navy mb-4">Pricing &amp; Preferences</h3>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Rate Plan">
                  <select value={ratePlan} onChange={(e) => setRatePlan(e.target.value)} className="input-premium">
                    <option>EP</option>
                    <option>CP</option>
                    <option>MAP</option>
                  </select>
                </Field>
                <Field label="Segment">
                  <select value={source} onChange={(e) => setSource(e.target.value)} className="input-premium">
                    <option>DIRECT</option>
                    <option>OTA</option>
                    <option>CORPORATE</option>
                    <option>TRAVEL AGENT</option>
                  </select>
                </Field>
                <Field label="Sub-segment">
                  <select value={segment} onChange={(e) => setSegment(e.target.value)} className="input-premium">
                    <option>WALK-IN</option>
                    <option>CORPORATE</option>
                    <option>FAMILY</option>
                    <option>COUPLE</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Toggles */}
            <div className="rounded-2xl border border-navy/5 bg-white divide-y divide-navy/5">
              <ToggleRow
                label="Tax exempt"
                value={taxExempt}
                onChange={() => setTaxExempt(!taxExempt)}
              />
              <div className="p-5">
                <p className="text-sm font-medium text-navy mb-3">Coupons / Offers / Discount</p>
                <div className="flex gap-2">
                  <select className="input-premium flex-1">
                    <option>Coupon code</option>
                  </select>
                  <input type="text" placeholder="Enter code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="input-premium flex-1" />
                </div>
              </div>
            </div>

            {/* PRICE CARD — all three editable */}
            <div className="rounded-2xl border-2 border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg text-navy">Pricing</h3>
                <span className="text-[10px] uppercase tracking-wider text-gold-dark font-semibold">
                  All fields editable
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Per night */}
                <Field label="Per night (excl tax)">
                  <input
                    type="number"
                    step="0.01"
                    value={perNightPrice}
                    onChange={(e) => setPerNightPrice(Number(e.target.value) || 0)}
                    className="input-premium"
                  />
                </Field>

                {/* Total excl tax — read-only computed */}
                <Field label="Total excl tax">
                  <input
                    type="text"
                    value={totalExclTax.toFixed(2)}
                    readOnly
                    className="input-premium bg-navy/5 font-semibold"
                  />
                </Field>

                {/* Total tax — editable */}
                <Field label="Total tax">
                  <input
                    type="number"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value) || 0)}
                    className="input-premium"
                  />
                </Field>

                {/* Total with tax — editable, back-calculates tax */}
                <Field label="Total with tax *">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700 font-semibold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={totalWithTax}
                      onChange={(e) => {
                        const newTotal = Number(e.target.value) || 0;
                        const newTax = Math.max(0, newTotal - perNightPrice * nights);
                        setTaxAmount(Number(newTax.toFixed(2)));
                      }}
                      className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-emerald-50 border-2 border-emerald-200 text-emerald-800 font-serif text-xl font-semibold outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </Field>
              </div>

              <p className="text-[11px] text-muted mt-3 leading-relaxed">
                💡 Change <span className="font-semibold">Per night</span>, <span className="font-semibold">Total tax</span>, or{" "}
                <span className="font-semibold">Total with tax</span> — the others update automatically.
              </p>

              <button className="mt-4 text-xs text-navy underline decoration-dotted underline-offset-4 hover:text-gold">
                View day-wise split of room prices?
              </button>
            </div>

            {/* Collect Payment */}
            <div className="rounded-2xl border border-navy/5 bg-white">
              <ToggleRow
                label="Collect payment now"
                value={collectPayment}
                onChange={() => setCollectPayment(!collectPayment)}
              />
              {collectPayment && (
                <div className="px-5 pb-5">
                  <Field label="Payment method">
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-premium">
                      <option>Cash</option>
                      <option>Card</option>
                      <option>UPI</option>
                      <option>Bank Transfer</option>
                    </select>
                  </Field>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-4 bg-gradient-to-b from-gold-light to-gold text-navy rounded-xl font-semibold text-base shadow-lg shadow-gold/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
            >
              {saving ? "Creating…" : "✓ Create Reservation"}
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

      {/* Global premium input styles */}
      <style jsx global>{`
        .input-premium {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(11, 18, 32, 0.1);
          background: white;
          font-size: 14px;
          color: #0F1729;
          outline: none;
          transition: all 160ms ease;
        }
        .input-premium:hover {
          border-color: rgba(11, 18, 32, 0.2);
        }
        .input-premium:focus {
          border-color: #C9A34E;
          box-shadow: 0 0 0 3px rgba(201, 163, 78, 0.15);
        }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.15em] text-navy/50 font-semibold block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-sm font-medium text-navy">{label}</span>
      <button
        onClick={onChange}
        className={`w-11 h-6 rounded-full transition relative ${value ? "bg-emerald-500" : "bg-navy/15"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition shadow-sm ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

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
      <div className="fixed inset-0 bg-navy/70 backdrop-blur-sm z-[270]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl z-[280] w-full max-w-md p-7">
        <h3 className="font-serif text-2xl text-navy mb-1">Block Room {roomNumber}</h3>
        <p className="text-sm text-muted mb-6">
          From {checkIn} to {checkOut}
        </p>
        <label className="text-[10px] uppercase tracking-[0.15em] text-navy/50 font-semibold block mb-2">
          Reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-4 py-3 border border-navy/10 rounded-lg text-sm text-navy bg-white mb-6"
        >
          <option>Maintenance</option>
          <option>AC Servicing</option>
          <option>Deep Cleaning</option>
          <option>Out of Order</option>
          <option>VIP Hold</option>
          <option>Staff Hold</option>
        </select>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-navy/10 rounded-lg font-medium text-navy hover:bg-cream">
            Cancel
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              await onConfirm(reason);
              setSaving(false);
            }}
            disabled={saving}
            className="px-5 py-2 bg-gradient-to-b from-rose-500 to-rose-600 text-white rounded-lg font-semibold shadow-lg shadow-rose-500/30 hover:-translate-y-0.5 disabled:opacity-50"
          >
            {saving ? "Blocking…" : "🔒 Block Room"}
          </button>
        </div>
      </div>
    </>
  );
}
