// app/api/ai/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { messages, hotelId } = await req.json();
    
    // ═══ হোটেলের রিয়েল-টাইম ডেটা ফেচ করা ═══
    let hotelContext = "No hotel data available.";
    
    if (hotelId) {
      // Supabase ক্লায়েন্ট তৈরি করা (সার্ভার-সাইড)
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // আজকের ডেট
      const today = new Date().toISOString().split("T")[0];

      // ১. টোটাল রুম সংখ্যা
      const { count: totalRooms } = await supabase
        .from("rooms")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId);

      // ২. আজ কতটি রুম বুকড (চেক-ইন, চেক-আউট বা কনফার্মড)
      const { count: occupiedRooms } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE"])
        .lte("check_in", today)
        .gte("check_out", today);

      // ৩. আজকের আগমন (Arrivals)
      const { count: arrivalsToday } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("check_in", today)
        .neq("status", "CANCELLED");

      // ৪. আজকের প্রস্থান (Departures)
      const { count: departuresToday } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("check_out", today)
        .neq("status", "CANCELLED");

      // ═══ কনটেক্সট তৈরি করা ═══
      const availableRooms = (totalRooms || 0) - (occupiedRooms || 0);
      hotelContext = `
        Total Rooms: ${totalRooms || 0}
        Occupied Rooms (Today): ${occupiedRooms || 0}
        Available Rooms (Today): ${availableRooms}
        Arrivals Today: ${arrivalsToday || 0}
        Departures Today: ${departuresToday || 0}
        Is the hotel sold out today? ${availableRooms <= 0 ? "YES, it is sold out." : "No, rooms are available."}
      `;
    }

    // ═══ AI-কে পাঠানোর জন্য সিস্টেম প্রম্পট ═══
    const contextInfo = `
      You are "Nexa AI", a helpful assistant for Staynexa PMS (Property Management System).
      Today's Date: ${new Date().toISOString().split("T")[0]}
      
      Here is the current hotel data:
      ${hotelContext}
      
      Instructions:
      - Answer questions based on the hotel data provided above.
      - Keep answers short, professional, and helpful.
      - If the user asks about occupancy or availability, use the provided data.
      - Do not make up guest data or financial figures.
    `;

    // ═══ Groq API কল করা ═══
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
        temperature: 0.7,
        max_tokens: 300,
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