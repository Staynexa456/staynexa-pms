// app/api/payments/check/[hotelId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  req: Request,
  { params }: { params: { hotelId: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("booking_engine_settings")
    .select(
      "payment_enabled, payment_gateway, payment_amount_type, advance_percentage"
    )
    .eq("hotel_id", params.hotelId)
    .single();

  if (!data || !data.payment_enabled || data.payment_gateway === "none") {
    return NextResponse.json({ enabled: false, gateway: "none" });
  }

  return NextResponse.json({
    enabled: true,
    gateway: data.payment_gateway,
    payment_amount_type: data.payment_amount_type,
    advance_percentage: data.advance_percentage,
  });
}
