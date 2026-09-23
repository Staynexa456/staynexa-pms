// app/api/ai/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { messages, hotelId } = await req.json();

    let hotelContext = "No hotel data available.";
    let actionsContext = "";

    if (!hotelId) {
      hotelContext = "ERROR: No hotelId provided. Cannot fetch hotel data.";
    } else {
      const serviceKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { persistSession: false } }
      );

      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.slice(0, 7) + "-01";

      // ═══════════════════════════════════════════════
      // ১. হোটেল তথ্য
      // ═══════════════════════════════════════════════
      const { data: hotelData } = await supabase
        .from("hotels")
        .select("name, city, state, address, phone, gst_number")
        .eq("id", hotelId)
        .maybeSingle();

      // ═══ ২. সব রুম ═══
      const { data: roomsData } = await supabase
        .from("rooms")
        .select("id, room_number, room_type, base_price, housekeeping_status")
        .eq("hotel_id", hotelId)
        .order("room_number");

      const allRooms = roomsData || [];
      const totalRooms = allRooms.length;

      // ═══ ৩. সব বুকিং (গেস্ট + রুম সহ) ═══
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(`
          id, booking_ref, check_in, check_out, amount, tax, paid, status,
          source, adults, children, notes, created_at, room_id, primary_guest_id,
          guest:guests!primary_guest_id (name, phone, email),
          room:rooms!room_id (room_number, room_type)
        `)
        .eq("hotel_id", hotelId)
        .order("check_in", { ascending: false });

      const allBookings = bookingsData || [];

      // ═══ ৪. সব পেমেন্ট ═══
      const bookingIds = allBookings.map((b: any) => b.id).filter(Boolean);
      let allPayments: any[] = [];
      if (bookingIds.length > 0) {
        const { data: payments } = await supabase
          .from("payments")
          .select("id, booking_id, amount, method, created_at")
          .in("booking_id", bookingIds);
        allPayments = payments || [];
      }

      // ═══════════════════════════════════════════════
      // HELPERS
      // ═══════════════════════════════════════════════
      const safeGuestName = (b: any): string => {
        const g = b?.guest;
        if (!g) return "Guest";
        if (Array.isArray(g)) return g[0]?.name || "Guest";
        return g.name || "Guest";
      };
      const safeRoomNumber = (b: any): string | null => {
        const r = b?.room;
        if (!r) return null;
        if (Array.isArray(r)) return r[0]?.room_number || null;
        return r.room_number || null;
      };
      const safeRoomType = (b: any): string | null => {
        const r = b?.room;
        if (!r) return null;
        if (Array.isArray(r)) return r[0]?.room_type || null;
        return r.room_type || null;
      };
      const toDateStr = (iso: string | null | undefined): string => {
        if (!iso) return "";
        return String(iso).split("T")[0].split(" ")[0];
      };

      // ═══ ৫. আজকের Active bookings ═══
      const activeToday = allBookings.filter((b: any) => {
        const ci = toDateStr(b.check_in);
        const co = toDateStr(b.check_out);
        return (
          ci <= today &&
          co > today &&
          ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)
        );
      });

      const occupiedRooms = activeToday.length;
      const availableRooms = Math.max(0, totalRooms - occupiedRooms);
      const occupancyRate =
        totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : "0";

      // ═══ ৬. আজকের Arrivals/Departures ═══
      const arrivalsToday = allBookings.filter(
        (b: any) =>
          toDateStr(b.check_in) === today &&
          b.status !== "CANCELLED" &&
          b.status !== "NO-SHOW"
      );
      const departuresToday = allBookings.filter(
        (b: any) =>
          toDateStr(b.check_out) === today && b.status !== "CANCELLED"
      );
      const inHouse = allBookings.filter(
        (b: any) => b.status === "CHECKED-IN"
      );
      const pendingCheckins = allBookings.filter(
        (b: any) =>
          toDateStr(b.check_in) === today && b.status === "CONFIRMED"
      );
      const pendingCheckouts = allBookings.filter(
        (b: any) =>
          toDateStr(b.check_out) === today &&
          ["CHECKED-IN", "PENDING DEPARTURE"].includes(b.status)
      );

      // ═══ ৭. এই মাসের রেভিনিউ ═══
      const monthBookings = allBookings.filter((b: any) => {
        const ci = toDateStr(b.check_in);
        return ci >= monthStart && ci <= today && b.status !== "CANCELLED";
      });

      const monthRevenue = monthBookings.reduce((s: number, b: any) => {
        const total = (Number(b.amount) || 0) + (Number(b.tax) || 0);
        const paid = Number(b.paid) || 0;
        return s + paid;
      }, 0);

      const monthTotalValue = monthBookings.reduce((s: number, b: any) => {
        return s + (Number(b.amount) || 0) + (Number(b.tax) || 0);
      }, 0);

      const monthPending = monthTotalValue - monthRevenue;

      // ═══ ৮. Total Outstanding ═══
      const totalOutstanding = allBookings
        .filter(
          (b: any) => !["CANCELLED", "BLOCKED"].includes(b.status)
        )
        .reduce((s: number, b: any) => {
          const total = (Number(b.amount) || 0) + (Number(b.tax) || 0);
          const paid = Number(b.paid) || 0;
          return s + Math.max(0, total - paid);
        }, 0);

      // ═══ ৯. হাউজকিপিং ═══
      const cleanRooms = allRooms.filter(
        (r: any) =>
          r.housekeeping_status === "CLEAN" || !r.housekeeping_status
      ).length;
      const dirtyRooms = allRooms.filter(
        (r: any) => r.housekeeping_status === "DIRTY"
      ).length;
      const maintenanceRooms = allRooms.filter(
        (r: any) => r.housekeeping_status === "MAINTENANCE"
      ).length;

      // ═══ ১০. বুকিং সোর্স ═══
      const sourceMap: Record<string, number> = {};
      monthBookings.forEach((b: any) => {
        const src = (b.source || "walk-in").toLowerCase();
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      });
      const sourceBreakdown = Object.entries(sourceMap)
        .map(([s, c]) => `${s}: ${c}`)
        .join(", ");

      // ═══ ১১. Booking List (Top 30) ═══
      const bookingsList = allBookings
        .slice(0, 30)
        .map((b: any) => {
          const gName = safeGuestName(b);
          const rNum = safeRoomNumber(b);
          const total =
            (Number(b.amount) || 0) + (Number(b.tax) || 0);
          const paid = Number(b.paid) || 0;
          return `${gName} | Room ${rNum || "—"} | ${toDateStr(b.check_in)} → ${toDateStr(b.check_out)} | ${b.status} | ₹${paid}/${total} | ${b.source || "walk-in"}`;
        })
        .join("\n");

      // ═══ ১২. Details Lists ═══
      const arrivalsList =
        arrivalsToday
          .map(
            (b: any) =>
              `${safeGuestName(b)} - Room ${safeRoomNumber(b) || "—"} (${b.status})`
          )
          .join("\n") || "None";

      const departuresList =
        departuresToday
          .map(
            (b: any) =>
              `${safeGuestName(b)} - Room ${safeRoomNumber(b) || "—"} (${b.status})`
          )
          .join("\n") || "None";

      const inHouseList =
        inHouse
          .map(
            (b: any) =>
              `${safeGuestName(b)} - Room ${safeRoomNumber(b) || "—"} (until ${toDateStr(b.check_out)})`
          )
          .join("\n") || "None";

      // ═══════════════════════════════════════════════
      // ১৩. PENDING ACTIONS REQUIRED
      // ═══════════════════════════════════════════════
      const actionsList: string[] = [];

      allBookings.forEach((b: any) => {
        const ci = toDateStr(b.check_in);
        const co = toDateStr(b.check_out);
        const gName = safeGuestName(b);
        const rNum = safeRoomNumber(b);
        const balance = Math.max(
          0,
          (Number(b.amount) || 0) +
            (Number(b.tax) || 0) -
            (Number(b.paid) || 0)
        );

        // Check-in Due Today
        if (b.status === "CONFIRMED" && ci === today) {
          actionsList.push(
            `CHECK-IN DUE TODAY: ${gName} (Room ${rNum || "—"})`
          );
        }

        // Overdue Check-in
        if (b.status === "CONFIRMED" && ci < today) {
          actionsList.push(
            `OVERDUE CHECK-IN: ${gName} (Room ${rNum || "—"}) since ${ci}`
          );
        }

        // Check-out Due Today
        if (
          ["CHECKED-IN", "PENDING DEPARTURE"].includes(b.status) &&
          co === today
        ) {
          actionsList.push(
            `CHECK-OUT DUE TODAY: ${gName} (Room ${rNum || "—"})${balance > 0 ? ` - ₹${balance.toFixed(0)} due` : ""}`
          );
        }

        // Overdue Check-out
        if (
          ["CHECKED-IN", "PENDING DEPARTURE"].includes(b.status) &&
          co < today
        ) {
          actionsList.push(
            `OVERDUE CHECK-OUT: ${gName} (Room ${rNum || "—"}) since ${co}`
          );
        }

        // Data Issue: CHECKED-IN but future date
        if (b.status === "CHECKED-IN" && ci > today) {
          actionsList.push(
            `DATA ISSUE: ${gName} marked CHECKED-IN but check-in date is ${ci}`
          );
        }
      });

      if (actionsList.length > 0) {
        actionsContext = `
═══════════════════════════════════════
PENDING ACTIONS REQUIRED (${actionsList.length} items)
═══════════════════════════════════════
${actionsList.join("\n")}
`;
      } else {
        actionsContext = `\nPENDING ACTIONS: None — all caught up!\n`;
      }

      // ═══════════════════════════════════════════════
      // ১৪. MAIN HOTEL CONTEXT
      // ═══════════════════════════════════════════════
      hotelContext = `
═══════════════════════════════════════
HOTEL INFORMATION
═══════════════════════════════════════
Name: ${hotelData?.name || "Unknown"}
Location: ${hotelData?.city || ""}, ${hotelData?.state || ""}
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

Housekeeping:
- Clean: ${cleanRooms}
- Dirty: ${dirtyRooms}
- Maintenance: ${maintenanceRooms}

═══════════════════════════════════════
TODAY'S OPERATIONS (${today})
═══════════════════════════════════════
Arrivals (${arrivalsToday.length}):
${arrivalsList}

Departures (${departuresToday.length}):
${departuresList}

In-House Guests (${inHouse.length}):
${inHouseList}

Pending Check-ins: ${pendingCheckins.length}
Pending Check-outs: ${pendingCheckouts.length}

═══════════════════════════════════════
THIS MONTH (${monthStart} → ${today})
═══════════════════════════════════════
Total Bookings: ${monthBookings.length}
Total Booking Value: ₹${monthTotalValue.toLocaleString("en-IN")}
Total Collected: ₹${monthRevenue.toLocaleString("en-IN")}
Pending Balance: ₹${monthPending.toLocaleString("en-IN")}

Booking Sources: ${sourceBreakdown || "N/A"}

═══════════════════════════════════════
TOTAL OUTSTANDING
═══════════════════════════════════════
₹${totalOutstanding.toLocaleString("en-IN")}

═══════════════════════════════════════
RECENT BOOKINGS (Last 30)
═══════════════════════════════════════
Guest Name | Room | Dates | Status | Paid/Total | Source
${bookingsList}
`;
    }

    // ═══════════════════════════════════════════════
    // ১৫. AI CONTEXT
    // ═══════════════════════════════════════════════
    const contextInfo = `
You are "Nexa AI", a smart assistant for Staynexa PMS (Property Management System).
Today: ${new Date().toLocaleDateString("en-IN")}

${hotelContext}
${actionsContext}

═══════════════════════════════════════
CRITICAL INSTRUCTIONS
═══════════════════════════════════════
1. You HAVE FULL ACCESS to ALL data above. Use it DIRECTLY.
2. NEVER say "I don't have that information" if it exists above.
3. When asked "what needs my attention" or "pending actions", LIST items from PENDING ACTIONS REQUIRED.
4. When asked about specific guest, search in RECENT BOOKINGS list.
5. When asked about revenue/collection, use THIS MONTH section.
6. When asked about rooms, use ROOM INVENTORY section.
7. When asked about today's arrivals/departures, use TODAY'S OPERATIONS.
8. When asked about specific guest, search in RECENT BOOKINGS list.
9. Format money in Indian style: ₹1,35,992 (with commas).
10. Keep answers short, professional, and helpful (1-3 sentences or a bullet list).
`;

    // ═══════════════════════════════════════════════
    // ১৬. GROQ API CALL
    // ═══════════════════════════════════════════════
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: contextInfo },
            ...messages,
          ],
          temperature: 0.3,
          max_tokens: 600,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Groq Error]", data);
      return NextResponse.json(
        { reply: "⚠ I'm having trouble connecting right now. Please try again." },
        { status: 500 }
      );
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      "I'm sorry, I couldn't process that.";
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("[AI API Error]", error);
    return NextResponse.json(
      { reply: "⚠ Something went wrong on my end." },
      { status: 500 }
    );
  }
}