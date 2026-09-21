// app/lib/report-utils.ts

export type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: "currency" | "number" | "date" | "status" | "percent";
  width?: string;
  hideOnMobile?: boolean;
};

export type ReportConfig = {
  slug: string;
  title: string;
  desc: string;
  icon?: string;
  summaryKeys?: { label: string; key: string; format: "currency" | "number" | "text" }[];
  columns: ReportColumn[];
  dataSource: "bookings" | "payments" | "rooms" | "bookings-with-addons" | "bookings-with-notes";
  filter?: (b: any) => boolean;
};

// ═══════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════

export function downloadCSV(rows: any[], columns: ReportColumn[], filename: string) {
  const headers = columns.map(c => c.label);
  const csvRows = rows.map(r => columns.map(c => {
    const v = r[c.key];
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  }));
  const csv = [
    headers.join(","),
    ...csvRows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

export function downloadExcel(rows: any[], columns: ReportColumn[], filename: string, title?: string) {
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
  html += `<head><meta charset="UTF-8"><style>`;
  html += `table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt;}`;
  html += `th{background:#0f172a;color:#fff;border:1px solid #cbd5e1;padding:10px 14px;text-align:left;font-weight:bold;}`;
  html += `td{border:1px solid #e2e8f0;padding:8px 14px;}`;
  html += `td.num{text-align:right;}`;
  html += `td.center{text-align:center;}`;
  html += `tr:nth-child(even) td{background:#f8fafc;}`;
  html += `h2{font-family:Calibri,Arial,sans-serif;margin:0 0 8px;}`;
  html += `</style></head><body>`;
  if (title) html += `<h2>${title}</h2>`;
  html += `<table><thead><tr>`;
  columns.forEach(c => { html += `<th>${c.label}</th>`; });
  html += `</tr></thead><tbody>`;
  rows.forEach(r => {
    html += `<tr>`;
    columns.forEach(c => {
      let v = r[c.key];
      let cls = c.align === "right" ? "num" : c.align === "center" ? "center" : "";
      if (v === null || v === undefined) v = "";
      if (typeof v === "object") v = JSON.stringify(v);
      html += `<td class="${cls}">${String(v).replace(/</g, "&lt;")}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  triggerDownload(blob, `${filename}.xls`);
}

export function downloadPDF(rows: any[], columns: ReportColumn[], filename: string, title: string, subtitle?: string) {
  const w = window.open("", "_blank", "width=1200,height=900");
  if (!w) { alert("Please allow pop-ups"); return; }

  let html = `<!DOCTYPE html><html><head><title>${title}</title><style>`;
  html += `*{box-sizing:border-box;margin:0;padding:0;}`;
  html += `body{font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;color:#0f172a;}`;
  html += `.header{border-bottom:3px solid #0f172a;padding-bottom:20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;}`;
  html += `.header h1{font-size:24px;font-weight:700;letter-spacing:-0.5px;}`;
  html += `.header p{font-size:13px;color:#64748b;margin-top:4px;}`;
  html += `.header .meta{text-align:right;font-size:12px;color:#64748b;}`;
  html += `table{width:100%;border-collapse:collapse;font-size:11px;}`;
  html += `th{background:#0f172a;color:#fff;padding:12px 10px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;}`;
  html += `th.right,td.right{text-align:right;}`;
  html += `th.center,td.center{text-align:center;}`;
  html += `td{padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top;}`;
  html += `tr:nth-child(even) td{background:#f8fafc;}`;
  html += `.footer{margin-top:32px;padding-top:16px;border-top:1px solid #cbd5e1;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;}`;
  html += `.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:100px;color:rgba(15,23,42,0.03);font-weight:900;pointer-events:none;z-index:-1;letter-spacing:0.1em;}`;
  html += `@media print{body{padding:16px;} table{font-size:10px;} th,td{padding:8px;}}`;
  html += `</style></head><body>`;
  html += `<div class="watermark">STAYNEXA</div>`;
  html += `<div class="header">`;
  html += `<div><h1>${title}</h1><p>${subtitle || ""}</p></div>`;
  html += `<div class="meta"><div>Generated: ${new Date().toLocaleString("en-IN")}</div><div>Total Records: ${rows.length}</div></div>`;
  html += `</div>`;
  html += `<table><thead><tr>`;
  columns.forEach(c => {
    const cls = c.align === "right" ? "right" : c.align === "center" ? "center" : "";
    html += `<th class="${cls}">${c.label}</th>`;
  });
  html += `</tr></thead><tbody>`;
  rows.forEach(r => {
    html += `<tr>`;
    columns.forEach(c => {
      let v = r[c.key];
      const cls = c.align === "right" ? "right" : c.align === "center" ? "center" : "";
      if (v === null || v === undefined) v = "—";
      else if (typeof v === "object") v = JSON.stringify(v);
      else if (c.format === "currency" && typeof v === "number") v = "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
      else if (c.format === "number" && typeof v === "number") v = v.toLocaleString("en-IN");
      else if (c.format === "percent" && typeof v === "number") v = v.toFixed(2) + "%";
      html += `<td class="${cls}">${String(v).replace(/</g, "&lt;")}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  html += `<div class="footer"><span>Staynexa PMS · Reports Module</span><span>${title}</span></div>`;
  html += `</body></html>`;

  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

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

// ═══════════════════════════════════════════════
// REPORT CONFIGURATIONS
// ═══════════════════════════════════════════════
export const REPORT_CONFIGS: Record<string, ReportConfig> = {
  // ─── PROPERTY ───
  master: {
    slug: "master",
    title: "Master Report",
    desc: "Complete bookings, customers, payments & taxes",
    icon: "📊",
    dataSource: "bookings",
    summaryKeys: [
      { label: "Total Bookings", key: "count", format: "number" },
      { label: "Room Revenue", key: "revenue", format: "currency" },
      { label: "Tax", key: "tax", format: "currency" },
      { label: "Collected", key: "paid", format: "currency" },
      { label: "Pending", key: "due", format: "currency" },
    ],
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone", hideOnMobile: true },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "roomCharge", label: "Room", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "paidAmount", label: "Paid", format: "currency", align: "right" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  "flash-manager": {
    slug: "flash-manager",
    title: "Flash Manager Report",
    desc: "Occupancy, ADR, RevPAR & revenue metrics",
    icon: "⚡",
    dataSource: "bookings",
    summaryKeys: [
      { label: "Bookings", key: "count", format: "number" },
      { label: "Nights Sold", key: "nights", format: "number" },
      { label: "ADR", key: "adr", format: "currency" },
      { label: "Revenue", key: "revenue", format: "currency" },
    ],
    columns: [
      { key: "check_in", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "nights", label: "Nights", align: "center" },
      { key: "adr", label: "ADR", format: "currency", align: "right" },
      { key: "roomCharge", label: "Revenue", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
    ],
  },
  "guest-ledger": {
    slug: "guest-ledger",
    title: "Guest Ledger Report",
    desc: "Outstanding balance owed by in-house guests",
    icon: "📒",
    dataSource: "bookings",
    filter: (b) => b.status === "CHECKED-IN" || b.balanceDue > 0,
    summaryKeys: [
      { label: "In-House", key: "count", format: "number" },
      { label: "Outstanding", key: "due", format: "currency" },
    ],
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Check-In" },
      { key: "checkOut", label: "Check-Out" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "paidAmount", label: "Paid", format: "currency", align: "right" },
      { key: "balanceDue", label: "Outstanding", format: "currency", align: "right" },
    ],
  },
  "room-revenue": {
    slug: "room-revenue",
    title: "Room Revenue Report",
    desc: "Detailed room revenue & taxes",
    icon: "💰",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "BLOCKED",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomCharge", label: "Room Revenue", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  sales: {
    slug: "sales",
    title: "Sales Report",
    desc: "Date-wise performance report",
    icon: "📈",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "BLOCKED",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomCharge", label: "Revenue", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "paidAmount", label: "Paid", format: "currency", align: "right" },
    ],
  },
  "room-inventory": {
    slug: "room-inventory",
    title: "Room Inventory Report",
    desc: "Live room inventory & status",
    icon: "🏨",
    dataSource: "rooms",
    columns: [
      { key: "room_number", label: "Room" },
      { key: "room_type", label: "Type" },
      { key: "housekeeping_status", label: "Status", align: "center", format: "status" },
      { key: "last_cleaned_by", label: "Cleaned By" },
      { key: "base_price", label: "Base Rate", format: "currency", align: "right" },
    ],
  },
  shift: {
    slug: "shift",
    title: "Shift Report",
    desc: "Payment transactions by staff",
    icon: "⏰",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date & Time" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
      { key: "note", label: "Note" },
    ],
  },
  "bar-pricing": {
    slug: "bar-pricing",
    title: "BAR Pricing Report",
    desc: "Best Available Rate per room type",
    icon: "🏷️",
    dataSource: "rooms",
    columns: [
      { key: "room_number", label: "Room" },
      { key: "room_type", label: "Type" },
      { key: "base_price", label: "Base Rate", format: "currency", align: "right" },
    ],
  },
  folio: {
    slug: "folio",
    title: "Folio Report",
    desc: "Guest folio balances & payments",
    icon: "📄",
    dataSource: "bookings",
    columns: [
      { key: "booking_ref", label: "Folio #" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Check-In" },
      { key: "checkOut", label: "Check-Out" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "totalAmount", label: "Charges", format: "currency", align: "right" },
      { key: "paidAmount", label: "Payments", format: "currency", align: "right" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  "archived-folio": {
    slug: "archived-folio",
    title: "Archived Folio Report",
    desc: "Historical completed folios",
    icon: "🗄️",
    dataSource: "bookings",
    filter: (b) => b.status === "CHECKED-OUT",
    columns: [
      { key: "booking_ref", label: "Folio #" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Check-In" },
      { key: "checkOut", label: "Check-Out" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "paidAmount", label: "Paid", format: "currency", align: "right" },
    ],
  },
  // ─── FRONT DESK ───
  "room-bookings": {
    slug: "room-bookings",
    title: "Room Bookings Report",
    desc: "Breakdown by room categories",
    icon: "🛏️",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Booked On" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomType", label: "Category" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status", align: "center", format: "status" },
    ],
  },
  "day-use": {
    slug: "day-use",
    title: "Day Use Report",
    desc: "Same-day check-ins & check-outs",
    icon: "☀️",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "new-bookings": {
    slug: "new-bookings",
    title: "New Bookings Report",
    desc: "All new reservations",
    icon: "🆕",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Booked On" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status", align: "center", format: "status" },
    ],
  },
  arrivals: {
    slug: "arrivals",
    title: "Arrivals Report",
    desc: "Guest arrivals overview",
    icon: "🛬",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "NO-SHOW",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  departures: {
    slug: "departures",
    title: "Departures Report",
    desc: "Guest departures overview",
    icon: "🛫",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED",
    columns: [
      { key: "checkOut", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", align: "center", format: "status" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  "on-hold": {
    slug: "on-hold",
    title: "On-Hold Report",
    desc: "Bookings currently on hold",
    icon: "⏸️",
    dataSource: "bookings",
    filter: (b) => b.status === "ON-HOLD",
    columns: [
      { key: "checkIn", label: "Stay From" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "no-show": {
    slug: "no-show",
    title: "No-Show Report",
    desc: "Guests who didn't arrive",
    icon: "🚫",
    dataSource: "bookings",
    filter: (b) => b.is_no_show === true || b.status === "NO-SHOW",
    columns: [
      { key: "checkIn", label: "Expected" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "room-upgrade": {
    slug: "room-upgrade",
    title: "Room Upgrade Report",
    desc: "Room upgrades via magic link",
    icon: "⬆️",
    dataSource: "bookings-with-notes",
    filter: (b) => (b.notes || "").toLowerCase().includes("upgrade"),
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "notes", label: "Notes" },
    ],
  },
  "early-checkin": {
    slug: "early-checkin",
    title: "Early Check-In Report",
    desc: "Early check-ins via magic link",
    icon: "⏱️",
    dataSource: "bookings-with-notes",
    filter: (b) => (b.notes || "").toLowerCase().includes("early"),
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "notes", label: "Notes" },
    ],
  },
  "late-checkout": {
    slug: "late-checkout",
    title: "Late Check-Out Report",
    desc: "Late check-outs via magic link",
    icon: "⏰",
    dataSource: "bookings-with-notes",
    filter: (b) => (b.notes || "").toLowerCase().includes("late"),
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "notes", label: "Notes" },
    ],
  },
  "booking-notes": {
    slug: "booking-notes",
    title: "Booking Notes Report",
    desc: "Notes across all bookings",
    icon: "📝",
    dataSource: "bookings-with-notes",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "notes", label: "Notes" },
    ],
  },
  "customer-notes": {
    slug: "customer-notes",
    title: "Customer Notes Report",
    desc: "Customer notes across bookings",
    icon: "💬",
    dataSource: "bookings-with-notes",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "notes", label: "Notes" },
    ],
  },
  "rate-plan-count": {
    slug: "rate-plan-count",
    title: "Rate Plan Count Report",
    desc: "Rate plan distribution",
    icon: "📊",
    dataSource: "bookings",
    columns: [
      { key: "ratePlan", label: "Rate Plan" },
      { key: "bookings", label: "Bookings", align: "center" },
      { key: "totalAmount", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  // ─── PAYMENT ───
  gateway: {
    slug: "gateway",
    title: "Payment Gateway Report",
    desc: "Card, UPI & Bank Transfer payments",
    icon: "💳",
    dataSource: "payments",
    filter: (p) => ["Card", "UPI", "Bank Transfer"].includes(p.method),
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
      { key: "note", label: "Note" },
    ],
  },
  "cash-counter": {
    slug: "cash-counter",
    title: "Cash & Counter Report",
    desc: "Cash & offline payments",
    icon: "💵",
    dataSource: "payments",
    filter: (p) => p.method === "Cash" || p.method === "UPI",
    columns: [
      { key: "created_at", label: "Service Date" },
      { key: "bookingId", label: "Booking ID" },
      { key: "roomNumber", label: "Room no(s)" },
      { key: "paymentType", label: "Payment Type" },
      { key: "amount", label: "Amount (INR)", format: "currency", align: "right" },
      { key: "refund", label: "Refund (INR)", format: "currency", align: "right" },
      { key: "netAmount", label: "Net Amount (INR)", format: "currency", align: "right" },
      { key: "guestName", label: "Customer Name" },
      { key: "description", label: "Service Amount Description" },
      { key: "reference", label: "CTA Settlement Remarks" },
    ],
  },
  refunds: {
    slug: "refunds",
    title: "Refunds Report",
    desc: "Payment refunds",
    icon: "↩️",
    dataSource: "payments",
    filter: (p) => (p.note || "").toLowerCase().includes("refund"),
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "note", label: "Note" },
    ],
  },
  transfers: {
    slug: "transfers",
    title: "Transfers Report",
    desc: "Payment settlements",
    icon: "🔄",
    dataSource: "payments",
    filter: (p) => (p.note || "").toLowerCase().includes("transfer"),
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
    ],
  },
  "by-type": {
    slug: "by-type",
    title: "Payments by Type",
    desc: "Visa, Mastercard, UPI",
    icon: "🏦",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Type" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
    ],
  },
  "counter-type": {
    slug: "counter-type",
    title: "Counter by Payment Type",
    desc: "Cash, offline card payments",
    icon: "🏪",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Type" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "ota-payment": {
    slug: "ota-payment",
    title: "OTA Payment Report",
    desc: "Pre-paid OTA bookings",
    icon: "🌐",
    dataSource: "bookings",
    filter: (b) => b.source && ["ota", "booking", "agoda", "makemytrip", "goibibo"].some((s) => String(b.source).toLowerCase().includes(s)),
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "source", label: "OTA" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  // ─── SERVICE ───
  "service-revenue": {
    slug: "service-revenue",
    title: "Service Revenue Report",
    desc: "Addon & service revenue",
    icon: "🛎️",
    dataSource: "bookings-with-addons",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "addonList", label: "Addons" },
      { key: "addonTotal", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "service-sales": {
    slug: "service-sales",
    title: "Service Sales Report",
    desc: "Date-wise service sales",
    icon: "🧾",
    dataSource: "bookings-with-addons",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "addonList", label: "Addons" },
      { key: "addonTotal", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  // ─── TAX ───
  "room-taxes": {
    slug: "room-taxes",
    title: "Room Taxes Report",
    desc: "Booking-wise tax breakdown",
    icon: "🏛️",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "BLOCKED",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomCharge", label: "Base", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
    ],
  },
  gst: {
    slug: "gst",
    title: "GST Report",
    desc: "Complete GST breakdown for filing",
    icon: "🧾",
    dataSource: "bookings",
    filter: (b) => b.status !== "CANCELLED" && b.status !== "BLOCKED",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Invoice" },
      { key: "guestName", label: "Guest" },
      { key: "guestGst", label: "GSTIN" },
      { key: "roomCharge", label: "Taxable", format: "currency", align: "right" },
      { key: "taxAmount", label: "GST", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
    ],
  },
  // ─── CUSTOMERS ───
  "guest-list": {
    slug: "guest-list",
    title: "Guest List Report",
    desc: "Unique guests with contact details",
    icon: "👥",
    dataSource: "bookings",
    columns: [
      { key: "guestName", label: "Guest Name" },
      { key: "guestPhone", label: "Phone" },
      { key: "guestEmail", label: "Email" },
      { key: "guestCountry", label: "Country" },
      { key: "bookingsCount", label: "Bookings", align: "center" },
    ],
  },
  "top-spenders": {
    slug: "top-spenders",
    title: "Top Spenders Report",
    desc: "Highest revenue guests",
    icon: "🏆",
    dataSource: "bookings",
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "guestCountry", label: "Country" },
      { key: "bookings", label: "Bookings", align: "center" },
      { key: "totalAmount", label: "Total Spent", format: "currency", align: "right" },
    ],
  },
  "guest-origins": {
    slug: "guest-origins",
    title: "Guest Origins Report",
    desc: "Country-wise guest breakdown",
    icon: "🌍",
    dataSource: "bookings",
    columns: [
      { key: "guestCountry", label: "Country" },
      { key: "bookings", label: "Bookings", align: "center" },
      { key: "totalAmount", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "repeat-guests": {
    slug: "repeat-guests",
    title: "Repeat Guests Report",
    desc: "Guests with multiple stays",
    icon: "🔁",
    dataSource: "bookings",
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Last Room" },
      { key: "checkIn", label: "Last Stay" },
      { key: "bookings", label: "Total Stays", align: "center" },
    ],
  },
  // ─── POS ───
  "shopwise-revenue": {
    slug: "shopwise-revenue",
    title: "Shopwise Revenue Report",
    desc: "Revenue by outlet",
    icon: "🏬",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Revenue", format: "currency", align: "right" },
      { key: "note", label: "Outlet" },
    ],
  },
  "alloutlets-daysales": {
    slug: "alloutlets-daysales",
    title: "All Outlets Day-wise Sales",
    desc: "Consolidated daily sales",
    icon: "📅",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "alloutlets-hourly": {
    slug: "alloutlets-hourly",
    title: "All Outlets Hourly Sales",
    desc: "Hourly sales variation",
    icon: "⏰",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date & Time" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "alloutlets-category": {
    slug: "alloutlets-category",
    title: "All Outlets Category Summary",
    desc: "Category-wise sales",
    icon: "📁",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "alloutlets-orders": {
    slug: "alloutlets-orders",
    title: "All Outlets Order-wise Sales",
    desc: "Order-wise sales summary",
    icon: "📋",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Order Ref" },
    ],
  },
  // ─── LOG ───
  "user-log": {
    slug: "user-log",
    title: "User Log Report",
    desc: "User activity logs",
    icon: "📜",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date & Time" },
      { key: "method", label: "Operation" },
      { key: "reference", label: "Reference" },
      { key: "note", label: "Detail" },
    ],
  },
};