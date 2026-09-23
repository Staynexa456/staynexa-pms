// app/api/ai/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { messages, hotelId } = await req.json();
    
    let hotelContext = "No hotel data available.";
    
    if (!hotelId) {
      hotelContext = "ERROR: No hotelId provided. Cannot fetch data.";
    } else {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { persistSession: false } }
      );

      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.slice(0, 7) + "-01";

      // ═══ ১. হোটেল তথ্য ═══
      const { data: hotelData } = await supabase
        .from("hotels")
        .select("name, city, state, address, phone, email, gst_number")
        .eq("id", hotelId)
        .maybeSingle();

      // ═══ ২. সব রুম ═══
      const { data: roomsData } = await supabase
        .from("rooms")
        .select("id, room_number, room_type, base_price, housekeeping_status")
        .eq("hotel_id", hotelId)
        .order("room_number");

      const totalRooms = roomsData?.length || 0;

      // ═══ ৩. সব বুকিং (গেস্ট ও রুম সহ) ═══
      const { data: allBookings } = await supabase
        .from("bookings")
        .select(`
          id, check_in, check_out, amount, tax, paid, status, source, rate_plan, adults, children, notes, booking_ref,
          guest:guests!primary_guest_id (name, phone, email),
          room:rooms!room_id (room_number, room_type)
        `)
        .eq("hotel_id", hotelId)
        .order("check_in", { ascending: false })
        .limit(200);

      // ═══ ৪. আজকের Active বুকিং ═══
      const todayBookings = (allBookings || []).filter((b: any) =>
        b.check_in <= today && b.check_out >= today &&
        ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)
      );
      const occupiedRooms = todayBookings.length;
      const availableRooms = Math.max(0, totalRooms - occupiedRooms);
      const occupancyRate = totalRooms ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : "0";

      // ═══ ৫. Hold Bookings ═══
      const holdBookings = (allBookings || []).filter((b: any) => b.status === "ON-HOLD");

      // ═══ ৬. আজকের Arrivals ও Departures ═══
      const arrivals = (allBookings || []).filter((b: any) =>
        b.check_in === today && b.status !== "CANCELLED"
      );
      const departures = (allBookings || []).filter((b: any) =>
        b.check_out === today && b.status !== "CANCELLED"
      );

      // ═══ ৭. In-House Guests ═══
      const inHouse = (allBookings || []).filter((b: any) => b.status === "CHECKED-IN");

      // ═══ ৮. Cancelled, No-Show ═══
      const cancelled = (allBookings || []).filter((b: any) => b.status === "CANCELLED").slice(0, 5);
      const noShows = (allBookings || []).filter((b: any) => b.status === "NO-SHOW").slice(0, 5);

      // ═══ ৯. এই মাসের বুকিং ও রেভিনিউ ═══
      const monthBookings = (allBookings || []).filter((b: any) =>
        b.check_in >= monthStart && b.check_in <= today && b.status !== "CANCELLED"
      );
      const monthRevenue = monthBookings.reduce((s: number, b: any) => s + (Number(b.paid) || 0), 0);
      const monthTotalValue = monthBookings.reduce((s: number, b: any) =>
        s + (Number(b.amount) || 0) + (Number(b.tax) || 0), 0);
      const monthPending = monthTotalValue - monthRevenue;

      // ═══ ১০. আজকের Collection ═══
      const todayBookingsForRev = (allBookings || []).filter((b: any) => b.check_in === today);
      const todayRevenue = todayBookingsForRev.reduce((s: number, b: any) => s + (Number(b.paid) || 0), 0);

      // ═══ ১১. Room Type Breakdown ═══
      const roomTypeMap: Record<string, { total: number; available: number }> = {};
      (roomsData || []).forEach((r: any) => {
        const type = r.room_type || "Standard";
        if (!roomTypeMap[type]) roomTypeMap[type] = { total: 0, available: 0 };
        roomTypeMap[type].total += 1;
        roomTypeMap[type].available += 1;
      });
      todayBookings.forEach((b: any) => {
        const type = b.room?.room_type || "Standard";
        if (roomTypeMap[type]) roomTypeMap[type].available = Math.max(0, roomTypeMap[type].available - 1);
      });
      const roomTypeBreakdown = Object.entries(roomTypeMap)
        .map(([t, v]) => `${t}: ${v.available}/${v.total} available`)
        .join(", ");

      // ═══ ১২. Housekeeping Breakdown ═══
      const cleanRooms = (roomsData || []).filter((r: any) =>
        r.housekeeping_status === "CLEAN" || !r.housekeeping_status
      ).length;
      const dirtyRooms = (roomsData || []).filter((r: any) =>
        r.housekeeping_status === "DIRTY"
      ).length;
      const maintenanceRooms = (roomsData || []).filter((r: any) =>
        r.housekeeping_status === "MAINTENANCE"
      ).length;

      // ═══ ১৩. বুকিং সোর্স Breakdown ═══
      const sourceMap: Record<string, number> = {};
      monthBookings.forEach((b: any) => {
        const src = b.source || "walk-in";
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      });
      const sourceBreakdown = Object.entries(sourceMap)
        .map(([s, c]) => `${s}: ${c}`)
        .join(", ");

      // ═══ DETAILED BOOKINGS LIST (AI যাতে নির্দিষ্ট গেস্ট সম্পর্কে বলতে পারে) ═══
      const bookingsList = (allBookings || []).slice(0, 50).map((b: any) => {
        const gName = b.guest?.name || "Guest";
        const rNum = b.room?.room_number || "—";
        return `${gName} | Room ${rNum} | ${b.check_in} → ${b.check_out} | ${b.status} | ₹${b.paid || 0}/${(Number(b.amount)||0)+(Number(b.tax)||0)} | ${b.source || "walk-in"}`;
      }).join("\n");

      // ═══ TODAY'S SPECIFIC BOOKINGS ═══
      const arrivalsList = arrivals.map((b: any) =>
        `${b.guest?.name || "Guest"} - Room ${b.room?.room_number || "—"} (${b.status})`
      ).join("\n") || "None";

      const departuresList = departures.map((b: any) =>
        `${b.guest?.name || "Guest"} - Room ${b.room?.room_number || "—"}`
      ).join("\n") || "None";

      const inHouseList = inHouse.map((b: any) =>
        `${b.guest?.name || "Guest"} - Room ${b.room?.room_number || "—"} (until ${b.check_out})`
      ).join("\n") || "None";

      const holdList = holdBookings.slice(0, 10).map((b: any) =>
        `${b.guest?.name || "Guest"} - Room ${b.room?.room_number || "—"} | ${b.check_in}`
      ).join("\n") || "None";

      // ═══════════════════════════════════════════════════════════
      // সম্পূর্ণ কনটেক্সট
      // ═══════════════════════════════════════════════════════════
      hotelContext = `
═══════════════════════════════════════
HOTEL INFORMATION
═══════════════════════════════════════
Name: ${hotelData?.name || "Unknown"}
Location: ${hotelData?.city || ""}, ${hotelData?.state || ""}
Address: ${hotelData?.address || "—"}
Phone: ${hotelData?.phone || "—"}
GST: ${hotelData?.gst_number || "—"}
Today's Date: ${today}

═══════════════════════════════════════
ROOM INVENTORY
═══════════════════════════════════════
Total Rooms: ${totalRooms}
Occupied (today): ${occupiedRooms}
AVAILABLE (today): ${availableRooms}
Occupancy Rate: ${occupancyRate}%
Sold Out Today: ${availableRooms === 0 ? "YES" : "NO"}

Room Type Breakdown: ${roomTypeBreakdown}

Housekeeping:
- Clean: ${cleanRooms}
- Dirty: ${dirtyRooms}
- Maintenance: ${maintenanceRooms}

═══════════════════════════════════════
TODAY (${today})
═══════════════════════════════════════
Arrivals (${arrivals.length}): 
${arrivalsList}

Departures (${departures.length}):
${departuresList}

In-House Guests (${inHouse.length}):
${inHouseList}

Today's Collection: ₹${todayRevenue.toLocaleString("en-IN")}

═══════════════════════════════════════
HOLD BOOKINGS (${holdBookings.length} total)
═══════════════════════════════════════
${holdList}

═══════════════════════════════════════
THIS MONTH (${monthStart} → ${today})
═══════════════════════════════════════
Total Bookings: ${monthBookings.length}
Total Booking Value: ₹${monthTotalValue.toLocaleString("en-IN")}
Total Collected: ₹${monthRevenue.toLocaleString("en-IN")}
Pending Balance: ₹${monthPending.toLocaleString("en-IN")}

Booking Sources: ${sourceBreakdown || "N/A"}

Recent Cancelled: ${cancelled.map((b: any) => b.guest?.name || "—").join(", ") || "None"}
Recent No-Shows: ${noShows.map((b: any) => b.guest?.name || "—").join(", ") || "None"}

═══════════════════════════════════════
RECENT BOOKINGS (Last 50)
═══════════════════════════════════════
Guest Name | Room | Dates | Status | Paid/Total | Source
${bookingsList}
`;
    }

    const contextInfo = `
You are "Nexa AI", a smart PMS assistant for Staynexa.
Today: ${new Date().toLocaleDateString("en-IN")}

${hotelContext}

═══════════════════════════════════════
CRITICAL INSTRUCTIONS
═══════════════════════════════════════
1. You HAVE FULL ACCESS to ALL the data above. Use it DIRECTLY.
2. NEVER say "I don't have that information" if the data exists above.
3. When asked about "hold bookings", refer to the "HOLD BOOKINGS" section.
4. When asked about "arrivals", "departures", "in-house", refer to TODAY section.
5. When asked about a specific guest name, search in the RECENT BOOKINGS list.
6. When asked about revenue/sales, use the THIS MONTH section.
7. When asked about rooms, use the ROOM INVENTORY section.
8. Format money in Indian style: ₹1,35,992 (with commas).
9. Keep answers clear, short, and professional.
10. If user asks for specific details like "show me hold bookings", LIST them with guest names and rooms.
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: contextInfo },
          ...messages
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[Groq Error]", data);
      return NextResponse.json({ reply: "⚠ Connection issue. Please try again." }, { status: 500 });
    }

    const reply = data.choices?.[0]?.message?.content || "I couldn't process that.";
    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error("[AI API Error]", error);
    return NextResponse.json({ reply: "⚠ Something went wrong." }, { status: 500 });
  }
}