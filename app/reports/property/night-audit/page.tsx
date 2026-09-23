"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getActiveHotelId } from "../../../active-hotel";
import { fetchNightAudit, type NightAuditReport } from "../../../lib/night-audit";

function fmtINR(n: number): string {
  return `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const typeColors: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  BOOKING: { bg: "bg-blue-100", text: "text-blue-700", label: "Booking", icon: "📅" },
  CHECKIN: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Check-In", icon: "✅" },
  CHECKOUT: { bg: "bg-rose-100", text: "text-rose-700", label: "Check-Out", icon: "🚪" },
  PAYMENT: { bg: "bg-teal-100", text: "text-teal-700", label: "Payment", icon: "💰" },
  REFUND: { bg: "bg-orange-100", text: "text-orange-700", label: "Refund", icon: "↩️" },
  CANCEL: { bg: "bg-slate-100", text: "text-slate-700", label: "Cancelled", icon: "❌" },
  ADDON: { bg: "bg-amber-100", text: "text-amber-700", label: "Addon", icon: "➕" },
};

// ═══════════════════════════════════════════════
// EXPORT HELPERS
// ═══════════════════════════════════════════════

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadNightAuditCSV(report: NightAuditReport) {
  const rows: string[][] = [];
  rows.push(["Night Audit Report"]);
  rows.push(["Hotel", report.hotelName]);
  rows.push(["Business Date", report.businessDate]);
  rows.push(["Generated At", new Date(report.generatedAt).toLocaleString("en-IN")]);
  rows.push([]);
  
  rows.push(["ROOM STATISTICS"]);
  rows.push(["Total Rooms", String(report.roomStats.totalRooms)]);
  rows.push(["Occupied Rooms", String(report.roomStats.occupiedRooms)]);
  rows.push(["Available Rooms", String(report.roomStats.availableRooms)]);
  rows.push(["Out of Order", String(report.roomStats.outOfOrder)]);
  rows.push(["Occupancy Rate (%)", report.roomStats.occupancyRate.toFixed(2)]);
  rows.push(["Room Nights", String(report.roomStats.roomNights)]);
  rows.push(["ADR", report.roomStats.adr.toFixed(2)]);
  rows.push(["RevPAR", report.roomStats.revpar.toFixed(2)]);
  rows.push([]);
  
  rows.push(["REVENUE BREAKDOWN"]);
  rows.push(["Room Revenue", report.revenue.roomRevenue.toFixed(2)]);
  rows.push(["Room Tax", report.revenue.roomTax.toFixed(2)]);
  rows.push(["Addon Revenue", report.revenue.addonRevenue.toFixed(2)]);
  rows.push(["Addon Tax", report.revenue.addonTax.toFixed(2)]);
  rows.push(["Total Revenue", report.revenue.totalRevenue.toFixed(2)]);
  rows.push(["Refunds", report.revenue.refunds.toFixed(2)]);
  rows.push(["Net Revenue", report.revenue.netRevenue.toFixed(2)]);
  rows.push([]);
  
  rows.push(["PAYMENT COLLECTION"]);
  rows.push(["Cash", report.payments.cash.toFixed(2)]);
  rows.push(["UPI", report.payments.upi.toFixed(2)]);
  rows.push(["Card", report.payments.card.toFixed(2)]);
  rows.push(["Bank Transfer", report.payments.bankTransfer.toFixed(2)]);
  rows.push(["Other", report.payments.other.toFixed(2)]);
  rows.push(["Total Collected", report.payments.total.toFixed(2)]);
  rows.push(["Transaction Count", String(report.payments.count)]);
  rows.push([]);
  
  rows.push(["CASH DRAWER"]);
  rows.push(["Opening Balance", report.cashDrawer.openingBalance.toFixed(2)]);
  rows.push(["Cash Received", report.cashDrawer.cashReceived.toFixed(2)]);
  rows.push(["Cash Refunds", report.cashDrawer.cashRefunds.toFixed(2)]);
  rows.push(["Expenses", report.cashDrawer.expenses.toFixed(2)]);
  rows.push(["Expected Closing", report.cashDrawer.expectedClosing.toFixed(2)]);
  rows.push([]);
  
  rows.push(["OPERATIONS"]);
  rows.push(["New Bookings", String(report.newBookings)]);
  rows.push(["Checked In", String(report.arrivalsCompleted)]);
  rows.push(["Checked Out", String(report.departuresCompleted)]);
  rows.push(["Cancellations", String(report.cancellations)]);
  rows.push(["In-House Count", String(report.inHouseCount)]);
  rows.push([]);
  
  rows.push(["TRANSACTION LOG"]);
  rows.push(["Time", "Type", "Guest Name", "Room", "Description", "Amount", "Method"]);
  report.transactions.forEach((t) => {
    rows.push([
      t.time,
      t.type,
      t.guestName,
      t.roomNumber || "—",
      t.description,
      t.amount > 0 ? t.amount.toFixed(2) : "0",
      t.method || "",
    ]);
  });
  rows.push([]);
  
  rows.push(["TOMORROW'S ARRIVALS"]);
  rows.push(["Guest Name", "Room", "Room Type", "Adults", "Children", "Status"]);
  report.tomorrowArrivals.forEach((a) => {
    rows.push([a.guestName, a.roomNumber || "—", a.roomType || "—", String(a.adults), String(a.children), a.status]);
  });
  rows.push([]);
  
  rows.push(["TOMORROW'S DEPARTURES"]);
  rows.push(["Guest Name", "Room", "Room Type", "Adults", "Children", "Status"]);
  report.tomorrowDepartures.forEach((d) => {
    rows.push([d.guestName, d.roomNumber || "—", d.roomType || "—", String(d.adults), String(d.children), d.status]);
  });
  
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `Night_Audit_${report.businessDate}.csv`);
}

function downloadNightAuditExcel(report: NightAuditReport) {
  const esc = (v: any) => String(v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
  html += `<head><meta charset="UTF-8"><style>`;
  html += `table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt;margin-bottom:20px;}`;
  html += `th{background:#0f172a;color:#fff;border:1px solid #cbd5e1;padding:8px 12px;text-align:left;font-weight:bold;font-size:10pt;}`;
  html += `td{border:1px solid #e2e8f0;padding:6px 12px;}`;
  html += `td.num{text-align:right;}`;
  html += `tr:nth-child(even) td{background:#f8fafc;}`;
  html += `h2{font-family:Calibri;color:#0f172a;margin:20px 0 8px;font-size:16pt;}`;
  html += `h1{font-family:Calibri;color:#0f172a;font-size:20pt;margin:0 0 8px;}`;
  html += `.section-h{background:#1e40af;color:#fff;padding:8px 12px;font-weight:bold;font-size:12pt;}`;
  html += `.kpi-total td{background:#fef3c7 !important;font-weight:bold;}`;
  html += `</style></head><body>`;
  
  html += `<h1>Night Audit Report</h1>`;
  html += `<p><strong>Hotel:</strong> ${esc(report.hotelName)}</p>`;
  html += `<p><strong>Business Date:</strong> ${esc(report.businessDate)}</p>`;
  html += `<p><strong>Generated:</strong> ${esc(new Date(report.generatedAt).toLocaleString("en-IN"))}</p>`;
  
  // Room Stats
  html += `<h2>Room Statistics</h2><table><tbody>`;
  html += `<tr><td>Total Rooms</td><td class="num">${report.roomStats.totalRooms}</td></tr>`;
  html += `<tr><td>Occupied Rooms</td><td class="num">${report.roomStats.occupiedRooms}</td></tr>`;
  html += `<tr><td>Available Rooms</td><td class="num">${report.roomStats.availableRooms}</td></tr>`;
  html += `<tr><td>Out of Order</td><td class="num">${report.roomStats.outOfOrder}</td></tr>`;
  html += `<tr><td>Occupancy Rate</td><td class="num">${report.roomStats.occupancyRate.toFixed(2)}%</td></tr>`;
  html += `<tr><td>Room Nights</td><td class="num">${report.roomStats.roomNights}</td></tr>`;
  html += `<tr><td>ADR</td><td class="num">₹${report.roomStats.adr.toFixed(2)}</td></tr>`;
  html += `<tr><td>RevPAR</td><td class="num">₹${report.roomStats.revpar.toFixed(2)}</td></tr>`;
  html += `</tbody></table>`;
  
  // Revenue
  html += `<h2>Revenue Breakdown</h2><table><tbody>`;
  html += `<tr><td>Room Revenue</td><td class="num">₹${report.revenue.roomRevenue.toFixed(2)}</td></tr>`;
  html += `<tr><td>Room Tax</td><td class="num">₹${report.revenue.roomTax.toFixed(2)}</td></tr>`;
  html += `<tr><td>Addon Revenue</td><td class="num">₹${report.revenue.addonRevenue.toFixed(2)}</td></tr>`;
  html += `<tr><td>Addon Tax</td><td class="num">₹${report.revenue.addonTax.toFixed(2)}</td></tr>`;
  html += `<tr class="kpi-total"><td>Total Revenue</td><td class="num">₹${report.revenue.totalRevenue.toFixed(2)}</td></tr>`;
  html += `<tr><td>Refunds</td><td class="num">₹${report.revenue.refunds.toFixed(2)}</td></tr>`;
  html += `<tr class="kpi-total"><td>Net Revenue</td><td class="num">₹${report.revenue.netRevenue.toFixed(2)}</td></tr>`;
  html += `</tbody></table>`;
  
  // Payments
  html += `<h2>Payment Collection</h2><table><tbody>`;
  html += `<tr><td>Cash</td><td class="num">₹${report.payments.cash.toFixed(2)}</td></tr>`;
  html += `<tr><td>UPI</td><td class="num">₹${report.payments.upi.toFixed(2)}</td></tr>`;
  html += `<tr><td>Card</td><td class="num">₹${report.payments.card.toFixed(2)}</td></tr>`;
  html += `<tr><td>Bank Transfer</td><td class="num">₹${report.payments.bankTransfer.toFixed(2)}</td></tr>`;
  html += `<tr><td>Other</td><td class="num">₹${report.payments.other.toFixed(2)}</td></tr>`;
  html += `<tr class="kpi-total"><td>Total Collected</td><td class="num">₹${report.payments.total.toFixed(2)}</td></tr>`;
  html += `</tbody></table>`;
  
  // Cash Drawer
  html += `<h2>Cash Drawer Reconciliation</h2><table><tbody>`;
  html += `<tr><td>Opening Balance</td><td class="num">₹${report.cashDrawer.openingBalance.toFixed(2)}</td></tr>`;
  html += `<tr><td>Cash Received</td><td class="num">₹${report.cashDrawer.cashReceived.toFixed(2)}</td></tr>`;
  html += `<tr><td>Cash Refunds</td><td class="num">₹${report.cashDrawer.cashRefunds.toFixed(2)}</td></tr>`;
  html += `<tr><td>Expenses</td><td class="num">₹${report.cashDrawer.expenses.toFixed(2)}</td></tr>`;
  html += `<tr class="kpi-total"><td>Expected Closing</td><td class="num">₹${report.cashDrawer.expectedClosing.toFixed(2)}</td></tr>`;
  html += `</tbody></table>`;
  
  // Transactions
  html += `<h2>Transaction Log (${report.transactions.length} entries)</h2>`;
  html += `<table><thead><tr><th>Time</th><th>Type</th><th>Guest</th><th>Room</th><th>Description</th><th>Amount</th><th>Method</th></tr></thead><tbody>`;
  report.transactions.forEach((t) => {
    html += `<tr><td>${esc(t.time)}</td><td>${esc(t.type)}</td><td>${esc(t.guestName)}</td><td>${esc(t.roomNumber || "—")}</td><td>${esc(t.description)}</td><td class="num">${t.amount > 0 ? "₹" + t.amount.toFixed(2) : "—"}</td><td>${esc(t.method || "")}</td></tr>`;
  });
  html += `</tbody></table>`;
  
  // Tomorrow Arrivals
  html += `<h2>Tomorrow's Arrivals</h2>`;
  html += `<table><thead><tr><th>Guest</th><th>Room</th><th>Type</th><th>Adults</th><th>Children</th><th>Status</th></tr></thead><tbody>`;
  report.tomorrowArrivals.forEach((a) => {
    html += `<tr><td>${esc(a.guestName)}</td><td>${esc(a.roomNumber || "—")}</td><td>${esc(a.roomType || "—")}</td><td>${a.adults}</td><td>${a.children}</td><td>${esc(a.status)}</td></tr>`;
  });
  html += `</tbody></table>`;
  
  // Tomorrow Departures
  html += `<h2>Tomorrow's Departures</h2>`;
  html += `<table><thead><tr><th>Guest</th><th>Room</th><th>Type</th><th>Adults</th><th>Children</th><th>Status</th></tr></thead><tbody>`;
  report.tomorrowDepartures.forEach((d) => {
    html += `<tr><td>${esc(d.guestName)}</td><td>${esc(d.roomNumber || "—")}</td><td>${esc(d.roomType || "—")}</td><td>${d.adults}</td><td>${d.children}</td><td>${esc(d.status)}</td></tr>`;
  });
  html += `</tbody></table>`;
  
  html += `</body></html>`;
  
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  triggerDownload(blob, `Night_Audit_${report.businessDate}.xls`);
}

