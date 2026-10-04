import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type InvoiceItem = {
  description: string;
  quantity?: number;
  amount: number;
};

export type InvoiceData = {
  invoiceNumber: string;
  invoiceDate: string;
  type: "subscription" | "addon";
  hotel: {
    name: string;
    city?: string;
    state?: string;
    address?: string;
    phone?: string;
    email?: string;
    gst_number?: string;
  };
  items: InvoiceItem[];
  taxRate?: number;
  paymentId?: string;
  planName?: string;
  periodStart?: string;
  periodEnd?: string;
};

export function generateInvoicePDF(data: InvoiceData, action: "download" | "print" = "download") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const taxRate = data.taxRate ?? 18;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 90, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Staynexa PMS", 40, 45);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(201, 162, 39);
  doc.text("HOTEL MANAGEMENT PLATFORM", 40, 62);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", pageWidth - 40, 50, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`#${data.invoiceNumber}`, pageWidth - 40, 68, { align: "right" });

  // Bill To
  let y = 120;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", 40, y);
  doc.text("INVOICE DETAILS", pageWidth - 220, y);

  y += 16;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(data.hotel.name || "Hotel", 40, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const hotelAddr = [data.hotel.address, data.hotel.city, data.hotel.state].filter(Boolean).join(", ");
  let addrY = y + 16;
  if (hotelAddr) { doc.text(hotelAddr, 40, addrY); addrY += 14; }
  if (data.hotel.phone) { doc.text(`Phone: ${data.hotel.phone}`, 40, addrY); addrY += 14; }
  if (data.hotel.email) { doc.text(`Email: ${data.hotel.email}`, 40, addrY); addrY += 14; }
  if (data.hotel.gst_number) { doc.text(`GSTIN: ${data.hotel.gst_number}`, 40, addrY); addrY += 14; }

  const infoX = pageWidth - 220;
  let infoY = y + 16;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${data.invoiceDate}`, infoX, infoY); infoY += 14;
  doc.text(`Type: ${data.type === "subscription" ? "Subscription" : "Add-on"}`, infoX, infoY); infoY += 14;
  if (data.planName) { doc.text(`Plan: ${data.planName}`, infoX, infoY); infoY += 14; }
  if (data.paymentId) { doc.text(`Payment: ${data.paymentId}`, infoX, infoY); infoY += 14; }

  y = Math.max(addrY, infoY) + 20;
  if (data.periodStart && data.periodEnd) {
    doc.setFillColor(240, 253, 250);
    doc.rect(40, y, pageWidth - 80, 30, "F");
    doc.setTextColor(13, 148, 136);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Billing Period: ${data.periodStart} -> ${data.periodEnd}`, 52, y + 20); // ✅ ইমোজি বাদ দেওয়া হয়েছে
    y += 45;
  }

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty", "Amount (Rs.)"]], // ✅ ₹ এর বদলে Rs. ব্যবহার করা হয়েছে
    body: data.items.map((item, i) => [
      String(i + 1),
      item.description,
      String(item.quantity || 1),
      `Rs. ${item.amount.toFixed(2)}`, // ✅ Rs. ব্যবহার করা হয়েছে
    ]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 10, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 50, halign: "center" },
      3: { cellWidth: 100, halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  const totalsX = pageWidth - 240;
  let totalY = finalY;

  const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
  const totalWithTax = subtotal;
  const baseAmount = totalWithTax / (1 + taxRate / 100);
  const taxAmount = totalWithTax - baseAmount;
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", totalsX, totalY);
  doc.text(`Rs. ${baseAmount.toFixed(2)}`, pageWidth - 40, totalY, { align: "right" }); // ✅ Rs.
  totalY += 16;

  if (taxAmount > 0) {
    doc.text(`CGST (${(taxRate / 2).toFixed(1)}%)`, totalsX, totalY);
    doc.text(`Rs. ${cgst.toFixed(2)}`, pageWidth - 40, totalY, { align: "right" }); // ✅ Rs.
    totalY += 16;
    doc.text(`SGST (${(taxRate / 2).toFixed(1)}%)`, totalsX, totalY);
    doc.text(`Rs. ${sgst.toFixed(2)}`, pageWidth - 40, totalY, { align: "right" }); // ✅ Rs.
    totalY += 16;
  }

  // Grand Total
  doc.setFillColor(15, 23, 42);
  doc.rect(totalsX - 10, totalY - 8, pageWidth - totalsX - 30, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL PAID", totalsX, totalY + 12);
  doc.text(`Rs. ${totalWithTax.toFixed(2)}`, pageWidth - 40, totalY + 12, { align: "right" }); // ✅ Rs.

  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Thank you for your business! - This is a computer-generated invoice.",
    pageWidth / 2,
    pageHeight - 40,
    { align: "center" }
  );
  doc.text(
    "Staynexa PMS - www.staynexa.in - support@staynexa.in",
    pageWidth / 2,
    pageHeight - 25,
    { align: "center" }
  );

  if (action === "download") {
    doc.save(`Staynexa-Invoice-${data.invoiceNumber}.pdf`);
  } else {
    const pdfUrl = doc.output("bloburl");
    window.open(pdfUrl as any, "_blank");
  }
}

export function formatInvoiceDate(date?: string): string {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}