// app/api/ai/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { messages, hotelId } = await req.json();
    
    let hotelContext = "No hotel data available.";
    let debugInfo: any = { hotelId, errors: [] };
    
    if (!hotelId) {
      debugInfo.errors.push("hotelId was not provided");
    } else {
      // ═══ SERVICE_ROLE_KEY ব্যবহার করা হলো (RLS বাইপাসের জন্য) ═══
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { persistSession: false } }
      );

      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.slice(0, 7) + "-01";
      const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      // ═══ ১. হোটেল তথ্য ═══
      const { data: hotelData, error: hotelErr } = await supabase
        .from("hotels")
        .select("name, city, state")
        .eq("id", hotelId)
        .maybeSingle();
      
      if (hotelErr) debugInfo.errors.push(`Hotel query: ${hotelErr.message}`);

      // ═══ ২. সব রুম ═══
      const { data: roomsData, error: roomsErr } = await supabase
        .from("rooms")
        .select("id, room_number, room_type, housekeeping_status")
        .eq("hotel_id", hotelId);
      
      if (roomsErr) debugInfo.errors.push(`Rooms query: ${roomsErr.message}`);
      
      const totalRooms = roomsData?.length || 0;
      debugInfo.totalRooms = totalRooms;

      // ═══ ৩. সব বুকিং (শেষ ৯০ দিনের + ভবিষ্যতের) ═══
      const { data: allBookings, error: bookingsErr } = await supabase
        .from("bookings")
        .select("id, check_in, check_out, amount, tax, paid, status")
        .eq("hotel_id", hotelId);
      
      if (bookingsErr) debugInfo.errors.push(`Bookings query: ${bookingsErr.message}`);
      
      debugInfo.totalBookings = allBookings?.length || 0;

      // ═══ ৪. আজকে দখলকৃত রুম ═══
      const activeToday = (allBookings || []).filter((b: any) => {
        const ci = b.check_in || "";
        const co = b.check_out || "";
        return ci <= today && co >= today &&
          ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE"].includes(b.status);
      });
      const occupiedRooms = activeToday.length;
      const availableRooms = Math.max(0, totalRooms - occupiedRooms);
      const occupancyRate = totalRooms ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : "0";

      // ═══ ৫. আজকের আগমন ও প্রস্থান ═══
      const arrivalsToday = (allBookings || []).filter((b: any) => 
        b.check_in === today && b.status !== "CANCELLED"
      ).length;
      const departuresToday = (allBookings || []).filter((b: any) => 
        b.check_out === today && b.status !== "CANCELLED"
      ).length;

      // ═══ ৬. রেভিনিউ (paid কলাম থেকে, check_in date দিয়ে) ═══
      const todayBookings = (allBookings || []).filter((b: any) => b.check_in === today);
      const todayRevenue = todayBookings.reduce((s: number, b: any) => s + (Number(b.paid) || 0), 0);

      const weekBookings = (allBookings || []).filter((b: any) =>
        b.check_in >= weekStart && b.check_in <= today
      );
      const weekRevenue = weekBookings.reduce((s: number, b: any) => s + (Number(b.paid) || 0), 0);

      const monthBookings = (allBookings || []).filter((b: any) =>
        b.check_in >= monthStart && b.check_in <= today
      );
      const monthRevenue = monthBookings.reduce((s: number, b: any) => s + (Number(b.paid) || 0), 0);

      const monthPending = monthBookings.reduce((s: number, b: any) => {
        const total = (Number(b.amount) || 0) + (Number(b.tax) || 0);
        const paid = Number(b.paid) || 0;
        return s + Math.max(0, total - paid);
      }, 0);

      const monthBookingsCount = monthBookings.filter((b: any) => b.status !== "CANCELLED").length;

      // ═══ ৭. হাউজকিপিং স্ট্যাটাস ═══
      const cleanRooms = (roomsData || []).filter((r: any) => 
        r.housekeeping_status === "CLEAN" || !r.housekeeping_status
      ).length;
      const dirtyRooms = (roomsData || []).filter((r: any) => 
        r.housekeeping_status === "DIRTY"
      ).length;

      // ═══ কনটেক্সট তৈরি ═══
      hotelContext = `
        HOTEL INFORMATION:
        - Name: ${hotelData?.name || "Unknown"}
        - Location: ${hotelData?.city || ""}, ${hotelData?.state || ""}
        
        TODAY (${today}):
        - Total Rooms in Hotel: ${totalRooms}
        - Occupied Rooms: ${occupiedRooms}
        - AVAILABLE ROOMS: ${availableRooms}
        - Occupancy Rate: ${occupancyRate}%
        - Is Hotel Sold Out Today? ${availableRooms === 0 ? "YES" : "NO"}
        - Arrivals Today: ${arrivalsToday}
        - Departures Today: ${departuresToday}
        - Today's Collection: ₹${todayRevenue.toLocaleString("en-IN")}
        
        THIS WEEK (from ${weekStart}):
        - Total Collected: ₹${weekRevenue.toLocaleString("en-IN")}
        
        THIS MONTH (from ${monthStart}):
        - Total Bookings: ${monthBookingsCount}
        - Total Collected: ₹${monthRevenue.toLocaleString("en-IN")}
        - Total Pending Balance: ₹${monthPending.toLocaleString("en-IN")}
        
        HOUSEKEEPING:
        - Clean Rooms: ${cleanRooms}
        - Dirty Rooms: ${dirtyRooms}
      `;
      
      console.log("[AI Debug]", debugInfo);
    }

    const contextInfo = `
      You are "Nexa AI", a smart assistant for Staynexa PMS.
      Today: ${new Date().toLocaleDateString("en-IN")}
      
      ${hotelContext}
      
      CRITICAL RULES:
      - You HAVE FULL ACCESS to the hotel data above. Use it DIRECTLY to answer.
      - NEVER say "I don't have that info" if the data is present above.
      - "AVAILABLE ROOMS" is the exact number available right now.
      - If user asks "how many rooms are available", answer with the exact number from "AVAILABLE ROOMS" field.
      - If user asks about revenue, sales, or collection, USE the numbers above.
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
        temperature: 0.2,
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