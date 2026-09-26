// app/api/payments/admin-verify/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { action, transactionId, bookingId, hotelId } = await req.json();

    if (!action || !transactionId || !hotelId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (action === "verify") {
      await supabase
        .from("payment_transactions")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId)
        .eq("hotel_id", hotelId);

      if (bookingId) {
        await supabase
          .from("bookings")
          .update({ status: "CONFIRMED" })
          .eq("id", bookingId);

        try {
          const { triggerBookingNotifications } = await import(
            "@/app/lib/notifications"
          );
          const { data: booking } = await supabase
            .from("bookings")
            .select(
              "booking_ref, check_in, check_out, amount, tax, primary_guest_id, room_id"
            )
            .eq("id", bookingId)
            .single();

          if (booking) {
            const { data: guest } = await supabase
              .from("guests")
              .select("name, phone, email")
              .eq("id", booking.primary_guest_id)
              .single();

            const { data: room } = await supabase
              .from("rooms")
              .select("room_number, room_type")
              .eq("id", booking.room_id)
              .single();

            const { data: hotel } = await supabase
              .from("hotels")
              .select("name, phone")
              .eq("id", hotelId)
              .single();

            if (guest && hotel) {
              await triggerBookingNotifications({
                hotelId,
                bookingId,
                bookingRef: booking.booking_ref,
                guestName: guest.name,
                guestPhone: guest.phone,
                guestEmail: guest.email,
                roomType: room?.room_type || "Room",
                roomNumber: room?.room_number || "",
                checkIn: booking.check_in,
                checkOut: booking.check_out,
                nights: Math.max(
                  1,
                  Math.round(
                    (new Date(booking.check_out).getTime() -
                      new Date(booking.check_in).getTime()) /
                      86400000
                  )
                ),
                total: (booking.amount || 0) + (booking.tax || 0),
                hotelName: hotel.name,
                hotelPhone: hotel.phone,
              });
            }
          }
        } catch (e) {
          console.error("Notification failed:", e);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Payment verified and booking confirmed",
      });
    } else if (action === "reject") {
      await supabase
        .from("payment_transactions")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId)
        .eq("hotel_id", hotelId);

      if (bookingId) {
        await supabase
          .from("bookings")
          .update({ status: "CANCELLED" })
          .eq("id", bookingId);
      }

      return NextResponse.json({
        success: true,
        message: "Payment rejected and booking cancelled",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[Admin Verify]", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
