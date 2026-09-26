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

    // ═══ Razorpay Verify ═══
    if (gateway === "razorpay") {
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

    // ═══ Cashfree Verify ═══
    else if (gateway === "cashfree") {
      const statusData = await getCashfreeOrderStatus(config, orderId);
      if (statusData.status === "PAID") {
        verified = true;
        finalStatus = "paid";
      }
    }

    if (!verified) {
      await supabase
        .from("payment_transactions")
        .update({
          status: "failed",
          error_message: "Verification failed",
          updated_at: new Date().toISOString(),
        })
        .eq("gateway_order_id", orderId);

      return NextResponse.json(
        { success: false, error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // ✅ Success! Update payment log
    await supabase
      .from("payment_transactions")
      .update({
        gateway_payment_id: paymentId,
        status: "paid",
        gateway_response: { orderId, paymentId },
        updated_at: new Date().toISOString(),
      })
      .eq("gateway_order_id", orderId);

    // ✅ Update booking status → CONFIRMED
    if (bookingId) {
      await supabase
        .from("bookings")
        .update({ status: "CONFIRMED" })
        .eq("id", bookingId);

      // 🆕 Trigger WhatsApp + Email notification
      try {
        const { triggerBookingNotifications } = await import(
          "@/app/lib/notifications"
        );
        // Fetch booking details and trigger
        const { data: booking } = await supabase
          .from("bookings")
          .select(
            "booking_ref, primary_guest_id, room_id, check_in, check_out, amount, tax, guests(name, phone, email), rooms(room_number, room_type), hotels(name, phone)"
          )
          .eq("id", bookingId)
          .single();

        // (আপনার বিদ্যমান নোটিফিকেশন লজিক এখানে কল করুন)
      } catch (e) {
        console.error("Notification trigger failed", e);
      }
    }

    return NextResponse.json({
      success: true,
      status: "paid",
      paymentId,
    });
  } catch (error: any) {
    console.error("[Verify Payment]", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
