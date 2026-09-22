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
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.slice(0, 7) + "-01";
      const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      // ১. হোটেলের তথ্য
      const { data: hotelData } = await supabase
        .from("hotels")
        .select("name, city, state, gst_number")
        .eq("id", hotelId)
        .maybeSingle();

      // ২. টোটাল রুম
      const { count: totalRooms } = await supabase
        .from("rooms")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId);

      // ৩. আজ কার্যকরী বুকিং (রুম দখল)
      const { data: todayBookings } = await supabase
        .from("bookings")
        .select("status")
        .eq("hotel_id", hotelId)
        .lte("check_in", today)
        .gte("check_out", today)
        .neq("status", "CANCELLED");

      const occupiedRooms = todayBookings?.filter((b: any) => 
        ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)
      ).length || 0;

      // ৪. আজকের আগমন ও প্রস্থান
      const { count: arrivalsToday } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("check_in", today)
        .neq("status", "CANCELLED");

      const { count: departuresToday } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("check_out", today)
        .neq("status", "CANCELLED");

      // ═══ ৫. আজকের রেভিনিউ (payments টেবিল থেকে) ═══
      const { data: todayPayments } = await supabase
        .from("payments")
        .select("amount")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      const todayRevenue = (todayPayments || []).reduce(
        (sum: number, p: any) => sum + (Number(p.amount) || 0), 0
      );

      // ═══ ৬. এই সপ্তাহের রেভিনিউ ═══
      const { data: weekPayments } = await supabase
        .from("payments")
        .select("amount")
        .gte("created_at", `${weekStart}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      const weekRevenue = (weekPayments || []).reduce(
        (sum: number, p: any) => sum + (Number(p.amount) || 0), 0
      );

      // ═══ ৭. এই মাসের রেভিনিউ ═══
      const { data: monthPayments } = await supabase
        .from("payments")
        .select("amount, method, created_at")
        .gte("created_at", `${monthStart}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      const monthRevenue = (monthPayments || []).reduce(
        (sum: number, p: any) => sum + (Number(p.amount) || 0), 0
      );

      // মাসের মেথড অনুযায়ী ব্রেকডাউন
      const byMethod: Record<string, number> = {};
      (monthPayments || []).forEach((p: any) => {
        const m = p.method || "Other";
        byMethod[m] = (byMethod[m] || 0) + (Number(p.amount) || 0);
      });
      const methodBreakdown = Object.entries(byMethod)
        .map(([m, v]) => `${m}: ₹${v.toLocaleString("en-IN")}`)
        .join(", ");

      // ═══ ৮. এই মাসের বুকিং এবং পেন্ডিং ═══
      const { data: monthBookings } = await supabase
        .from("bookings")
        .select("amount, tax, paid, status")
        .eq("hotel_id", hotelId)
        .gte("check_in", monthStart)
        .lte("check_in", today)
        .neq("status", "CANCELLED");

      let monthBookingsCount = monthBookings?.length || 0;
      let monthPending = 0;
      (monthBookings || []).forEach((b: any) => {
        const total = (Number(b.amount) || 0) + (Number(b.tax) || 0);
        const paid = Number(b.paid) || 0;
        monthPending += Math.max(0, total - paid);
      });

      const availableRooms = (totalRooms || 0) - occupiedRooms;
      const occupancyRate = totalRooms ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : "0";

      hotelContext = `
        HOTEL INFORMATION:
        - Hotel Name: ${hotelData?.name || "Unknown"}
        - Location: ${hotelData?.city || ""}, ${hotelData?.state || ""}
        
        TODAY (${today}):
        - Total Rooms: ${totalRooms || 0}
        - Occupied Rooms: ${occupiedRooms}
        - Available Rooms: ${availableRooms}
        - Occupancy Rate: ${occupancyRate}%
        - Sold Out Today: ${availableRooms <= 0 ? "YES" : "NO"}
        - Arrivals Today: ${arrivalsToday || 0}
        - Departures Today: ${departuresToday || 0}
        - Today's Revenue: ₹${todayRevenue.toLocaleString("en-IN")}
        
        THIS WEEK:
        - Total Revenue: ₹${weekRevenue.toLocaleString("en-IN")}
        
        THIS MONTH (${monthStart} to ${today}):
        - Total Bookings: ${monthBookingsCount}
        - Total Revenue (Collected): ₹${monthRevenue.toLocaleString("en-IN")}
        - Payment Methods: ${methodBreakdown || "None"}
        - Total Pending Balance: ₹${monthPending.toLocaleString("en-IN")}
      `;
    }

    const contextInfo = `
      You are "Nexa AI", a smart assistant for Staynexa PMS (Property Management System).
      Today: ${new Date().toLocaleDateString("en-IN")}
      
      ${hotelContext}
      
      CRITICAL INSTRUCTIONS:
      - You HAVE FULL ACCESS to the hotel data above. Use it directly to answer.
      - NEVER say "I don't have that information" if the data is present above.
      - When asked about revenue, sales, or collection, USE THE NUMBERS above.
      - Format all money in Indian style: ₹1,35,992 (with commas).
      - Keep answers short (1-3 sentences) and professional.
      - If truly not in data, say: "That information isn't available to me right now."
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