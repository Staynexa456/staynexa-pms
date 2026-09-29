// app/lib/platform-admin.ts
import { supabase } from "../supabase";

export type PlatformAdmin = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

export type HotelSummary = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  owner_id: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
  is_active: boolean;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  rooms_count?: number;
  bookings_count?: number;
  total_revenue?: number;
};

// Check if logged-in user is platform admin
export async function checkPlatformAdmin(): Promise<PlatformAdmin | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("platform_admins")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (!data) return null;
    return data as PlatformAdmin;
  } catch (err) {
    console.error("[checkPlatformAdmin]", err);
    return null;
  }
}

// Fetch all hotels with stats
export async function fetchAllHotelsForAdmin(): Promise<HotelSummary[]> {
  // Get all hotels
  const { data: hotels, error: hErr } = await supabase
    .from("hotels")
    .select("*")
    .order("created_at", { ascending: false });

  if (hErr || !hotels) return [];

  // Get owner emails
  const ownerIds = [...new Set(hotels.map(h => h.owner_id).filter(Boolean))];
  let ownerMap: Record<string, { email: string; name: string }> = {};

  if (ownerIds.length > 0) {
    const { data: users } = await supabase
      .from("hotel_users")
      .select("user_id, email, name")
      .in("user_id", ownerIds)
      .eq("role", "owner");
    
    (users || []).forEach((u: any) => {
      ownerMap[u.user_id] = { email: u.email, name: u.name || "" };
    });
  }

  // Get room + booking counts for each hotel
  const hotelIds = hotels.map(h => h.id);
  
  const [roomsRes, bookingsRes, paymentsRes] = await Promise.all([
    supabase.from("rooms").select("hotel_id").in("hotel_id", hotelIds),
    supabase.from("bookings").select("hotel_id, amount, tax").in("hotel_id", hotelIds),
    supabase.from("payments").select("booking_id, amount").limit(10000),
  ]);

  const roomsCount: Record<string, number> = {};
  (roomsRes.data || []).forEach((r: any) => {
    roomsCount[r.hotel_id] = (roomsCount[r.hotel_id] || 0) + 1;
  });

  const bookingsCount: Record<string, number> = {};
  const revenueMap: Record<string, number> = {};
  (bookingsRes.data || []).forEach((b: any) => {
    bookingsCount[b.hotel_id] = (bookingsCount[b.hotel_id] || 0) + 1;
    revenueMap[b.hotel_id] = (revenueMap[b.hotel_id] || 0) + (Number(b.amount) || 0) + (Number(b.tax) || 0);
  });

  return hotels.map((h: any) => ({
    ...h,
    owner_email: h.owner_id ? ownerMap[h.owner_id]?.email || null : null,
    owner_name: h.owner_id ? ownerMap[h.owner_id]?.name || null : null,
    rooms_count: roomsCount[h.id] || 0,
    bookings_count: bookingsCount[h.id] || 0,
    total_revenue: revenueMap[h.id] || 0,
  }));
}

// Fetch owners with their hotels
export async function fetchOwnersWithHotels() {
  const { data: owners, error } = await supabase
    .from("hotel_users")
    .select("*")
    .eq("role", "owner")
    .eq("status", "active");

  if (error || !owners) return [];

  // Get hotels for each owner
  const userIds = owners.map((o: any) => o.user_id).filter(Boolean);
  
  const { data: hotels } = await supabase
    .from("hotels")
    .select("id, name, city, state, owner_id, is_active, created_at")
    .in("owner_id", userIds);

  const grouped: Record<string, any> = {};
  owners.forEach((o: any) => {
    grouped[o.user_id] = {
      user_id: o.user_id,
      email: o.email,
      name: o.name,
      phone: o.phone,
      status: o.status,
      created_at: o.created_at,
      hotels: [],
    };
  });

  (hotels || []).forEach((h: any) => {
    if (grouped[h.owner_id]) {
      grouped[h.owner_id].hotels.push(h);
    }
  });

  return Object.values(grouped);
}

// Admin: Create new hotel
export async function adminCreateHotel(payload: {
  name: string;
  owner_email: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  subscription_plan?: string;
}) {
  // Find owner by email
  const { data: existingUser } = await supabase
    .from("hotel_users")
    .select("user_id, email")
    .eq("email", payload.owner_email.toLowerCase())
    .maybeSingle();

  const { data, error } = await supabase
    .from("hotels")
    .insert({
      name: payload.name,
      slug: payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      city: payload.city || null,
      state: payload.state || null,
      phone: payload.phone || null,
      email: payload.email || payload.owner_email,
      owner_id: existingUser?.user_id || null,
      created_by_admin: true,
      is_active: true,
      subscription_plan: payload.subscription_plan || "basic",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Admin: Toggle hotel active
export async function adminToggleHotelActive(hotelId: string, active: boolean) {
  const { error } = await supabase
    .from("hotels")
    .update({ is_active: active })
    .eq("id", hotelId);
  if (error) throw error;
}

// Admin: Delete hotel
export async function adminDeleteHotel(hotelId: string) {
  const { error } = await supabase.from("hotels").delete().eq("id", hotelId);
  if (error) throw error;
}

// Admin: Fetch all payments
export async function fetchAllPayments() {
  const { data, error } = await supabase
    .from("payments")
    .select(`
      *,
      booking:bookings!booking_id (
        booking_ref, hotel_id, amount, tax,
        hotel:hotels!hotel_id (name, city),
        guest:guests!primary_guest_id (name, phone)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return [];
  return data || [];
}
