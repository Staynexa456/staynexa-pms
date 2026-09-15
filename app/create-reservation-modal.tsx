"use client";

import { useState, useEffect } from "react";
import type { Guest } from "./types";

export type ReservationFormData = {
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  ratePlan: string;
  source: string;
  primaryGuest: Guest;
  adults: number;
  children: number;
  infants: number;
  amount: number;
  tax: number;
  notes: string;
};

type Props = {
  initialRoom?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  onClose: () => void;
  onSubmit: (data: ReservationFormData) => Promise<void>;
  onBlockRoom?: (data: {
    roomNumber: string;
    checkIn: string;
    checkOut: string;
    reason: string;
  }) => Promise<void>;
};

const ID_TYPES = [
  "Aadhaar",
  "PAN",
  "Passport",
  "Driving License",
  "Voter ID",
] as const;

const SEGMENTS = ["DIRECT", "Corporate", "Travel Agent", "Walk-in", "OTA"];
const SUB_SEGMENTS = ["WALK-IN", "Booking.com", "MakeMyTrip", "Agoda", "Expedia", "Goibibo"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

export default function CreateReservationModal({
  initialRoom,
  initialCheckIn,
  initialCheckOut,
  onClose,
  onSubmit,
  onBlockRoom,
}: Props) {
  // Form state
  const [roomNumber, setRoomNumber] = useState(initialRoom || "");
  const [checkIn, setCheckIn] = useState(initialCheckIn || todayISO());
  const [checkOut, setCheckOut] = useState(initialCheckOut || tomorrowISO());
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestCity, setGuestCity] = useState("");
  const [guestZip, setGuestZip] = useState("");
  const [guestIdType, setGuestIdType] = useState<string>("");
  const [guestIdNumber, setGuestIdNumber] = useState("");

  const [showMoreFields, setShowMoreFields] = useState(false);
  const [guestState, setGuestState] = useState("");
  const [guestCountry, setGuestCountry] = useState("India");
  const [guestNationality, setGuestNationality] = useState("Indian");
  const [guestGender, setGuestGender] = useState("Male");
  const [guestDob, setGuestDob] = useState("");

  const [ratePlan, setRatePlan] = useState("EP");
  const [segment, setSegment] = useState("DIRECT");
  const [subSegment, setSubSegment] = useState("WALK-IN");
  const [taxExempt, setTaxExempt] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponValue, setCouponValue] = useState("");

  const [perNight, setPerNight] = useState(2500);
  const [totalExcl, setTotalExcl] = useState(2500);
  const [taxAmount, setTaxAmount] = useState(125);
  const [totalWithTax, setTotalWithTax] = useState(2625);
  const [editPrices, setEditPrices] = useState(false);

  const [collectPayment, setCollectPayment] = useState(false);
  const [doCheckin, setDoCheckin] = useState(false);

  const [blockMode, setBlockMode] = useState(false);
  const [blockReason, setBlockReason] = useState("Maintenance");
  const [saving, setSaving] = useState(false);

  // Auto-calc nights
  const nights = Math.max(
    1,
    Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
    )
  );

  // Auto-update total when nights or per night changes
  useEffect(() => {
    if (!editPrices) {
      const excl = perNight * nights;
      const tax = taxExempt ? 0 : Math.round(excl * 0.05 * 100) / 100;
      setTotalExcl(excl);
      setTaxAmount(tax);
      setTotalWithTax(excl + tax);
    }
  }, [perNight, nights, taxExempt, editPrices]);

  // Auto-fill city/state from pincode
  const handleZipChange = async (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 6);
    setGuestZip(clean);
    if (clean.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`);
        const data = await res.json();
        if (data[0]?.Status === "Success" && data[0].PostOffice?.[0]) {
          const po = data[0].PostOffice[0];
          setGuestCity(po.District || "");
          setGuestState(po.State || "");
        }
      } catch {}
    }
  };

  const handleSubmit = async () => {
    if (blockMode) {
      if (!onBlockRoom) return;
      setSaving(true);
      try {
        await onBlockRoom({
          roomNumber,
          checkIn,
          checkOut,
          reason: blockReason,
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!guestName.trim()) {
      alert("Guest name is required");
      return;
    }
    if (!roomNumber.trim()) {
      alert("Room number is required");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        roomNumber,
        checkIn,
        checkOut,
        ratePlan,
        source: subSegment.toLowerCase().replace(/\s+/g, ""),
        primaryGuest: {
          name: guestName.trim(),
          email: guestEmail.trim(),
          phone: guestPhone.trim(),
          address: guestAddress.trim(),
          city: guestCity.trim(),
          state: guestState.trim(),
          pincode: guestZip.trim(),
          idType: guestIdType as any,
          idNumber: guestIdNumber.trim(),
        },
        adults,
        children,
        infants,
        amount: totalWithTax,
        tax: taxAmount,
        notes: "",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl my-4 overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            {blockMode ? "Block Room" : "Create reservation"}
          </h2>
          <div className="flex items-center gap-4">
            {!blockMode && onBlockRoom && (
              <button
                onClick={() => setBlockMode(true)}
                className="text-sm font-medium text-gray-700 underline hover:text-rose-600"
              >
                Block room?
              </button>
            )}
            {blockMode && (
              <button
                onClick={() => setBlockMode(false)}
                className="text-sm font-medium text-gray-700 underline hover:text-teal-600"
              >
                ← Back to reservation
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* BODY — two column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">

          {/* ═══════════════════════════════════════════════════ */}
          {/* LEFT COLUMN                                        */}
          {/* ═══════════════════════════════════════════════════ */}
          <div className="space-y-6">

            {/* Room info card */}
            <div>
              <p className="text-sm text-gray-500 mb-1">Room</p>
              <p className="text-lg font-semibold text-gray-900">
                {initialRoom ? `${roomNumber} — ${nights} night${nights === 1 ? "" : "s"}` : `${roomNumber} | ${nights} night${nights === 1 ? "" : "s"}`}
              </p>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="Room number"
                className="mt-2 w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
              />
            </div>

            {blockMode ? (
              /* BLOCK MODE fields */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Check-in</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Check-out</label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Block Reason</label>
                  <select
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                  >
                    <option value="Maintenance">Maintenance</option>
                    <option value="Out of order">Out of order</option>
                    <option value="Renovation">Renovation</option>
                    <option value="Hold for owner">Hold for owner</option>
                    <option value="Deep cleaning">Deep cleaning</option>
                  </select>
                </div>
              </>
            ) : (
              /* RESERVATION MODE fields */
              <>
                {/* Check-in / Check-out */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Check-in</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Check-out</label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {/* Adults / Children / Infants */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Adults</label>
                    <select
                      value={adults}
                      onChange={(e) => setAdults(Number(e.target.value))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    >
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Children (7–12 years)</label>
                    <select
                      value={children}
                      onChange={(e) => setChildren(Number(e.target.value))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    >
                      {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Infants (0–6 years)</label>
                    <select
                      value={infants}
                      onChange={(e) => setInfants(Number(e.target.value))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    >
                      {[0, 1, 2].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                {/* Guest Details */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Guest Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Full name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="Address"
                      value={guestAddress}
                      onChange={(e) => setGuestAddress(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={guestCity}
                      onChange={(e) => setGuestCity(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="Zip Code"
                      value={guestZip}
                      onChange={(e) => handleZipChange(e.target.value)}
                      maxLength={6}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                    <select
                      value={guestIdType}
                      onChange={(e) => setGuestIdType(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500 text-gray-500"
                    >
                      <option value="">Select an ID type</option>
                      {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder="Govt ID Number"
                      value={guestIdNumber}
                      onChange={(e) => setGuestIdNumber(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* More fields toggle */}
                  <button
                    onClick={() => setShowMoreFields(!showMoreFields)}
                    className="mt-4 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    {showMoreFields ? "Show less" : "Show more fields"}
                  </button>

                  {showMoreFields && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <input
                        type="text"
                        placeholder="State"
                        value={guestState}
                        onChange={(e) => setGuestState(e.target.value)}
                        className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                      />
                      <input
                        type="text"
                        placeholder="Country"
                        value={guestCountry}
                        onChange={(e) => setGuestCountry(e.target.value)}
                        className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                      />
                      <input
                        type="text"
                        placeholder="Nationality"
                        value={guestNationality}
                        onChange={(e) => setGuestNationality(e.target.value)}
                        className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                      />
                      <select
                        value={guestGender}
                        onChange={(e) => setGuestGender(e.target.value)}
                        className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                      <input
                        type="date"
                        value={guestDob}
                        onChange={(e) => setGuestDob(e.target.value)}
                        placeholder="Date of Birth"
                        className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════ */}
          {/* RIGHT COLUMN — Pricing & Preferences               */}
          {/* ═══════════════════════════════════════════════════ */}
          {!blockMode && (
            <div className="space-y-6">

              {/* Pricing & Preferences */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Pricing & Preferences</h3>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Rate plan</label>
                    <select
                      value={ratePlan}
                      onChange={(e) => setRatePlan(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    >
                      <option value="EP">EP</option>
                      <option value="CP">CP</option>
                      <option value="MAP">MAP</option>
                      <option value="AP">AP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Segment</label>
                    <select
                      value={segment}
                      onChange={(e) => setSegment(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    >
                      {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Sub-segment</label>
                    <select
                      value={subSegment}
                      onChange={(e) => setSubSegment(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    >
                      {SUB_SEGMENTS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Tax exempt */}
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-gray-700">Tax exempt</label>
                  <button
                    type="button"
                    onClick={() => setTaxExempt(!taxExempt)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      taxExempt ? "bg-teal-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        taxExempt ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Coupons */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Coupons / Offers / Discount
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500 text-gray-500"
                    >
                      <option value="">Coupon code</option>
                      <option value="WELCOME10">WELCOME10</option>
                      <option value="FLAT500">FLAT500</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={couponValue}
                      onChange={(e) => setCouponValue(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Prices */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-semibold text-gray-900">Prices</h3>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-600">Edit prices</label>
                    <button
                      type="button"
                      onClick={() => setEditPrices(!editPrices)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        editPrices ? "bg-teal-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          editPrices ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Per night excluding taxes *
                    </label>
                    <input
                      type="number"
                      value={perNight}
                      onChange={(e) => setPerNight(Number(e.target.value))}
                      disabled={!editPrices}
                      className={`w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500 ${
                        !editPrices ? "bg-gray-50 text-gray-500" : ""
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Total excluding tax *
                    </label>
                    <input
                      type="number"
                      value={totalExcl}
                      onChange={(e) => setTotalExcl(Number(e.target.value))}
                      disabled={!editPrices}
                      className={`w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500 ${
                        !editPrices ? "bg-gray-50 text-gray-500" : ""
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Total tax *
                    </label>
                    <input
                      type="number"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(Number(e.target.value))}
                      disabled={!editPrices}
                      className={`w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-teal-500 ${
                        !editPrices ? "bg-gray-50 text-gray-500" : ""
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Total with tax *
                    </label>
                    <input
                      type="number"
                      value={totalWithTax}
                      onChange={(e) => setTotalWithTax(Number(e.target.value))}
                      disabled={!editPrices}
                      className={`w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm font-medium outline-none focus:border-teal-500 ${
                        !editPrices ? "bg-gray-50 text-gray-700" : ""
                      }`}
                    />
                  </div>
                </div>

                <button className="mt-3 text-sm text-gray-700 underline hover:text-teal-600">
                  View day-wise split of room prices?
                </button>
              </div>

              {/* Collect payment */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Collect payment</label>
                <button
                  type="button"
                  onClick={() => setCollectPayment(!collectPayment)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    collectPayment ? "bg-teal-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      collectPayment ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Check-in checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={doCheckin}
                  onChange={(e) => setDoCheckin(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Checkin</span>
              </label>

            </div>
          )}
        </div>

        {/* FOOTER — Create reservation button */}
        <div className="px-6 py-4 bg-white border-t border-gray-200">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`w-full py-3 rounded-md text-sm font-semibold text-white transition ${
              blockMode
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-slate-800 hover:bg-slate-900"
            } disabled:opacity-50`}
          >
            {saving
              ? "Processing..."
              : blockMode
              ? "Block room"
              : "Create reservation"}
          </button>
        </div>
      </div>
    </div>
  );
}
