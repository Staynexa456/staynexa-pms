// app/lib/pdf/voucher.ts
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";

export type VoucherData = {
  hotelName: string;
  hotelPhone?: string;
  hotelEmail?: string;
  hotelAddress?: string;
  bookingRef: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  rooms: Array<{
    roomType: string;
    roomNumber: string;
    adults: number;
    children: number;
    price: number;
  }>;
  checkIn: string;
  checkOut: string;
  nights: number;
  subtotal: number;
  taxLines: Array<{ label: string; amount: number }>;
  total: number;
  paymentStatus: "paid" | "partial" | "pending";
  amountPaid: number;
  amountPending: number;
  generatedAt?: string;
};

export async function generateVoucherPDF(data: VoucherData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const colors = {
    primary: rgb(0.06, 0.09, 0.16),
    accent: rgb(0.05, 0.59, 0.53),
    muted: rgb(0.39, 0.45, 0.55),
    light: rgb(0.97, 0.98, 0.99),
    border: rgb(0.89, 0.91, 0.94),
    white: rgb(1, 1, 1),
    green: rgb(0.06, 0.71, 0.40),
    amber: rgb(0.96, 0.62, 0.04),
    lightGreen: rgb(0.94, 0.99, 0.96),
    lightAmber: rgb(1, 0.98, 0.94),
  };

  const marginX = 50;
  const contentWidth = width - marginX * 2;
  let y = height - 60;

  // ═══ HEADER ═══
  page.drawText(data.hotelName.toUpperCase(), {
    x: marginX,
    y,
    size: 22,
    font: bold,
    color: colors.primary,
  });
  y -= 20;

  page.drawText("BOOKING VOUCHER", {
    x: marginX,
    y,
    size: 11,
    font,
    color: colors.muted,
  });
  y -= 20;

  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 2,
    color: colors.accent,
  });
  y -= 30;

  // ═══ BOOKING REFERENCE BOX ═══
  const refBoxHeight = 60;
  page.drawRectangle({
    x: marginX,
    y: y - refBoxHeight,
    width: contentWidth,
    height: refBoxHeight,
    color: colors.light,
    borderColor: colors.border,
    borderWidth: 1,
  });

  page.drawText("BOOKING REFERENCE", {
    x: marginX + 20,
    y: y - 22,
    size: 9,
    font,
    color: colors.muted,
  });

  page.drawText(data.bookingRef, {
    x: marginX + 20,
    y: y - 45,
    size: 18,
    font: bold,
    color: colors.primary,
  });

  const statusLabel =
    data.paymentStatus === "paid"
      ? "PAID IN FULL"
      : data.paymentStatus === "partial"
      ? "PARTIAL PAID"
      : "PAY AT HOTEL";

  const statusColor =
    data.paymentStatus === "paid"
      ? colors.green
      : data.paymentStatus === "partial"
      ? colors.amber
      : colors.muted;

  const statusWidth = bold.widthOfTextAtSize(statusLabel, 9) + 24;
  const statusX = width - marginX - statusWidth - 20;

  page.drawRectangle({
    x: statusX,
    y: y - 45,
    width: statusWidth,
    height: 20,
    color: statusColor,
    borderWidth: 0,
  });

  page.drawText(statusLabel, {
    x: statusX + 12,
    y: y - 38,
    size: 9,
    font: bold,
    color: colors.white,
  });

  y -= refBoxHeight + 30;

  // ═══ GUEST DETAILS ═══
  page.drawText("GUEST DETAILS", {
    x: marginX,
    y,
    size: 11,
    font: bold,
    color: colors.accent,
  });
  y -= 8;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 0.5,
    color: colors.border,
  });
  y -= 22;

  drawKeyValue(page, marginX, y, "Guest Name", data.guestName, font, bold, colors);
  y -= 18;
  drawKeyValue(page, marginX, y, "Phone", data.guestPhone, font, bold, colors);
  y -= 18;
  if (data.guestEmail) {
    drawKeyValue(page, marginX, y, "Email", data.guestEmail, font, bold, colors);
    y -= 18;
  }
  y -= 12;

  // ═══ ROOM DETAILS ═══
  page.drawText("ROOM DETAILS", {
    x: marginX,
    y,
    size: 11,
    font: bold,
    color: colors.accent,
  });
  y -= 8;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 0.5,
    color: colors.border,
  });
  y -= 22;

  data.rooms.forEach((room, idx) => {
    const guestText = `${room.adults} Adult${room.adults > 1 ? "s" : ""}${
      room.children > 0 ? `, ${room.children} Child${room.children > 1 ? "ren" : ""}` : ""
    }`;

    page.drawText(`${idx + 1}. ${room.roomType}`, {
      x: marginX,
      y,
      size: 11,
      font: bold,
      color: colors.primary,
    });
    y -= 15;

    page.drawText(`Room: ${room.roomNumber}`, {
      x: marginX + 15,
      y,
      size: 9,
      font,
      color: colors.muted,
    });
    y -= 13;

    page.drawText(`Guests: ${guestText}`, {
      x: marginX + 15,
      y,
      size: 9,
      font,
      color: colors.muted,
    });

    const priceText = `Rs.${room.price.toLocaleString("en-IN")}`;
    const priceWidth = bold.widthOfTextAtSize(priceText, 11);
    page.drawText(priceText, {
      x: width - marginX - priceWidth,
      y: y + 15,
      size: 11,
      font: bold,
      color: colors.primary,
    });

    y -= 20;
  });
  y -= 6;

  // ═══ STAY DETAILS ═══
  page.drawText("STAY DETAILS", {
    x: marginX,
    y,
    size: 11,
    font: bold,
    color: colors.accent,
  });
  y -= 8;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 0.5,
    color: colors.border,
  });
  y -= 22;

  const colWidth = contentWidth / 3;
  drawColumn(page, marginX, y, "Check-in", data.checkIn, font, bold, colors);
  drawColumn(page, marginX + colWidth, y, "Check-out", data.checkOut, font, bold, colors);
  drawColumn(
    page,
    marginX + colWidth * 2,
    y,
    "Nights",
    `${data.nights} night${data.nights > 1 ? "s" : ""}`,
    font,
    bold,
    colors
  );
  y -= 45;

  // ═══ PAYMENT SUMMARY ═══
  page.drawText("PAYMENT SUMMARY", {
    x: marginX,
    y,
    size: 11,
    font: bold,
    color: colors.accent,
  });
  y -= 8;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 0.5,
    color: colors.border,
  });
  y -= 22;

  drawPaymentRow(page, marginX, y, "Subtotal", data.subtotal, font, bold, colors, false);
  y -= 18;

  data.taxLines.forEach((tax) => {
    drawPaymentRow(page, marginX, y, tax.label, tax.amount, font, bold, colors, false);
    y -= 18;
  });

  page.drawLine({
    start: { x: marginX, y: y + 6 },
    end: { x: width - marginX, y: y + 6 },
    thickness: 0.5,
    color: colors.border,
  });
  y -= 6;

  drawPaymentRow(page, marginX, y, "TOTAL AMOUNT", data.total, font, bold, colors, true);
  y -= 26;

  if (data.paymentStatus === "partial") {
    const boxH = 50;
    page.drawRectangle({
      x: marginX,
      y: y - boxH,
      width: contentWidth,
      height: boxH,
      color: colors.lightAmber,
      borderColor: colors.amber,
      borderWidth: 1,
    });
    page.drawText("PAYMENT BREAKDOWN", {
      x: marginX + 15,
      y: y - 20,
      size: 9,
      font: bold,
      color: colors.primary,
    });
    page.drawText(`Advance Paid: Rs.${data.amountPaid.toLocaleString("en-IN")}`, {
      x: marginX + 15,
      y: y - 35,
      size: 10,
      font,
      color: colors.green,
    });
    page.drawText(
      `Pending at Check-in: Rs.${data.amountPending.toLocaleString("en-IN")}`,
      {
        x: marginX + 15,
        y: y - 48,
        size: 10,
        font,
        color: colors.amber,
      }
    );
    y -= boxH + 15;
  } else if (data.paymentStatus === "pending") {
    const boxH = 40;
    page.drawRectangle({
      x: marginX,
      y: y - boxH,
      width: contentWidth,
      height: boxH,
      color: colors.lightAmber,
      borderColor: colors.amber,
      borderWidth: 1,
    });
    page.drawText(
      `Payment to be made at check-in: Rs.${data.amountPending.toLocaleString("en-IN")}`,
      {
        x: marginX + 15,
        y: y - 25,
        size: 11,
        font: bold,
        color: colors.primary,
      }
    );
    y -= boxH + 15;
  } else {
    const boxH = 40;
    page.drawRectangle({
      x: marginX,
      y: y - boxH,
      width: contentWidth,
      height: boxH,
      color: colors.lightGreen,
      borderColor: colors.green,
      borderWidth: 1,
    });
    page.drawText("Payment completed - No pending amount", {
      x: marginX + 15,
      y: y - 25,
      size: 11,
      font: bold,
      color: colors.green,
    });
    y -= boxH + 15;
  }

  // ═══ FOOTER ═══
  const footerY = 80;

  page.drawLine({
    start: { x: marginX, y: footerY + 30 },
    end: { x: width - marginX, y: footerY + 30 },
    thickness: 0.5,
    color: colors.border,
  });

  const contactParts = [data.hotelPhone, data.hotelEmail].filter(Boolean).join("  |  ");
  if (contactParts) {
    page.drawText(contactParts, {
      x: marginX,
      y: footerY + 15,
      size: 9,
      font,
      color: colors.muted,
    });
  }

  if (data.hotelAddress) {
    page.drawText(data.hotelAddress, {
      x: marginX,
      y: footerY + 2,
      size: 8,
      font,
      color: colors.muted,
    });
  }

  page.drawText("Thank you for choosing us!", {
    x: marginX,
    y: footerY - 20,
    size: 10,
    font: italic,
    color: colors.accent,
  });

  const genText = `Generated: ${data.generatedAt || new Date().toLocaleString("en-IN")}`;
  const genWidth = font.widthOfTextAtSize(genText, 7);
  page.drawText(genText, {
    x: width - marginX - genWidth,
    y: 30,
    size: 7,
    font,
    color: colors.muted,
  });

  return await pdf.save();
}

