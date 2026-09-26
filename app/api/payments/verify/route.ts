  // app/api/payments/verify/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  verifyRazorpaySignature,
  getCashfreeOrderStatus,
  type PaymentConfig,
} from "@/app/lib/payment-gateway";

export async function POST(req: Request) {
  try {
    const {
      hotelId,
      gateway,
      orderId,
      paymentId,
      signature,
      bookingId,
      bookingRef,
      roomNumber,
      manual,
    } = await req.json();

    if (!hotelId || !gateway || !orderId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch hotel payment settings
    const { data: settings } = await supabase
      .from("booking_engine_settings")
      .select(
        "payment_gateway, razorpay_key_secret, cashfree_app_id, cashfree_secret_key"
      )
      .eq("hotel_id", hotelId)
      .single();

    if (!settings) {
      return NextResponse.json(
        { error: "Payment settings not found" },
        { status: 404 }
      );
    }

    const config = settings as PaymentConfig;
    let verified = false;
    let finalStatus = "failed";

    // ═══════════════════════════════════════════════
    // UPI QR — Manual Verification (Hotel will verify)
    // ═══════════════════════════════════════════════
    if (gateway === "upi_qr") {
      // UPI QR is manually verified by hotel — mark as pending/paid
      verified = true;
      finalStatus = manual ? "paid" : "pending_verification";
    }

    // ═══════════════════════════════════════════════
    // RAZORPAY — Signature Verification
    // ═══════════════════════════════════════════════
    else if (gateway === "razorpay") {
      if (!paymentId || !signature) {
        return NextResponse.json(
          { error: "Missing payment ID or signature" },
          { status: 400 }
        );
      }
      verified = verifyRazorpaySignature(
        orderId,
        paymentId,
        signature,
        config.razorpay_key_secret!
      );
      if (verified) finalStatus = "paid";
    }

    // ═══════════════════════════════════════════════
    // CASHFREE — Status Check
    // ═══════════════════════════════════════════════
    else if (gateway === "cashfree") {
      try {
        const statusData = await getCashfreeOrderStatus(config, orderId);
        if (statusData.status === "PAID") {
          verified = true;
          finalStatus = "paid";
        }
      } catch (err: any) {
        console.error("[Cashfree status check]", err);
      }
    }

    // ═══════════════════════════════════════════════
    // Update payment transaction log
    // ═══════════════════════════════════════════════
    await supabase
      .from("payment_transactions")
      .update({
        gateway_payment_id: paymentId || null,
        status: finalStatus,
        gateway_response: { orderId, paymentId, verified },
        updated_at: new Date().toISOString(),
      })
      .eq("gateway_order_id", orderId);

    if (!verified) {
      return NextResponse.json(
        { success: false, error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════
    // Confirm Booking
    // ═══════════════════════════════════════════════
    if (bookingId) {
      await supabase
        .from("bookings")
        .update({ status: "CONFIRMED" })
        .eq("id", bookingId);
    }

    return NextResponse.json({
      success: true,
      status: finalStatus,
      paymentId: paymentId || orderId,
    });
  } catch (error: any) {
    console.error("[Verify Payment]", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
