"use client";

import { useState, useEffect, useCallback } from "react";
import type { Booking } from "../types";
import {
  fetchPaymentsForBooking,
  fetchAddonsForBooking,
  recordPayment,
  addBookingAddon,
  deleteAddon,
  modifyReservation,
  type PaymentRecord,
} from "../db";

type AddonRecord = {
  id: string;
  description: string;
  amount: number;
  created_at: string;
};

type CompanyDetails = {
  taxId: string;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
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

  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  const [companyOpen, setCompanyOpen] = useState(false);
  const [company, setCompany] = useState<CompanyDetails>({
    taxId: "",
    companyName: "",
    companyPhone: "",
    companyEmail: "",
    companyAddress: "",
  });

  const [regCardOpen, setRegCardOpen] = useState(false);
  const [fillManually, setFillManually] = useState(false);

  // ═══ EDIT RATE STATE ═══
  const [editRateMode, setEditRateMode] = useState(false);
  const [newRoomCharge, setNewRoomCharge] = useState<number>(0);

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
      setSelectedAddonIds([]);
      setNewRoomCharge(booking.amount || 0);
    } catch (err) {
      console.error("Failed to load folio:", err);
    } finally {
      setLoading(false);
    }
  }, [booking.id, booking.amount]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`company_${booking.id}`);
      if (saved) {
        try {
          setCompany(JSON.parse(saved));
        } catch {}
      }
    }
  }, [booking.id]);

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

  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.checkOut).getTime() -
        new Date(booking.checkIn).getTime()) /
        86400000
    )
  );

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
    if (!confirm(`Delete ${selectedAddonIds.length} selected addon(s)?`)) return;

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

  // ═══ COMPANY ═══
  const saveCompanyDetails = () => {
    if (!company.companyName.trim()) {
      alert("Company name is required");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(`company_${booking.id}`, JSON.stringify(company));
    }
    showToast("✅ Company details saved");
    setCompanyOpen(false);
  };

  // ═══ EDIT RATE ═══
  const saveNewRate = async () => {
    if (!newRoomCharge || newRoomCharge <= 0) {
      alert("Enter a valid rate");
      return;
    }
    try {
      await modifyReservation(booking.id, { amount: newRoomCharge });
      showToast(`✅ Rate updated to ₹${newRoomCharge.toFixed(2)}`);
      setEditRateMode(false);
      onBookingUpdate();
      await loadData();
    } catch (err: any) {
      alert(`Failed to update rate: ${err.message}`);
    }
  };

  // ═══ PRINT TAX INVOICE (Stayflexi style) ═══
  const printFolio = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to print");
      return;
    }

    const addonRows = addons
      .map(
        (a) => `
      <tr>
        <td>${new Date(a.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</td>
        <td>${a.description}</td>
        <td>DEBIT</td>
        <td style="text-align:right;">Rs. ${a.amount.toFixed(2)}</td>
        <td style="text-align:right;">Rs. ${(a.amount * 0.05).toFixed(2)}</td>
        <td style="text-align:right; font-weight:600;">Rs. ${a.amount.toFixed(2)}</td>
      </tr>`
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tax Invoice - ${booking.primaryGuest.name}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; }

          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #14b8a6; }
          .hotel-block { display: flex; gap: 12px; align-items: flex-start; }
          .hotel-logo { width: 60px; height: 60px; object-fit: contain; flex-shrink: 0; }
          .hotel-details { font-size: 9px; color: #333; line-height: 1.5; }
          .hotel-name { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 3px; }

          .invoice-block { text-align: right; flex-shrink: 0; }
          .invoice-title { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
          .invoice-meta { font-size: 9px; color: #555; line-height: 1.6; }

          .booking-info { display: flex; gap: 30px; margin-bottom: 18px; }
          .booking-block { flex: 1; }
          .booking-block table { width: 100%; font-size: 9px; border-collapse: collapse; }
          .booking-block td { padding: 2px 0; vertical-align: top; }
          .booking-block .label { color: #555; width: 110px; }
          .booking-block .value { color: #1a1a1a; font-weight: 500; }

          .section-title { font-size: 10px; font-weight: 700; color: #1a1a1a; margin: 12px 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px; }

          table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
          table.items th { background: #1a1a1a; color: #fff; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 7px 5px; text-align: left; }
          table.items td { font-size: 9px; padding: 7px 5px; border-bottom: 1px solid #e5e5e5; }
          table.items tr:last-child td { border-bottom: 1px solid #1a1a1a; font-weight: 600; }

          .totals-section { display: flex; gap: 40px; margin-top: 18px; }
          .totals-block { flex: 1; }
          .totals-block table { width: 100%; font-size: 9px; border-collapse: collapse; }
          .totals-block td { padding: 3px 0; }
          .totals-block .label { color: #555; }
          .totals-block .value { text-align: right; font-weight: 500; }
          .totals-block .grand-total td { font-size: 11px; font-weight: 700; border-top: 2px solid #1a1a1a; padding-top: 6px; margin-top: 4px; }

          .signature-section { display: flex; justify-content: space-between; margin-top: 45px; }
          .signature-line { border-top: 1px solid #1a1a1a; width: 180px; text-align: center; padding-top: 4px; font-size: 9px; }

          .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 8px; color: #666; line-height: 1.6; }
          .footer strong { color: #1a1a1a; font-size: 9px; }

          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="hotel-block">
            <img src="https://staynexa.in/logo.png" alt="Vishara Elite" class="hotel-logo" onerror="this.style.display='none'" />
            <div class="hotel-details">
              <div class="hotel-name">Vishara Elite</div>
              306, 1st Main Rd, HBR Layout 4th Block,<br>
              HBR Layout, Bengaluru, Karnataka - 560043<br>
              visharaelite@gmail.com<br>
              Phone: +91 6361693637<br>
              Hotel GSTIN: 29AADFS4017F1ZZ
            </div>
          </div>
          <div class="invoice-block">
            <div class="invoice-title">Tax Invoice</div>
            <div class="invoice-meta">
              Invoice Date: ${new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}<br>
              Invoice#: ${booking.bookingRef || `SFBOOKING_${booking.id.slice(0, 12)}`}
            </div>
          </div>
        </div>

        <div class="booking-info">
          <div class="booking-block">
            <table>
              <tr><td class="label">Bill To:</td><td class="value">${booking.primaryGuest.name || "—"}</td></tr>
              <tr><td class="label">Address:</td><td class="value">${booking.primaryGuest.address || "—"}</td></tr>
              <tr><td class="label">Email:</td><td class="value">${booking.primaryGuest.email || "—"}</td></tr>
              <tr><td class="label">Phone:</td><td class="value">${booking.primaryGuest.phone || "—"}</td></tr>
              ${company.companyName ? `<tr><td class="label">Company:</td><td class="value">${company.companyName}</td></tr>` : ""}
              ${company.taxId ? `<tr><td class="label">Company GST:</td><td class="value">${company.taxId}</td></tr>` : ""}
            </table>
          </div>
          <div class="booking-block">
            <table>
              <tr><td class="label">Booking ID:</td><td class="value">${booking.bookingRef || booking.id.slice(0, 12)}</td></tr>
              <tr><td class="label">Check-in:</td><td class="value">${new Date(booking.checkIn).toLocaleDateString("en-IN")} 12:00 PM</td></tr>
              <tr><td class="label">Check-out:</td><td class="value">${new Date(booking.checkOut).toLocaleDateString("en-IN")} 11:00 AM</td></tr>
              <tr><td class="label">Room Type:</td><td class="value">${booking.roomType || "—"}</td></tr>
              <tr><td class="label">Room No:</td><td class="value">${booking.roomNumber || "—"}</td></tr>
              <tr><td class="label">Nights:</td><td class="value">${nights}</td></tr>
              <tr><td class="label">Guests:</td><td class="value">${booking.adults} Adults, ${booking.children} Children, ${booking.infants || 0} Infants</td></tr>
              <tr><td class="label">Rate plan:</td><td class="value">${booking.ratePlan || "EP"}</td></tr>
              <tr><td class="label">Source:</td><td class="value">${(booking.source || "direct").toUpperCase()}</td></tr>
              <tr><td class="label">Status:</td><td class="value">${booking.status}</td></tr>
            </table>
          </div>
        </div>

        <div class="section-title">Booking Items</div>
        <table class="items">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th style="text-align:right;">Sub-total</th>
              <th style="text-align:right;">Tax</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${new Date(booking.checkIn).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</td>
              <td>Booking Price</td>
              <td>DEBIT</td>
              <td style="text-align:right;">Rs. ${roomCharge.toFixed(2)}</td>
              <td style="text-align:right;">Rs. ${(roomCharge * 0.05).toFixed(2)}</td>
              <td style="text-align:right; font-weight:600;">Rs. ${roomCharge.toFixed(2)}</td>
            </tr>
            ${addonRows}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-block">
            <div class="section-title">Tax breakdown</div>
            <table>
              <tr><td class="label">GST</td><td class="value">Rs. ${gst.toFixed(2)}</td></tr>
              <tr><td class="label">CGST</td><td class="value">Rs. ${cgst.toFixed(2)}</td></tr>
              <tr><td class="label">SGST</td><td class="value">Rs. ${sgst.toFixed(2)}</td></tr>
            </table>
          </div>
          <div class="totals-block">
            <table>
              <tr><td class="label">Sub total:</td><td class="value">Rs. ${totalExclTax.toFixed(2)}</td></tr>
              <tr><td class="label">CGST:</td><td class="value">Rs. ${cgst.toFixed(2)}</td></tr>
              <tr><td class="label">SGST:</td><td class="value">Rs. ${sgst.toFixed(2)}</td></tr>
              <tr><td class="label">Total:</td><td class="value">Rs. ${totalWithTax.toFixed(2)}</td></tr>
              ${paidByMode("ota") > 0 ? `<tr><td class="label">OTA Prepaid:</td><td class="value">Rs. ${paidByMode("ota").toFixed(2)}</td></tr>` : ""}
              ${paidByMode("cash") > 0 ? `<tr><td class="label">Cash:</td><td class="value">Rs. ${paidByMode("cash").toFixed(2)}</td></tr>` : ""}
              ${paidByMode("upi") > 0 ? `<tr><td class="label">UPI:</td><td class="value">Rs. ${paidByMode("upi").toFixed(2)}</td></tr>` : ""}
              ${paidByMode("card") > 0 ? `<tr><td class="label">Card:</td><td class="value">Rs. ${paidByMode("card").toFixed(2)}</td></tr>` : ""}
              <tr><td class="label">Payment made:</td><td class="value">Rs. ${totalPaid.toFixed(2)}</td></tr>
              <tr class="grand-total"><td class="label">Balance due:</td><td class="value">Rs. ${balanceDue.toFixed(2)}</td></tr>
            </table>
          </div>
        </div>

        <div class="signature-section">
          <div class="signature-line">Guest Signature</div>
          <div class="signature-line">Authorized Signature</div>
        </div>

        <div class="footer">
          <strong>Cancellation Policies</strong><br>
          ${booking.roomType || "Standard"} Room, ${booking.ratePlan || "EP"} Plan : Cancel before 0 days 0 hours of your checkin and get a refund of 0.0%.<br><br>
          <strong>Property Terms and Conditions</strong><br>
          Foreign guests are not allowed.<br>
          Pets are not allowed.<br>
          Visitors are not allowed inside the room.
        </div>

        <script>setTimeout(function(){ window.print(); }, 500);</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    showToast("🖨 Preparing Tax Invoice...");
  };

  // ═══ PRINT REGISTRATION CARD ═══
  const printRegistrationCard = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to print the registration card");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Registration Card - ${booking.primaryGuest.name}</title>
        <style>
          @page { size: A5; margin: 10mm; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
          .hotel-name { font-size: 16px; font-weight: bold; }
          .hotel-info { font-size: 10px; color: #555; margin-top: 4px; }
          .title { text-align: center; font-weight: bold; font-size: 14px; margin: 10px 0; letter-spacing: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          td, th { border: 1px solid #000; padding: 5px 8px; font-size: 10px; vertical-align: top; }
          .label { font-weight: 600; width: 130px; background: #f5f5f5; }
          .signature { margin-top: 30px; display: flex; justify-content: space-between; }
          .signature-line { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 3px; font-size: 10px; }
          @media print { body { print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="hotel-name">Vishara Elite</div>
            <div class="hotel-info">
              306, 1st Main Rd, HBR Layout 4th Block,<br>
              HBR Layout, Bengaluru, Karnataka 560043<br>
              Email: visharaelite@gmail.com
            </div>
          </div>
          <div style="text-align: right;">
            <div class="hotel-info">
              Invoice No: ${booking.bookingRef || booking.id.slice(0, 12)}<br>
              Check-In: ${new Date(booking.checkIn).toLocaleDateString("en-IN")}<br>
              Check-Out: ${new Date(booking.checkOut).toLocaleDateString("en-IN")}<br>
              Nights: ${nights}
            </div>
          </div>
        </div>

        <div class="title">REGISTRATION CARD</div>

        <table>
          <tr><td class="label">Guest Name</td><td>${booking.primaryGuest.name || ""}</td><td class="label">Nationality</td><td>Indian</td></tr>
          <tr><td class="label">Email</td><td>${booking.primaryGuest.email || ""}</td><td class="label">Phone</td><td>${booking.primaryGuest.phone || ""}</td></tr>
          <tr><td class="label">Address</td><td colspan="3">${booking.primaryGuest.address || ""}${booking.primaryGuest.city ? ", " + booking.primaryGuest.city : ""}${booking.primaryGuest.state ? ", " + booking.primaryGuest.state : ""}${booking.primaryGuest.pincode ? " - " + booking.primaryGuest.pincode : ""}</td></tr>
          <tr><td class="label">Source</td><td>${(booking.source || "direct").toUpperCase()}</td><td class="label">Booking Amount</td><td>₹${booking.amount.toFixed(2)}</td></tr>
          <tr><td class="label">Purpose of Visit</td><td colspan="3">${company.companyName || "Tourism / Business"}</td></tr>
          ${company.companyName ? `<tr><td class="label">Company Name</td><td>${company.companyName}</td><td class="label">Company Tax ID</td><td>${company.taxId || "—"}</td></tr>` : ""}
          ${company.companyPhone ? `<tr><td class="label">Company Phone</td><td>${company.companyPhone}</td><td class="label">Company Email</td><td>${company.companyEmail || "—"}</td></tr>` : ""}
          ${company.companyAddress ? `<tr><td class="label">Company Address</td><td colspan="3">${company.companyAddress}</td></tr>` : ""}
        </table>

        <table style="margin-top: 10px;">
          <thead>
            <tr><th>Room Type</th><th>Room IDs</th><th>Rate Plan</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>${booking.roomType || "—"}</td>
              <td>${booking.roomNumber || "—"}</td>
              <td>${booking.ratePlan || "EP"}</td>
              <td>₹${booking.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signature">
          <div class="signature-line">Guest Signature</div>
          <div class="signature-line">Hotel Signature</div>
        </div>

        <script>setTimeout(function(){ window.print(); window.close(); }, 300);</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setRegCardOpen(false);
    showToast("🖨 Printing registration card...");
  };

  // ═══ PRINT C FORM ═══
  const printCForm = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to print");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Form C - ${booking.primaryGuest.name}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
          .title { text-align: center; font-weight: bold; font-size: 16px; margin: 10px 0 5px 0; }
          .subtitle { text-align: center; font-size: 11px; color: #555; margin-bottom: 20px; }
          .field { margin: 8px 0; }
          .label { font-weight: 600; display: inline-block; min-width: 250px; }
          .value { border-bottom: 1px solid #000; display: inline-block; padding: 0 5px; min-width: 300px; }
          .photo-box { float: right; border: 1px solid #000; width: 120px; height: 150px; text-align: center; padding-top: 60px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="photo-box">PHOTOGRAPH OF FOREIGNER</div>
        <div class="title">FORM C</div>
        <div class="subtitle">(See rule 14) - ARRIVAL REPORT OF FOREIGNER IN HOTEL</div>
        <div class="field"><span class="label">1. Name and address of Hotel:</span> <span class="value">Vishara Elite, Bengaluru</span></div>
        <div class="field"><span class="label">2. Phone No. / Mobile No. Of Hotel:</span> <span class="value">+91 6361693637</span></div>
        <div class="field"><span class="label">3. Name of the foreign visitor in full:</span> <span class="value">${booking.primaryGuest.name || ""}</span></div>
        <div class="field"><span class="label">4. Date of Birth:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">5. Address in country of residence:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">6. Address / reference in India:</span> <span class="value">${booking.primaryGuest.address || ""}</span></div>
        <div class="field"><span class="label">7. Nationality:</span> <span class="value">Indian</span></div>
        <div class="field"><span class="label">8. Passport No.:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">9. Place of issue of Passport:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">10. Date of issue of Passport:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">11. Valid till:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">12. Visa No.:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">13. Date of issue:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">14. Valid till:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">15. Type of visa:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">16. Place of issue:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">17. Arrived from:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">18. Date of arrival in India:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">19. Date of arrival in Hotel:</span> <span class="value">${new Date(booking.checkIn).toLocaleDateString("en-IN")}</span></div>
        <div class="field"><span class="label">20. Time of arrival:</span> <span class="value">12:00 PM</span></div>
        <div class="field"><span class="label">21. Intended duration of stay:</span> <span class="value">${nights} day(s)</span></div>
        <div class="field"><span class="label">22. Whether employed in India:</span> <span class="value">&nbsp;</span></div>
        <div class="field"><span class="label">23. Purpose of Visit:</span> <span class="value">Tourism / Business</span></div>
        <script>setTimeout(function(){ window.print(); }, 300);</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    showToast("🖨 Printing C Form...");
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
            <button onClick={printFolio} title="Print Tax Invoice" className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600">🖨</button>
            <button onClick={onClose} className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-gray-600 text-xl">×</button>

            {threeDotOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setThreeDotOpen(false)} />
                <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl w-[520px] p-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <div className="space-y-1">
                      <button onClick={() => { setThreeDotOpen(false); setRegCardOpen(true); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Print Registration card</button>
                      <button onClick={() => { setThreeDotOpen(false); printCForm(); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Print C form</button>
                      <button onClick={() => { setThreeDotOpen(false); printFolio(); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Print Tax Invoice</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Email Folio Details", message: `Email folio to ${booking.primaryGuest.email || "guest"}?` }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Email folio details</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Folio Log", message: "Showing all changes for this booking." }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Folio log</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Edit Rate Plan", message: "Change rate plan?" }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Edit rate plan</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Apply Coupon", message: "Apply coupon/discount?" }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Apply Coupon code / Discount / Offer</button>
                      <button onClick={() => { setThreeDotOpen(false); setAddonOpen(true); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Add hotel addons</button>
                      <button onClick={() => { setThreeDotOpen(false); setTaxExempt(!taxExempt); showToast(`✅ Tax exempt ${!taxExempt ? "enabled" : "disabled"}`); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Tax exempt status</button>
                      <button onClick={() => { setThreeDotOpen(false); setCompanyOpen(true); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Add Company Details</button>
                    </div>
                    <div className="space-y-1">
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Lock Booking", message: "Lock this booking?" }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Lock booking</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Unlock Booking", message: "Unlock this booking?" }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Unlock booking</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Unassign Room", message: `Unassign Room ${booking.roomNumber}?` }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Unassign room</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Assign Room", message: "Open room picker." }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Assign Room</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Modify Checkout", message: `Change check-out from ${booking.checkOut}?` }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Modify checkout</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Move Room", message: "Move to different room?" }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Move Room</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Scanty Baggage", message: "Record scanty baggage?" }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Scanty Baggage</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Add Room to Group", message: "Add another room?" }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Add new room to group booking</button>
                      <button onClick={() => { setThreeDotOpen(false); setInfoModal({ title: "Download Voucher", message: "Download booking voucher PDF?" }); }} className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Download Booking Voucher</button>
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

            {/* Invoice table with editable rate */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 w-8">
                      <input type="checkbox" className="rounded cursor-pointer" checked={addons.length > 0 && selectedAddonIds.length === addons.length} onChange={toggleSelectAllAddons} />
                    </th>
                    <th className="py-2 text-[10px] uppercase text-gray-500">Date</th>
                    <th className="py-2 text-[10px] uppercase text-gray-500">Description</th>
                    <th className="py-2 text-[10px] uppercase text-gray-500 text-right">Sub-total</th>
                    <th className="py-2 text-[10px] uppercase text-gray-500 text-right">Tax</th>
                    <th className="py-2 text-[10px] uppercase text-gray-500 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* BOOKING PRICE ROW — EDITABLE RATE */}
                  <tr className="border-b border-gray-100 bg-amber-50/30">
                    <td className="py-3"></td>
                    <td className="py-3">{new Date(booking.checkIn).toLocaleDateString("en-IN")}</td>
                    <td className="py-3 font-medium text-gray-900">Booking Price</td>
                    <td className="py-3 text-right" colSpan={2}>
                      {editRateMode ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">₹</span>
                          <input
                            type="number"
                            value={newRoomCharge}
                            onChange={(e) => setNewRoomCharge(parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-teal-500 rounded text-right text-sm font-semibold focus:outline-none"
                            autoFocus
                          />
                          <span className="text-xs text-gray-500">
                            + tax ₹{(newRoomCharge * 0.05).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">
                          Sub ₹{roomCharge.toFixed(2)} + Tax ₹{(roomCharge * 0.05).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right font-semibold">
                      {editRateMode ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-bold text-teal-700">
                            ₹{(newRoomCharge + newRoomCharge * 0.05).toFixed(2)}
                          </span>
                          <button
                            onClick={saveNewRate}
                            className="ml-2 px-2 py-1 bg-teal-600 text-white text-[10px] font-semibold rounded hover:bg-teal-700"
                            title="Save"
                          >
                            ✓ Save
                          </button>
                          <button
                            onClick={() => {
                              setEditRateMode(false);
                              setNewRoomCharge(roomCharge);
                            }}
                            className="px-2 py-1 bg-gray-200 text-gray-700 text-[10px] font-semibold rounded hover:bg-gray-300"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditRateMode(true);
                            setNewRoomCharge(roomCharge);
                          }}
                          className="group inline-flex items-center gap-1 hover:text-teal-700"
                          title="Click to edit rate"
                        >
                          <span>₹{roomCharge.toFixed(2)}</span>
                          <span className="text-[10px] text-gray-400 group-hover:text-teal-600">✎</span>
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* ADDON ROWS */}
                  {addons.map((a) => (
                    <tr key={a.id} className={`border-b border-gray-100 transition-colors ${selectedAddonIds.includes(a.id) ? "bg-rose-50" : ""}`}>
                      <td className="py-3">
                        <input type="checkbox" className="rounded cursor-pointer" checked={selectedAddonIds.includes(a.id)} onChange={() => toggleAddonSelection(a.id)} />
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

              {addons.length > 0 && (
                <div className="flex items-center gap-3 mt-3 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input type="checkbox" className="rounded" checked={addons.length > 0 && selectedAddonIds.length === addons.length} onChange={toggleSelectAllAddons} />
                    <span className="text-gray-700 font-medium">Select All ({selectedAddonIds.length}/{addons.length})</span>
                  </label>
                  {selectedAddonIds.length > 0 && (
                    <button onClick={deleteSelectedAddons} className="ml-auto px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded hover:bg-rose-700 transition">
                      🗑 Delete {selectedAddonIds.length} Selected
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Folio summary */}
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
                  {paidByMode("ota") > 0 && <div className="flex justify-between"><span className="text-gray-600">OTA prepaid</span><span>Rs. {paidByMode("ota").toFixed(2)}</span></div>}
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
              <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (₹)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2.5 border rounded-md text-lg font-semibold" autoFocus /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Reference</label><input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full px-3 py-2.5 border rounded-md" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Note</label><input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2.5 border rounded-md" /></div>
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

      {/* COMPANY DETAILS MODAL */}
      {companyOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">Add Company Details</h3>
              <button onClick={() => setCompanyOpen(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" placeholder="Enter Tax Identification Number" value={company.taxId} onChange={(e) => setCompany({ ...company, taxId: e.target.value })} className="w-full px-3 py-2.5 border rounded-md" />
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Company Name" value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} className="w-full px-3 py-2.5 border rounded-md" autoFocus />
                <input type="text" placeholder="Company Phone" value={company.companyPhone} onChange={(e) => setCompany({ ...company, companyPhone: e.target.value })} className="w-full px-3 py-2.5 border rounded-md" />
              </div>
              <input type="email" placeholder="Company Email" value={company.companyEmail} onChange={(e) => setCompany({ ...company, companyEmail: e.target.value })} className="w-full px-3 py-2.5 border rounded-md" />
              <input type="text" placeholder="Company Address" value={company.companyAddress} onChange={(e) => setCompany({ ...company, companyAddress: e.target.value })} className="w-full px-3 py-2.5 border rounded-md" />
              <button onClick={saveCompanyDetails} className="w-full py-3 bg-slate-800 text-white text-sm font-semibold rounded-md hover:bg-slate-900">Add Details</button>
            </div>
          </div>
        </div>
      )}

      {/* REG CARD MODAL */}
      {regCardOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">Print Registration card</h3>
              <button onClick={() => setRegCardOpen(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="p-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={fillManually} onChange={(e) => setFillManually(e.target.checked)} className="w-5 h-5 rounded" />
                <span className="text-sm text-gray-700">I'll fill up the details manually into the Registration card!</span>
              </label>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-between items-center border-t">
              <button onClick={() => setRegCardOpen(false)} className="text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={printRegistrationCard} className="px-6 py-2.5 bg-slate-800 text-white rounded-md text-sm font-semibold flex items-center gap-2">
                🖨 Print
              </button>
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