function downloadNightAuditPDF(report: NightAuditReport) {
  const w = window.open("", "_blank", "width=1200,height=900");
  if (!w) {
    alert("Please allow pop-ups to download PDF");
    return;
  }
  
  const esc = (v: any) => String(v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  let html = `<!DOCTYPE html><html><head><title>Night Audit - ${esc(report.businessDate)}</title><style>`;
  html += `*{box-sizing:border-box;margin:0;padding:0;}`;
  html += `body{font-family:'Helvetica Neue',Arial,sans-serif;padding:28px;color:#0f172a;font-size:12px;}`;
  html += `.header{border-bottom:3px solid #0f172a;padding-bottom:18px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end;}`;
  html += `.header h1{font-size:24px;font-weight:700;letter-spacing:-0.5px;}`;
  html += `.header p{font-size:12px;color:#64748b;margin-top:4px;}`;
  html += `.header .meta{text-align:right;font-size:11px;color:#64748b;}`;
  html += `h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:22px 0 10px;padding-bottom:6px;border-bottom:2px solid #0f172a;}`;
  html += `.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}`;
  html += `.kpi-box{border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f8fafc;}`;
  html += `.kpi-box .label{font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;}`;
  html += `.kpi-box .value{font-size:20px;font-weight:700;color:#0f172a;margin-top:4px;}`;
  html += `.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}`;
  html += `table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px;}`;
  html += `th{background:#0f172a;color:#fff;padding:8px 10px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;}`;
  html += `th.right,td.right{text-align:right;}`;
  html += `th.center,td.center{text-align:center;}`;
  html += `td{padding:8px 10px;border-bottom:1px solid #e2e8f0;}`;
  html += `tr:nth-child(even) td{background:#f8fafc;}`;
  html += `tr.total-row td{background:#fef3c7 !important;font-weight:700;}`;
  html += `tr.grand-total td{background:#0f172a !important;color:#fff !important;font-weight:700;}`;
  html += `.footer{margin-top:24px;padding-top:12px;border-top:1px solid #cbd5e1;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;}`;
  html += `.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:100px;color:rgba(15,23,42,0.03);font-weight:900;pointer-events:none;z-index:-1;letter-spacing:0.1em;}`;
  html += `@media print{body{padding:16px;} table{font-size:10px;} th,td{padding:6px 8px;}}`;
  html += `</style></head><body>`;
  
  html += `<div class="watermark">STAYNEXA</div>`;
  html += `<div class="header">`;
  html += `<div><h1>🌙 Night Audit Report</h1><p><strong>${esc(report.hotelName)}</strong></p></div>`;
  html += `<div class="meta"><div><strong>Business Date:</strong> ${esc(report.businessDate)}</div><div>Generated: ${esc(new Date(report.generatedAt).toLocaleString("en-IN"))}</div></div>`;
  html += `</div>`;
  
  // KPI Grid
  html += `<div class="kpi-grid">`;
  html += `<div class="kpi-box"><div class="label">Occupancy</div><div class="value">${report.roomStats.occupancyRate.toFixed(1)}%</div></div>`;
  html += `<div class="kpi-box"><div class="label">ADR</div><div class="value">₹${report.roomStats.adr.toFixed(2)}</div></div>`;
  html += `<div class="kpi-box"><div class="label">RevPAR</div><div class="value">₹${report.roomStats.revpar.toFixed(2)}</div></div>`;
  html += `<div class="kpi-box"><div class="label">Room Nights</div><div class="value">${report.roomStats.roomNights}</div></div>`;
  html += `</div>`;
  
  // Revenue + Payments
  html += `<div class="grid">`;
  html += `<div><h2>Revenue Breakdown</h2><table>`;
  html += `<tr><td>Room Revenue</td><td class="right">₹${report.revenue.roomRevenue.toFixed(2)}</td></tr>`;
  html += `<tr><td>Room Tax</td><td class="right">₹${report.revenue.roomTax.toFixed(2)}</td></tr>`;
  html += `<tr><td>Addon Revenue</td><td class="right">₹${report.revenue.addonRevenue.toFixed(2)}</td></tr>`;
  html += `<tr><td>Addon Tax</td><td class="right">₹${report.revenue.addonTax.toFixed(2)}</td></tr>`;
  html += `<tr class="total-row"><td>Total Revenue</td><td class="right">₹${report.revenue.totalRevenue.toFixed(2)}</td></tr>`;
  html += `<tr><td>Refunds</td><td class="right">₹${report.revenue.refunds.toFixed(2)}</td></tr>`;
  html += `<tr class="grand-total"><td>Net Revenue</td><td class="right">₹${report.revenue.netRevenue.toFixed(2)}</td></tr>`;
  html += `</table></div>`;
  
  html += `<div><h2>Payment Collection</h2><table>`;
  html += `<tr><td>Cash</td><td class="right">₹${report.payments.cash.toFixed(2)}</td></tr>`;
  html += `<tr><td>UPI</td><td class="right">₹${report.payments.upi.toFixed(2)}</td></tr>`;
  html += `<tr><td>Card</td><td class="right">₹${report.payments.card.toFixed(2)}</td></tr>`;
  html += `<tr><td>Bank Transfer</td><td class="right">₹${report.payments.bankTransfer.toFixed(2)}</td></tr>`;
  html += `<tr><td>Other</td><td class="right">₹${report.payments.other.toFixed(2)}</td></tr>`;
  html += `<tr class="grand-total"><td>Total Collected</td><td class="right">₹${report.payments.total.toFixed(2)}</td></tr>`;
  html += `</table></div>`;
  html += `</div>`;
  
  // Cash Drawer
  html += `<h2>Cash Drawer Reconciliation</h2><table>`;
  html += `<thead><tr><th>Opening Balance</th><th>Cash Received</th><th>Refunds / Expenses</th><th>Expected Closing</th></tr></thead>`;
  html += `<tbody><tr>`;
  html += `<td>₹${report.cashDrawer.openingBalance.toFixed(2)}</td>`;
  html += `<td>+ ₹${report.cashDrawer.cashReceived.toFixed(2)}</td>`;
  html += `<td>- ₹${(report.cashDrawer.cashRefunds + report.cashDrawer.expenses).toFixed(2)}</td>`;
  html += `<td><strong>₹${report.cashDrawer.expectedClosing.toFixed(2)}</strong></td>`;
  html += `</tr></tbody></table>`;
  
  // Transactions
  html += `<h2>Transaction Log (${report.transactions.length} entries)</h2>`;
  html += `<table><thead><tr><th>Time</th><th>Type</th><th>Guest</th><th>Room</th><th>Description</th><th class="right">Amount</th></tr></thead><tbody>`;
  if (report.transactions.length === 0) {
    html += `<tr><td colspan="6" style="text-align:center;padding:16px;color:#94a3b8;">No transactions recorded</td></tr>`;
  } else {
    report.transactions.forEach((t) => {
      html += `<tr><td>${esc(t.time)}</td><td>${esc(t.type)}</td><td>${esc(t.guestName)}</td><td>${esc(t.roomNumber || "—")}</td><td>${esc(t.description)}</td><td class="right">${t.amount > 0 ? "₹" + t.amount.toFixed(2) : "—"}</td></tr>`;
    });
  }
  html += `</tbody></table>`;
  
  // Tomorrow's Preview
  html += `<div class="grid">`;
  html += `<div><h2>Tomorrow's Arrivals (${report.tomorrowArrivals.length})</h2>`;
  html += `<table><thead><tr><th>Guest</th><th>Room</th><th>Status</th></tr></thead><tbody>`;
  if (report.tomorrowArrivals.length === 0) {
    html += `<tr><td colspan="3" style="text-align:center;padding:12px;color:#94a3b8;">None</td></tr>`;
  } else {
    report.tomorrowArrivals.forEach((a) => {
      html += `<tr><td>${esc(a.guestName)}</td><td>${esc(a.roomNumber || "—")}</td><td>${esc(a.status)}</td></tr>`;
    });
  }
  html += `</tbody></table></div>`;
  
  html += `<div><h2>Tomorrow's Departures (${report.tomorrowDepartures.length})</h2>`;
  html += `<table><thead><tr><th>Guest</th><th>Room</th><th>Status</th></tr></thead><tbody>`;
  if (report.tomorrowDepartures.length === 0) {
    html += `<tr><td colspan="3" style="text-align:center;padding:12px;color:#94a3b8;">None</td></tr>`;
  } else {
    report.tomorrowDepartures.forEach((d) => {
      html += `<tr><td>${esc(d.guestName)}</td><td>${esc(d.roomNumber || "—")}</td><td>${esc(d.status)}</td></tr>`;
    });
  }
  html += `</tbody></table></div>`;
  html += `</div>`;
  
  html += `<div class="footer"><span>Staynexa PMS · Night Audit Report</span><span>${esc(report.hotelName)}</span></div>`;
  html += `</body></html>`;
  
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════

export default function NightAuditPage() {
  const router = useRouter();
  const [businessDate, setBusinessDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [report, setReport] = useState<NightAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [downloadMenu, setDownloadMenu] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const hotelId = getActiveHotelId();
      if (!hotelId) {
        setError("No active hotel selected");
        setLoading(false);
        return;
      }
      const data = await fetchNightAudit(hotelId, businessDate);
      setReport(data);
    } catch (err: any) {
      console.error("[NightAudit]", err);
      setError(err?.message || "Failed to load night audit");
    } finally {
      setLoading(false);
    }
  }, [businessDate]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = (format: "csv" | "excel" | "pdf" | "print") => {
    if (!report) return;
    setDownloadMenu(false);
    try {
      if (format === "csv") {
        downloadNightAuditCSV(report);
        showToast("📥 CSV downloaded");
      } else if (format === "excel") {
        downloadNightAuditExcel(report);
        showToast("📥 Excel downloaded");
      } else if (format === "pdf") {
        downloadNightAuditPDF(report);
        showToast("🖨️ PDF preview opened");
      } else if (format === "print") {
        handlePrint();
      }
    } catch (err) {
      console.error("[Download]", err);
      showToast("⚠ Download failed");
    }
  };

  const handleLockDay = () => {
    if (!confirm(`Lock business date ${businessDate}? This will prevent further changes to today's transactions.`)) {
      return;
    }
    showToast("🔒 Business date locked (demo)");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading Night Audit...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4">⚠️</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Could not load</h2>
          <p className="text-sm text-slate-500 mb-6">{error || "Unknown error"}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={load} className="px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
              Try Again
            </button>
            <Link href="/reports/property" className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold">
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { roomStats, revenue, payments, cashDrawer, transactions } = report;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 print:static">
        <div className="px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-900 transition">
              ← Back
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">🌙 Night Audit Report</h1>
              <p className="text-xs text-slate-500 mt-0.5">{report.hotelName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Business Date</span>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
              />
            </div>

            {/* ═══ DOWNLOAD DROPDOWN ═══ */}
            <div className="relative">
              <button
                onClick={() => setDownloadMenu(!downloadMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
                <svg className={`w-3 h-3 transition-transform ${downloadMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {downloadMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDownloadMenu(false)} />
                  <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl w-[260px] overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3">
                      <p className="text-white text-xs font-bold uppercase tracking-wider">Export Options</p>
                    </div>
                    {[
                      { id: "pdf", label: "PDF Document", desc: "Print-ready report", icon: "📕" },
                      { id: "excel", label: "Excel (.xls)", desc: "Formatted spreadsheet", icon: "📊" },
                      { id: "csv", label: "CSV (.csv)", desc: "Raw data export", icon: "📄" },
                      { id: "print", label: "Print Now", desc: "Direct print", icon: "🖨" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleDownload(opt.id as any)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-0 transition group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 flex items-center justify-center text-base transition">
                          {opt.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                          <p className="text-[10px] text-slate-400">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleLockDay}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition"
            >
              🔒 Lock Day
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 space-y-6">

        {/* Business Date Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl p-6 text-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Date</p>
          <h2 className="text-2xl font-bold mt-1">{fmtDate(report.businessDate)}</h2>
          <p className="text-xs text-slate-400 mt-2">
            Report generated at {new Date(report.generatedAt).toLocaleTimeString("en-IN")}
          </p>
        </div>

        {/* Room Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Occupancy</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">{roomStats.occupancyRate.toFixed(1)}%</p>
            <p className="text-[10px] text-slate-400 mt-1">{roomStats.occupiedRooms} of {roomStats.totalRooms} rooms</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ADR</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{fmtINR(roomStats.adr)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Avg Daily Rate</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RevPAR</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{fmtINR(roomStats.revpar)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Revenue per available</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room Nights</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{roomStats.roomNights}</p>
            <p className="text-[10px] text-slate-400 mt-1">{roomStats.availableRooms} available · {roomStats.outOfOrder} OOO</p>
          </div>
        </div>

        {/* Revenue + Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span>💵</span>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Revenue Breakdown</h3>
            </div>
            <div className="p-5 space-y-3">
              <Row label="Room Revenue" value={fmtINR(revenue.roomRevenue)} />
              <Row label="Room Tax" value={fmtINR(revenue.roomTax)} />
              <Row label="Addon Revenue" value={fmtINR(revenue.addonRevenue)} />
              <Row label="Addon Tax" value={fmtINR(revenue.addonTax)} />
              <div className="border-t border-slate-100 pt-3">
                <Row label="Total Revenue" value={fmtINR(revenue.totalRevenue)} bold />
              </div>
              {revenue.refunds > 0 && <Row label="Refunds" value={`- ${fmtINR(revenue.refunds)}`} red />}
              <div className="border-t border-slate-100 pt-3">
                <Row label="Net Revenue" value={fmtINR(revenue.netRevenue)} bold big highlight />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span>💳</span>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Payment Collection</h3>
            </div>
            <div className="p-5 space-y-3">
              <Row label="Cash" value={fmtINR(payments.cash)} />
              <Row label="UPI" value={fmtINR(payments.upi)} />
              <Row label="Card" value={fmtINR(payments.card)} />
              <Row label="Bank Transfer" value={fmtINR(payments.bankTransfer)} />
              {payments.other > 0 && <Row label="Other" value={fmtINR(payments.other)} />}
              <div className="border-t border-slate-100 pt-3">
                <Row label="Total Collected" value={fmtINR(payments.total)} bold big highlight />
              </div>
              <p className="text-[10px] text-slate-400 text-right pt-1">{payments.count} transactions</p>
            </div>
          </div>
        </div>

        {/* Cash Drawer */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 flex items-center gap-2">
            <span>💰</span>
            <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Cash Drawer Reconciliation</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Opening Balance</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{fmtINR(cashDrawer.openingBalance)}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl">
                <p className="text-[10px] font-bold text-emerald-600 uppercase">Cash Received</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">+ {fmtINR(cashDrawer.cashReceived)}</p>
              </div>
              <div className="p-4 bg-rose-50 rounded-xl">
                <p className="text-[10px] font-bold text-rose-600 uppercase">Refunds / Expenses</p>
                <p className="text-xl font-bold text-rose-700 mt-1">- {fmtINR(cashDrawer.cashRefunds + cashDrawer.expenses)}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl">
                <p className="text-[10px] font-bold text-white/80 uppercase">Expected Closing</p>
                <p className="text-xl font-bold text-white mt-1">{fmtINR(cashDrawer.expectedClosing)}</p>
              </div>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-800">⚠ Please count the cash drawer and enter actual amount</p>
                <p className="text-[10px] text-amber-700 mt-0.5">The difference will be recorded for audit purposes</p>
              </div>
              <button onClick={() => showToast("💰 Reconciliation dialog coming soon")} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600">
                Enter Actual
              </button>
            </div>
          </div>
        </div>

        {/* Operation Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-2xl font-bold text-blue-600">{report.newBookings}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">New Bookings</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-2xl font-bold text-emerald-600">{report.arrivalsCompleted}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Checked-In</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-2xl font-bold text-rose-600">{report.departuresCompleted}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Checked-Out</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-2xl font-bold text-slate-600">{report.cancellations}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Cancellations</p>
          </div>
        </div>

        {/* Transactions Log */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>📋</span>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Transaction Log</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
              {transactions.length} entries
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Time</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Type</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Guest</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Room</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Description</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                      No transactions recorded for this date
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const c = typeColors[t.type] || typeColors.BOOKING;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-xs text-slate-500 font-mono">{t.time}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full uppercase ${c.bg} ${c.text}`}>
                            {c.icon} {c.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-slate-800">{t.guestName}</td>
                        <td className="px-5 py-3 text-sm text-slate-600">{t.roomNumber || "—"}</td>
                        <td className="px-5 py-3 text-xs text-slate-600">{t.description}</td>
                        <td className="px-5 py-3 text-right text-sm font-bold text-slate-800">
                          {t.amount > 0 ? fmtINR(t.amount) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tomorrow Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🛬</span>
                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Tomorrow's Arrivals</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-white text-emerald-700 rounded-full">
                {report.tomorrowArrivals.length}
              </span>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {report.tomorrowArrivals.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No arrivals scheduled</p>
              ) : (
                report.tomorrowArrivals.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.guestName}</p>
                      <p className="text-[10px] text-slate-500">
                        Room {a.roomNumber || "—"} ({a.roomType || "—"}) · {a.adults}A{a.children > 0 ? ` ${a.children}C` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-white text-emerald-700 rounded-full">{a.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🛫</span>
                <h3 className="text-sm font-bold text-rose-800 uppercase tracking-wider">Tomorrow's Departures</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-white text-rose-700 rounded-full">
                {report.tomorrowDepartures.length}
              </span>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {report.tomorrowDepartures.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No departures scheduled</p>
              ) : (
                report.tomorrowDepartures.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-rose-50/50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{d.guestName}</p>
                      <p className="text-[10px] text-slate-500">Room {d.roomNumber || "—"} ({d.roomType || "—"})</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-white text-rose-700 rounded-full">{d.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-900 rounded-2xl p-6 flex items-center justify-between text-white print:bg-white print:text-slate-900">
          <div>
            <p className="text-sm font-bold">End of Night Audit</p>
            <p className="text-xs text-slate-400 mt-1">Report generated by Staynexa PMS · {report.hotelName}</p>
          </div>
          <Link href="/reports/property" className="px-5 py-2 bg-white text-slate-900 rounded-lg text-sm font-bold hover:bg-slate-100 print:hidden">
            All Reports →
          </Link>
        </div>

      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Row Helper
// ═══════════════════════════════════════════════
function Row({
  label,
  value,
  bold,
  red,
  big,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  red?: boolean;
  big?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? "font-semibold text-slate-700" : "text-slate-600"}`}>
        {label}
      </span>
      <span className={`${big ? "text-lg" : "text-sm"} font-bold ${
        red ? "text-rose-600" : highlight ? "text-teal-700" : "text-slate-800"
      }`}>
        {value}
      </span>
    </div>
  );
}