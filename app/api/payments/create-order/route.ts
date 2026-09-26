import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay"; // টার্মিনালে npm install razorpay করে নিন

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { hotelId, amount, bookingRef, bookingId, customerName } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ১. পেমেন্ট সেটিংস চেক করুন
    const { data: settings } = await supabase
      .from("booking_engine_settings")
      .select("*")
      .eq("hotel_id", hotelId)
      .single();

    if (!settings || !settings.payment_gateway || settings.payment_gateway === "none") {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 400 });
    }

    const gateway = settings.payment_gateway;
    const orderId = `ORD-${bookingRef}-${Date.now()}`;

    // ২. 🚨 CRITICAL FIX: payment_transactions টেবিলে রো তৈরি করুন
    const { error: txError } = await supabase.from("payment_transactions").insert([{
      hotel_id: hotelId,
      booking_id: bookingId,
      gateway: gateway,
      gateway_order_id: orderId,
      amount: amount,
      status: "created", 
    }]);

    if (txError) {
      console.error("Payment Tx Insert Error:", txError);
      throw new Error("Failed to initialize payment transaction");
    }

    // ৩. UPI QR Flow
    if (gateway === "upi_qr") {
      const upiString = `upi://pay?pa=${settings.upi_id}&pn=${encodeURIComponent(customerName)}&am=${amount}&cu=INR&tn=${bookingRef}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
      
      return NextResponse.json({
        success: true,
        gateway: "upi_qr",
        orderId: orderId,
        amount: amount,
        upiId: settings.upi_id,
        qrCodeUrl: qrCodeUrl,
        deepLink: upiString,
      });
    }

    // ৪. Razorpay Flow
    if (gateway === "razorpay") {
      const instance = new Razorpay({
        key_id: settings.razorpay_key_id!,
        key_secret: settings.razorpay_key_secret!,
      });
      
      const order = await instance.orders.create({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: bookingRef,
      });

      return NextResponse.json({
        success: true,
        gateway: "razorpay",
        orderId: order.id,
        amount: order.amount,
        publicKey: settings.razorpay_key_id,
      });
    }

    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });

  } catch (error: any) {
    console.error("[Create Order Error]", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
