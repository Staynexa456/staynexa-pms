// app/api/payments/create-order/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createRazorpayOrder,
  createCashfreeOrder,
  calculatePaymentAmount,
  type PaymentConfig,
} from "@/app/lib/payment-gateway";

export async function POST(req: Request) {
  try {
    const {
      hotelId,
      amount,
      bookingRef,
      customerName,
      customerPhone,
      customerEmail,
    } = await req.json();

    if (!hotelId || !amount || !bookingRef) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Hotel payment settings fetch
    const { data: settings, error } = await supabase
      .from("booking_engine_settings")
      .select(
        "payment_gateway, payment_enabled, payment_amount_type, advance_percentage, razorpay_key_id, razorpay_key_secret, cashfree_app_id, cashfree_secret_key, upi_id, upi_qr_url, hero_title"
      )
      .eq("hotel_id", hotelId)
      .single();

    if (error || !settings) {
      return NextResponse.json(
        { error: "Payment settings not found" },
        { status: 404 }
      );
    }

    if (!settings.payment_enabled || settings.payment_gateway === "none") {
      return NextResponse.json(
        { error: "Online payment is not enabled for this hotel" },
        { status: 400 }
      );
    }

    const config = settings as PaymentConfig;
    const paymentAmount = calculatePaymentAmount(amount, config);

    // ═══════════════════════════════════════════════
    // 🆕 UPI QR FLOW (No external API — just show QR)
    // ═══════════════════════════════════════════════
    if (settings.payment_gateway === "upi_qr") {
      if (!settings.upi_id) {
        return NextResponse.json(
          { error: "UPI ID not configured by hotel" },
          { status: 400 }
        );
      }

      // Generate UPI deep link
      const upiDeepLink = `upi://pay?pa=${encodeURIComponent(
        settings.upi_id
      )}&pn=${encodeURIComponent(
        settings.hero_title || "Hotel"
      )}&am=${paymentAmount}&cu=INR&tn=${encodeURIComponent(
        `Booking ${bookingRef}`
      )}`;

      // Generate QR code image URL (using free QR service)
      const qrCodeUrl =
        settings.upi_qr_url ||
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          upiDeepLink
        )}`;

      // Log transaction
      await supabase.from("payment_transactions").insert({
        hotel_id: hotelId,
        gateway: "upi_qr",
        gateway_order_id: `upi_${bookingRef}_${Date.now()}`,
        amount: paymentAmount,
        status: "created",
      });

      return NextResponse.json({
        success: true,
        gateway: "upi_qr",
        orderId: `upi_${bookingRef}_${Date.now()}`,
        qrCodeUrl: qrCodeUrl,
        upiId: settings.upi_id,
        amount: paymentAmount,
        deepLink: upiDeepLink,
      });
    }

    // ═══════════════════════════════════════════════
    // RAZORPAY / CASHFREE FLOW
    // ═══════════════════════════════════════════════
    const input = {
      amount: paymentAmount,
      currency: "INR",
      receipt: bookingRef,
      customerName,
      customerPhone,
      customerEmail,
      returnUrl: `https://book.staynexa.in/payment-status`,
      notes: {
        bookingRef,
        hotelId,
        purpose: "Hotel Booking",
      },
    };

    let result;

    if (settings.payment_gateway === "razorpay") {
      result = await createRazorpayOrder(config, input);
    } else if (settings.payment_gateway === "cashfree") {
      result = await createCashfreeOrder(config, input);
    } else {
      return NextResponse.json(
        { error: "Unsupported payment gateway" },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Payment order failed" },
        { status: 500 }
      );
    }

    await supabase.from("payment_transactions").insert({
      hotel_id: hotelId,
      gateway: settings.payment_gateway,
      gateway_order_id: result.orderId,
      amount: paymentAmount,
      status: "created",
    });

    return NextResponse.json({
      success: true,
      gateway: result.gateway,
      orderId: result.orderId,
      publicKey: result.publicKey,
      paymentLink: result.paymentLink,
      amount: paymentAmount,
    });
  } catch (error: any) {
    console.error("[Create Order API]", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
