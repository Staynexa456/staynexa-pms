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

      // ১. হোটেলের নাম
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

      // ৩. আজকের বুকিং এবং রুম স্ট্যাটাস
      const { data: todayBookings } = await supabase
        .from("bookings")
        .select("status, amount, tax, paid, check_in, check_out")
        .eq("hotel_id", hotelId)
        .lte("check_in", today)
        .gte("check_out", today)
        .neq("status", "CANCELLED");

      const occupiedRooms = todayBookings?.filter(b => 
        ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)
      ).length || 0;

      // ৪. আজকের আগমন (Arrivals)
      const { count: arrivalsToday } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("check_in", today)
        .neq("status", "CANCELLED");

      // ৫. আজকের প্রস্থান (Departures)
      const { count: departuresToday } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("check_out", today)
        .neq("status", "CANCELLED");

      // ৬. এই মাসের সব বুকিং
      const { data: monthBookings } = await supabase
        .from("bookings")
        .select("amount, tax, paid, status")
        .eq("hotel_id", hotelId)
        .gte("check_in", monthStart)
        .lte("check_in", today)
        .neq("status", "CANCELLED");

      let monthRevenue = 0;
      let monthPending = 0;
      let monthBookingsCount = monthBookings?.length || 0;
      
      (monthBookings || []).forEach((b: any) => {
        const total = (Number(b.amount) || 0) + (Number(b.tax) || 0);
        const paid = Number(b.paid) || 0;
        monthRevenue += total;
        monthPending += Math.max(0, total - paid);
      });

      // ৭. আজকের কালেকশন (payments টেবিল থেকে)
      const { data: todayPayments } = await supabase
        .from("payments")
        .select("amount")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      const todayCollection = (todayPayments || []).reduce(
        (sum, p: any) => sum + (Number(p.amount) || 0), 0
      );

      const availableRooms = (totalRooms || 0) - occupiedRooms;
      const occupancyRate = totalRooms ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : "0";

      hotelContext = `
        HOTEL INFORMATION:
        - Hotel Name: ${hotelData?.name || "Unknown"}
        - Location: ${hotelData?.city || ""}, ${hotelData?.state || ""}
        - GST Number: ${hotelData?.gst_number || "Not set"}
        
        TODAY'S DATA (${today}):
        - Total Rooms: ${totalRooms || 0}
        - Occupied Rooms: ${occupiedRooms}
        - Available Rooms: ${availableRooms}
        - Occupancy Rate: ${occupancyRate}%
        - Hotel Sold Out Today: ${availableRooms <= 0 ? "YES" : "NO"}
        - Today's Arrivals: ${arrivalsToday || 0}
        - Today's Departures: ${departuresToday || 0}
        - Today's Collection (Cash/Card): ₹${todayCollection.toFixed(2)}
        
        THIS MONTH (FROM ${monthStart} TO ${today}):
        - Total Bookings: ${monthBookingsCount}
        - Total Revenue: ₹${monthRevenue.toFixed(2)}
        - Total Pending Balance: ₹${monthPending.toFixed(2)}
      `;
    }

    const contextInfo = `
      You are "Nexa AI", a smart assistant for Staynexa PMS (Property Management System).
      Today's Date: ${new Date().toISOString().split("T")[0]}
      
      ${hotelContext}
      
      IMPORTANT INSTRUCTIONS:
      - You HAVE ACCESS to the hotel data shown above. Use it to answer questions confidently.
      - If asked about sales, revenue, or occupancy, use the numbers above.
      - Keep answers short, clear, and professional.
      - Format numbers in Indian Rupees (₹) with commas (e.g., ₹1,35,992).
      - If a user asks something not in your data, politely say you don't have that info.
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
        temperature: 0.5,
        max_tokens: 400,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
       console.error("[Groq Error]", data);
       return NextResponse.json({ reply: "⚠ I'm having trouble connecting right now. Please try again." }, { status: 500 });
    }

    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that.";
    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error("[AI API Error]", error);
    return NextResponse.json({ reply: "⚠ Something went wrong on my end." }, { status: 500 });
  }
}