function drawKeyValue(
  page: PDFPage,
  x: number,
  y: number,
  key: string,
  value: string,
  font: PDFFont,
  bold: PDFFont,
  colors: any
) {
  page.drawText(key, { x, y, size: 9, font, color: colors.muted });
  page.drawText(value, { x: x + 120, y, size: 10, font: bold, color: colors.primary });
}

function drawColumn(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  value: string,
  font: PDFFont,
  bold: PDFFont,
  colors: any
) {
  page.drawText(label, { x, y, size: 8, font, color: colors.muted });
  page.drawText(value, { x, y: y - 18, size: 12, font: bold, color: colors.primary });
}

function drawPaymentRow(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  amount: number,
  font: PDFFont,
  bold: PDFFont,
  colors: any,
  isTotal: boolean
) {
  const labelFont = isTotal ? bold : font;
  const labelSize = isTotal ? 13 : 10;
  const valueSize = isTotal ? 15 : 10;

  page.drawText(label, {
    x,
    y,
    size: labelSize,
    font: labelFont,
    color: isTotal ? colors.primary : colors.muted,
  });

  const valueText = `Rs.${amount.toLocaleString("en-IN")}`;
  const valueFont = bold;
  const valueWidth = valueFont.widthOfTextAtSize(valueText, valueSize);
  page.drawText(valueText, {
    x: page.getWidth() - 50 - valueWidth,
    y,
    size: valueSize,
    font: valueFont,
    color: isTotal ? colors.accent : colors.primary,
  });
}
