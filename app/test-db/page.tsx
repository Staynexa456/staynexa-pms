"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

type Room = {
  id: string;
  room_number: string;
  room_type: string;
  floor: number | null;
  rate_plan: string | null;
  base_price: number | null;
  status: string;
};

type Hotel = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

export default function TestDbPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<{ url: string; key: string }>({
    url: "not loaded",
    key: "not loaded",
  });

  useEffect(() => {
    // Show what env values are visible to the browser
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING";
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "MISSING";
    setEnvInfo({
      url: url === "MISSING" ? "MISSING" : url.slice(0, 40) + "...",
      key: key === "MISSING" ? "MISSING" : key.slice(0, 30) + "...",
    });

    (async () => {
      try {
        console.log("Supabase URL from client:", url);
        console.log("Supabase key prefix:", key.slice(0, 25));

        const { data: roomsData, error: roomsError } = await supabase
          .from("rooms")
          .select("*")
          .order("room_number", { ascending: true });

        if (roomsError) throw roomsError;

        const { data: hotelData, error: hotelError } = await supabase
          .from("hotels")
          .select("*")
          .limit(1)
          .single();

        if (hotelError) throw hotelError;

        setRooms((roomsData as Room[]) || []);
        setHotel(hotelData as Hotel);
      } catch (err: unknown) {
        console.error("Supabase error:", err);
        let msg = "Unknown error";
        if (err && typeof err === "object") {
          const e = err as { message?: string; code?: string; details?: string; hint?: string };
          msg = [
            e.message ? `message: ${e.message}` : null,
            e.code ? `code: ${e.code}` : null,
            e.details ? `details: ${e.details}` : null,
            e.hint ? `hint: ${e.hint}` : null,
          ]
            .filter(Boolean)
            .join(" | ");
          if (!msg) msg = JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
        } else {
          msg = String(err);
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="font-serif text-3xl font-semibold text-navy mb-2">
        🔌 Supabase Connection Test
      </h1>
      <p className="text-muted text-sm mb-8">
        This page proves your app is reading real data from Supabase.
      </p>

      {/* ENV INFO */}
      <div className="bg-cream/40 border border-cream-dark rounded-xl p-4 mb-6 text-xs">
        <p className="text-muted uppercase tracking-wide font-semibold mb-2">
          Environment Variables Detected
        </p>
        <p className="font-mono text-navy">
          <span className="text-muted">URL:</span> {envInfo.url}
        </p>
        <p className="font-mono text-navy">
          <span className="text-muted">KEY:</span> {envInfo.key}
        </p>
      </div>

      {loading && (
        <div className="bg-cream/40 border border-cream-dark rounded-xl p-6 text-center">
          <p className="text-navy font-medium">⏳ Loading from database…</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-6">
          <p className="text-rose-700 font-semibold mb-3">❌ Connection failed</p>
          <pre className="bg-white border border-rose-200 rounded-lg p-4 text-xs text-rose-700 whitespace-pre-wrap break-all font-mono">
{error}
          </pre>
          <div className="mt-4 text-xs text-rose-700">
            <p className="font-semibold mb-2">Check:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Env vars show correctly above (not "MISSING")</li>
              <li>Tables exist in Supabase: rooms, hotels</li>
              <li>RLS is disabled on those tables</li>
              <li>Vercel deployed the latest commit</li>
            </ul>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {hotel && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 mb-6">
              <p className="text-xs uppercase tracking-widest text-emerald-700 font-semibold">
                ✅ Connected to Hotel
              </p>
              <h2 className="font-serif text-2xl font-semibold text-navy mt-1">
                {hotel.name}
              </h2>
              <p className="text-sm text-emerald-700">
                {hotel.city}, {hotel.state}
              </p>
            </div>
          )}

          <div className="bg-white border border-cream-dark rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-cream-dark bg-cream/40 flex justify-between items-center">
              <h3 className="font-serif text-lg font-semibold text-navy">
                Rooms from Database
              </h3>
              <span className="text-xs bg-emerald-500 text-white px-2.5 py-1 rounded-full font-semibold">
                {rooms.length} rooms
              </span>
            </div>

            <table className="w-full">
              <thead>
                <tr className="bg-navy text-cream">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                    Room #
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                    Floor
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                    Base Price
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-cream-dark last:border-b-0 hover:bg-cream/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-sm font-bold text-navy">
                      {r.room_number}
                    </td>
                    <td className="px-5 py-3 text-sm text-navy/80">
                      {r.room_type}
                    </td>
                    <td className="px-5 py-3 text-sm text-center text-navy/80">
                      {r.floor ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-center text-navy/80">
                      {r.rate_plan ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-right font-semibold text-navy">
                      ₹{r.base_price?.toLocaleString("en-IN") ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 bg-gold/10 border border-gold/30 rounded-xl p-5">
            <p className="text-sm text-navy">
              🎉 <span className="font-semibold">It works!</span> Your app is reading
              live data from Supabase. Next step: replace hardcoded bookings with
              real database records.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
