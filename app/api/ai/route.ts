// app/api/ai/route.ts
import { NextResponse } from "next/server";
import { getActiveHotelId } from "@/app/active-hotel"; // আপনার প্রজেক্টের পাথ অনুযায়ী চেক করুন

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const hotelId = getActiveHotelId() || "Unknown Hotel";

    // ═══ PMS কনটেক্সট তৈরি করা (AI-কে জানানোর জন্য) ═══
    // বাস্তবে এখানে আপনার ডেটাবেস থেকে রিয়েল ডেটা আনতে হবে
    const contextInfo = `
      You are "Nexa AI", a helpful assistant for Staynexa PMS (Property Management System).
      Current Hotel ID: ${hotelId}
      Today's Date: ${new Date().toISOString().split("T")[0]}
      
      Instructions:
      - Keep answers short, professional, and helpful.
      - If you don't know the answer based on the provided context, say "I don't have access to that information right now."
      - Do not make up guest data or financial figures.
    `;

    // ═══ OpenAI API কল করা ═══
    // নোট: আপনার .env.local ফাইলে OPENAI_API_KEY থাকতে হবে
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // অথবা gpt-3.5-turbo
        messages: [
          { role: "system", content: contextInfo },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that.";
    
    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error("[AI API Error]", error);
    return NextResponse.json(
      { reply: "⚠ Something went wrong on my end. Please try again." },
      { status: 500 }
    );
  }
}
