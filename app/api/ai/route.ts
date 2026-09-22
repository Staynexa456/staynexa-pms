// app/api/ai/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    // ═══ PMS কনটেক্সট তৈরি করা (AI-কে জানানোর জন্য) ═══
    const contextInfo = `
      You are "Nexa AI", a helpful assistant for Staynexa PMS (Property Management System).
      Today's Date: ${new Date().toISOString().split("T")[0]}
      
      Instructions:
      - Keep answers short, professional, and helpful.
      - If you don't know the answer based on the provided context, say "I don't have access to that information right now."
      - Do not make up guest data or financial figures.
      - You can help users navigate the PMS, understand reports, and explain features.
    `;

    // ═══ OpenAI API কল করা ═══
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
    
    if (!response.ok) {
       console.error("[OpenAI Error]", data);
       return NextResponse.json({ reply: "⚠ I'm having trouble connecting to my brain right now. Please check the API key." }, { status: 500 });
    }

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