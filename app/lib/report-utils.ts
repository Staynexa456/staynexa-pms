// app/lib/report-utils.ts

export type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: "currency" | "date" | "status" | "percent" | "number";
  width?: string;
  hideOnMobile?: boolean;
};

export type ReportConfig = {
  slug: string;
  title: string;
  desc: string;
  summaryKeys?: { label: string; key: string; format: "currency" | "number" | "text" }[];
  columns: ReportColumn[];
  dataSource: "bookings" | "payments" | "rooms" | "summary";
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
  html += `th{background:#1e293b;color:#fff;border:1px solid #cbd5e1;padding:8px 12px;text-align:left;font-weight:bold;}`;
  html += `td{border:1px solid #e2e8f0;padding:6px 12px;}`;
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
  html += `body{font-family:'Helvetica Neue',Arial,sans-serif;padding:24px;color:#0f172a;}`;
  html += `.header{border-bottom:3px solid #0f172a;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;}`;
  html += `.header h1{font-size:22px;font-weight:700;letter-spacing:-0.5px;}`;
  html += `.header p{font-size:12px;color:#64748b;margin-top:4px;}`;
  html += `.header .meta{text-align:right;font-size:11px;color:#64748b;}`;
  html += `table{width:100%;border-collapse:collapse;font-size:11px;}`;
  html += `th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;}`;
  html += `th.right,td.right{text-align:right;}`;
  html += `th.center,td.center{text-align:center;}`;
  html += `td{padding:9px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;}`;
  html += `tr:nth-child(even) td{background:#f8fafc;}`;
  html += `.footer{margin-top:24px;padding-top:12px;border-top:1px solid #cbd5e1;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;}`;
  html += `.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(15,23,42,0.04);font-weight:900;pointer-events:none;z-index:-1;letter-spacing:0.1em;}`;
  html += `@media print{body{padding:12px;} table{font-size:10px;} th,td{padding:6px 8px;}}`;
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
  html += `<div class="footer"><span>Staynexa PMS · Reports</span><span>${title}</span></div>`;
  html += `</body></html>`;

  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

export function downloadJSON(rows: any[], filename: string) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  triggerDownload(blob, `${filename}.json`);
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
  "master": {
    slug: "master",
    title: "Master report",
    desc: "All bookings, customer info, payments, taxes",
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
      { key: "roomType", label: "Type", hideOnMobile: true },
      { key: "status", label: "Status", format: "status", align: "center" },
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
    desc: "Occupancy, ADR, RevPAR, taxes",
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
    dataSource: "bookings",
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
    desc: "Room revenue, taxes, payments",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomCharge", label: "Room Revenue", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      { key: "paidAmount", label: "Paid", format: "currency", align: "right" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  "sales": {
    slug: "sales",
    title: "Sales Report",
    desc: "Date-wise performance",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomCharge", label: "Revenue", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
    ],
  },
  "room-inventory": {
    slug: "room-inventory",
    title: "Room Inventory Report",
    desc: "Room inventory metrics",
    dataSource: "rooms",
    columns: [
      { key: "room_number", label: "Room" },
      { key: "room_type", label: "Type" },
      { key: "housekeeping_status", label: "Status", format: "status", align: "center" },
      { key: "last_cleaned_by", label: "Cleaned By" },
      { key: "base_price", label: "Base Rate", format: "currency", align: "right" },
    ],
  },
  "shift": {
    slug: "shift",
    title: "Shift Report",
    desc: "Payment transactions by staff",
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
    dataSource: "rooms",
    columns: [
      { key: "room_type", label: "Room Type" },
      { key: "count", label: "Rooms", align: "center" },
      { key: "base_price", label: "Base Rate (BAR)", format: "currency", align: "right" },
    ],
  },
  "folio": {
    slug: "folio",
    title: "Folio Report",
    desc: "Guest folio balances",
    dataSource: "bookings",
    columns: [
      { key: "booking_ref", label: "Folio #" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Check-In" },
      { key: "checkOut", label: "Check-Out" },
      { key: "status", label: "Status", format: "status", align: "center" },
      { key: "totalAmount", label: "Charges", format: "currency", align: "right" },
      { key: "paidAmount", label: "Payments", format: "currency", align: "right" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  "archived-folio": {
    slug: "archived-folio",
    title: "Archived Folio Report",
    desc: "Historical folios",
    dataSource: "bookings",
    columns: [
      { key: "booking_ref", label: "Folio #" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "checkIn", label: "Check-In" },
      { key: "checkOut", label: "Check-Out" },
      { key: "totalAmount", label: "Total", format: "currency", align: "right" },
    ],
  },
  "room-bookings": {
    slug: "room-bookings",
    title: "Room Bookings Report",
    desc: "Breakdown of room categories",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Booked On" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "roomType", label: "Category" },
      { key: "source", label: "Source" },
      { key: "ratePlan", label: "Rate Plan" },
      { key: "nights", label: "Nights", align: "center" },
      { key: "status", label: "Status", format: "status", align: "center" },
    ],
  },
  "day-use": {
    slug: "day-use",
    title: "Day Use Report",
    desc: "Same-day check-ins/check-outs",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", format: "status", align: "center" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "new-bookings": {
    slug: "new-bookings",
    title: "New Bookings Report",
    desc: "All new reservations",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Booked On" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status", format: "status", align: "center" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "arrivals": {
    slug: "arrivals",
    title: "Arrivals Report",
    desc: "Guest arrivals",
    dataSource: "bookings",
    summaryKeys: [
      { label: "Arrivals", key: "count", format: "number" },
      { label: "Checked-In", key: "checkedIn", format: "number" },
      { label: "Pending", key: "pending", format: "number" },
    ],
    columns: [
      { key: "check_in", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "nights", label: "Nights", align: "center" },
      { key: "status", label: "Status", format: "status", align: "center" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "departures": {
    slug: "departures",
    title: "Departures Report",
    desc: "Guest departures",
    dataSource: "bookings",
    summaryKeys: [
      { label: "Departures", key: "count", format: "number" },
      { label: "Checked-Out", key: "checkedOut", format: "number" },
      { label: "Pending", key: "pending", format: "number" },
    ],
    columns: [
      { key: "checkOut", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "roomNumber", label: "Room" },
      { key: "status", label: "Status", format: "status", align: "center" },
      { key: "balanceDue", label: "Balance", format: "currency", align: "right" },
    ],
  },
  "on-hold": {
    slug: "on-hold",
    title: "On-Hold Report",
    desc: "Bookings on hold",
    dataSource: "bookings",
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
    title: "No Show Report",
    desc: "No-show bookings",
    dataSource: "bookings",
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
    desc: "Upgrades via Magic Link",
    dataSource: "bookings",
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
    desc: "Early check-ins",
    dataSource: "bookings",
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
    desc: "Late check-outs",
    dataSource: "bookings",
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
    desc: "All booking notes",
    dataSource: "bookings",
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
    desc: "All customer notes",
    dataSource: "bookings",
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
    dataSource: "summary",
    columns: [
      { key: "ratePlan", label: "Rate Plan" },
      { key: "count", label: "Bookings", align: "center" },
      { key: "revenue", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "gateway": {
    slug: "gateway",
    title: "Payment Gateway Report",
    desc: "Payments via gateways",
    dataSource: "payments",
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
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "reference", label: "Reference" },
    ],
  },
  "refunds": {
    slug: "refunds",
    title: "Refunds Report",
    desc: "Payment refunds",
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
      { key: "note", label: "Note" },
    ],
  },
  "transfers": {
    slug: "transfers",
    title: "Transfers Report",
    desc: "Payment settlements",
    dataSource: "payments",
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
    dataSource: "payments",
    columns: [
      { key: "created_at", label: "Date" },
      { key: "method", label: "Type" },
      { key: "amount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "counter-type": {
    slug: "counter-type",
    title: "Counter by Payment Type",
    desc: "Cash, offline card",
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
    desc: "OTA payments",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "source", label: "OTA" },
      { key: "totalAmount", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "service-revenue": {
    slug: "service-revenue",
    title: "Service Revenue Report",
    desc: "Addons serviced",
    dataSource: "summary",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "addonCount", label: "Addons", align: "center" },
      { key: "addonTotal", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "service-sales": {
    slug: "service-sales",
    title: "Service Sales Report",
    desc: "Date-wise sales",
    dataSource: "summary",
    columns: [
      { key: "checkIn", label: "Date" },
      { key: "guestName", label: "Guest" },
      { key: "roomNumber", label: "Room" },
      { key: "addonCount", label: "Addons", align: "center" },
      { key: "addonTotal", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "gst-summary": {
    slug: "gst-summary",
    title: "GST Summary Report",
    desc: "Complete GST breakdown",
    dataSource: "bookings",
    summaryKeys: [
      { label: "Invoices", key: "count", format: "number" },
      { label: "Taxable", key: "revenue", format: "currency" },
      { label: "CGST", key: "cgst", format: "currency" },
      { label: "SGST", key: "sgst", format: "currency" },
      { label: "Total Tax", key: "tax", format: "currency" },
    ],
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Invoice #" },
      { key: "guestName", label: "Guest" },
      { key: "guestGst", label: "GSTIN" },
      { key: "roomCharge", label: "Taxable", format: "currency", align: "right" },
      { key: "cgst", label: "CGST 2.5%", format: "currency", align: "right" },
      { key: "sgst", label: "SGST 2.5%", format: "currency", align: "right" },
      { key: "taxAmount", label: "Total Tax", format: "currency", align: "right" },
    ],
  },
  "gst-monthly": {
    slug: "gst-monthly",
    title: "Monthly GST Report",
    desc: "Month-wise GST",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Invoice #" },
      { key: "guestName", label: "Guest" },
      { key: "guestGst", label: "GSTIN" },
      { key: "roomCharge", label: "Taxable", format: "currency", align: "right" },
      { key: "cgst", label: "CGST", format: "currency", align: "right" },
      { key: "sgst", label: "SGST", format: "currency", align: "right" },
      { key: "taxAmount", label: "Total Tax", format: "currency", align: "right" },
    ],
  },
  "room-taxes": {
    slug: "room-taxes",
    title: "Room Taxes Report",
    desc: "Booking-wise taxes",
    dataSource: "bookings",
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
  "gst": {
    slug: "gst",
    title: "GST Report",
    desc: "Complete GST",
    dataSource: "bookings",
    columns: [
      { key: "check_in", label: "Date" },
      { key: "booking_ref", label: "Invoice" },
      { key: "guestName", label: "Guest" },
      { key: "guestGst", label: "GSTIN" },
      { key: "roomCharge", label: "Taxable", format: "currency", align: "right" },
      { key: "taxAmount", label: "GST", format: "currency", align: "right" },
    ],
  },
  "b2b-b2c": {
    slug: "b2b-b2c",
    title: "B2B vs B2C Report",
    desc: "Corporate vs retail",
    dataSource: "bookings",
    columns: [
      { key: "type", label: "Type", align: "center" },
      { key: "booking_ref", label: "Ref" },
      { key: "guestName", label: "Guest" },
      { key: "guestGst", label: "GSTIN" },
      { key: "roomCharge", label: "Amount", format: "currency", align: "right" },
      { key: "taxAmount", label: "Tax", format: "currency", align: "right" },
    ],
  },
  "guest-list": {
    slug: "guest-list",
    title: "Guest List Report",
    desc: "Complete guest directory",
    dataSource: "summary",
    columns: [
      { key: "guestName", label: "Guest Name" },
      { key: "guestPhone", label: "Phone" },
      { key: "guestEmail", label: "Email" },
      { key: "guestCountry", label: "Country" },
      { key: "guestGst", label: "GSTIN" },
    ],
  },
  "top-spenders": {
    slug: "top-spenders",
    title: "Top Spenders Report",
    desc: "Highest revenue guests",
    dataSource: "summary",
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "bookings", label: "Bookings", align: "center" },
      { key: "totalSpent", label: "Total Spent", format: "currency", align: "right" },
    ],
  },
  "guest-origins": {
    slug: "guest-origins",
    title: "Guest Origins Report",
    desc: "Country-wise breakdown",
    dataSource: "summary",
    columns: [
      { key: "guestCountry", label: "Country" },
      { key: "bookings", label: "Bookings", align: "center" },
      { key: "revenue", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "repeat-guests": {
    slug: "repeat-guests",
    title: "Repeat Guests Report",
    desc: "Guests with multiple stays",
    dataSource: "summary",
    columns: [
      { key: "guestName", label: "Guest" },
      { key: "guestPhone", label: "Phone" },
      { key: "bookings", label: "Stays", align: "center" },
    ],
  },
  "shopwise-revenue": {
    slug: "shopwise-revenue",
    title: "Shopwise Revenue Report",
    desc: "Revenue by outlet",
    dataSource: "summary",
    columns: [
      { key: "shopName", label: "Outlet" },
      { key: "orders", label: "Orders", align: "center" },
      { key: "revenue", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "alloutlets-daysales": {
    slug: "alloutlets-daysales",
    title: "All Outlets Day-wise Sales",
    desc: "Consolidated daily sales",
    dataSource: "summary",
    columns: [
      { key: "date", label: "Date" },
      { key: "orders", label: "Orders", align: "center" },
      { key: "revenue", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "alloutlets-hourly": {
    slug: "alloutlets-hourly",
    title: "All Outlets Hourly Items Sales",
    desc: "Hourly sales variation",
    dataSource: "summary",
    columns: [
      { key: "hour", label: "Hour" },
      { key: "items", label: "Items Sold", align: "center" },
      { key: "revenue", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "alloutlets-category": {
    slug: "alloutlets-category",
    title: "All Outlets Itemwise Category",
    desc: "Category summary",
    dataSource: "summary",
    columns: [
      { key: "category", label: "Category" },
      { key: "items", label: "Items", align: "center" },
      { key: "revenue", label: "Revenue", format: "currency", align: "right" },
    ],
  },
  "alloutlets-orders": {
    slug: "alloutlets-orders",
    title: "All Outlets Order-wise Sales",
    desc: "Order-wise sales",
    dataSource: "summary",
    columns: [
      { key: "orderId", label: "Order ID" },
      { key: "outlet", label: "Outlet" },
      { key: "revenue", label: "Amount", format: "currency", align: "right" },
    ],
  },
  "user-log": {
    slug: "user-log",
    title: "User Log Report",
    desc: "User activity logs",
    dataSource: "summary",
    columns: [
      { key: "timestamp", label: "Time" },
      { key: "user", label: "User" },
      { key: "operation", label: "Operation" },
      { key: "detail", label: "Details" },
    ],
  },
  "activity-log": {
    slug: "activity-log",
    title: "Activity Log",
    desc: "All user actions",
    dataSource: "summary",
    columns: [
      { key: "timestamp", label: "Time" },
      { key: "user", label: "User" },
      { key: "operation", label: "Operation" },
      { key: "detail", label: "Detail" },
    ],
  },
  "audit-trail": {
    slug: "audit-trail",
    title: "Audit Trail",
    desc: "All changes",
    dataSource: "summary",
    columns: [
      { key: "timestamp", label: "Time" },
      { key: "user", label: "User" },
      { key: "operation", label: "Operation" },
      { key: "detail", label: "Details" },
    ],
  },
};