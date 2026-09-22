// app/api/ai/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { messages, hotelId } = await req.json();
    
    let hotelContext = "No hotel data available.";
    
    if (hotelId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.slice(0, 7) + "-01";
      const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      // ১. হোটেলের তথ্য
      const { data: hotelData } = await supabase
        .from("hotels")
        .select("name, city, state")
        .eq("id", hotelId)
        .maybeSingle();

      // ২. টোটাল রুম
      const { data: roomsData } = await supabase
        .from("rooms")
        .select("id, room_type")
        .eq("hotel_id", hotelId);
      const totalRooms = roomsData?.length || 0;

      // ═══ ৩. সব বুকিং একবারে আনা (শেষ ৯০ দিনের) ═══
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
      const { data: allBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, check_in, check_out, amount, tax, paid, status")
        .eq("hotel_id", hotelId)
        .gte("check_in", ninetyDaysAgo);

      if (bookingsError) {
        console.error("[Supabase Error]", bookingsError);
      }

      // ═══ ৪. রুম দখল হিসাব ═══
      const activeToday = (allBookings || []).filter((b: any) =>
        b.check_in <= today &&
        b.check_out >= today &&
        ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)
      );
      const occupiedRooms = activeToday.length;
      const availableRooms = totalRooms - occupiedRooms;
      const occupancyRate = totalRooms ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : "0";

      // ═══ ৫. আজকের আগমন / প্রস্থান ═══
      const arrivalsToday = (allBookings || []).filter((b: any) =>
        b.check_in === today && b.status !== "CANCELLED"
      ).length;
      const departuresToday = (allBookings || []).filter((b: any) =>
        b.check_out === today && b.status !== "CANCELLED"
      ).length;

      // ═══ ৬. রেভিনিউ হিসাব (paid column থেকে) ═══
      // আজকের collection (আজ যেসব booking-এ paid আপডেট হয়েছে)
      // আমরা check_in date diye approximate kori
      const todayBookings = (allBookings || []).filter((b: any) => b.check_in === today);
      const todayRevenue = todayBookings.reduce((s: number, b: any) => s + (Number(b.paid) || 0), 0);

      // এই সপ্তাহের collection
      const weekBookings = (allBookings || []).filter((b: any) =>
        b.check_in >= weekStart && b.check_in <= today
      );
      const weekRevenue = weekBookings.reduce((s: number, b: any) => s + (Number(b.paid) || 0), 0);

      // এই মাসের collection
      const monthBookings = (allBookings || []).filter((b: any) =>
        b.check_in >= monthStart && b.check_in <= today
      );
      const monthRevenue = monthBookings.reduce((s: number, b: any) => s + (Number(b.paid) || 0), 0);

      // এই মাসের পেন্ডিং
      const monthPending = monthBookings.reduce((s: number, b: any) => {
        const total = (Number(b.amount) || 0) + (Number(b.tax) || 0);
        const paid = Number(b.paid) || 0;
        return s + Math.max(0, total - paid);
      }, 0);

      // এই মাসের মোট বুকিং ভ্যালু
      const monthTotalValue = monthBookings.reduce((s: number, b: any) => {
        return s + (Number(b.amount) || 0) + (Number(b.tax) || 0);
      }, 0);

      // মোট বুকিং সংখ্যা
      const monthBookingsCount = monthBookings.filter((b: any) => b.status !== "CANCELLED").length;

      hotelContext = `
        HOTEL INFORMATION:
        - Hotel Name: ${hotelData?.name || "Unknown"}
        - Location: ${hotelData?.city || ""}, ${hotelData?.state || ""}
        
        TODAY (${today}):
        - Total Rooms: ${totalRooms}
        - Occupied Rooms: ${occupiedRooms}
        - Available Rooms: ${availableRooms}
        - Occupancy Rate: ${occupancyRate}%
        - Sold Out Today: ${availableRooms <= 0 ? "YES" : "NO"}
        - Arrivals Today: ${arrivalsToday}
        - Departures Today: ${departuresToday}
        - Today's Collection: ₹${todayRevenue.toLocaleString("en-IN")}
        
        THIS WEEK (from ${weekStart}):
        - Total Collected: ₹${weekRevenue.toLocaleString("en-IN")}
        
        THIS MONTH (from ${monthStart}):
        - Total Bookings: ${monthBookingsCount}
        - Total Booking Value: ₹${monthTotalValue.toLocaleString("en-IN")}
        - Total Collected: ₹${monthRevenue.toLocaleString("en-IN")}
        - Total Pending Balance: ₹${monthPending.toLocaleString("en-IN")}
      `;
    }

    const contextInfo = `
      You are "Nexa AI", a smart assistant for Staynexa PMS.
      Today: ${new Date().toLocaleDateString("en-IN")}
      
      ${hotelContext}
      
      CRITICAL RULES:
      - You HAVE FULL ACCESS to the hotel data above. Use it directly.
      - NEVER say "I don't have that info" if the data is in the context above.
      - If asked about revenue, sales, or collection, USE the numbers above.
      - Format money in Indian style: ₹1,35,992.
      - Keep answers short (1-3 sentences), professional, and helpful.
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
        temperature: 0.3,
        max_tokens: 400,
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