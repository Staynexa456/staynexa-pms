// ═══════════════════════════════════════════════════════════
// MULTI-PROPERTY FUNCTIONS
// ═══════════════════════════════════════════════════════════

export type Hotel = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  timezone: string | null;
  currency: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  is_active: boolean | null;
  owner_id: string | null;
  created_at: string | null;
};

// Get all hotels for current user
export async function getUserHotels(): Promise<Hotel[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getUserHotels error:", error);
    return [];
  }

  return (data || []) as Hotel[];
}

// Get a specific hotel by ID
export async function getHotelById(hotelId: string): Promise<Hotel | null> {
  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .eq("id", hotelId)
    .single();

  if (error) {
    console.error("getHotelById error:", error);
    return null;
  }

  return data as Hotel;
}

// Create a new hotel for current user
export async function createHotel(params: {
  name: string;
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
  email?: string;
  gst_number?: string;
}): Promise<Hotel> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");

  const slug = params.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    + "-"
    + Date.now().toString(36);

  const { data, error } = await supabase
    .from("hotels")
    .insert({
      name: params.name,
      slug,
      city: params.city || null,
      state: params.state || null,
      address: params.address || null,
      phone: params.phone || null,
      email: params.email || null,
      gst_number: params.gst_number || null,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Create default rooms for the new property
  const defaultRooms = [
    { room_number: "101", room_type: "Standard Room", floor: 1, rate_plan: "EP", base_price: 2500 },
    { room_number: "102", room_type: "Standard Room", floor: 1, rate_plan: "EP", base_price: 2500 },
    { room_number: "201", room_type: "Deluxe Room", floor: 2, rate_plan: "EP", base_price: 3500 },
    { room_number: "202", room_type: "Deluxe Room", floor: 2, rate_plan: "EP", base_price: 3500 },
    { room_number: "301", room_type: "Suite", floor: 3, rate_plan: "EP", base_price: 5000 },
  ];

  await supabase.from("rooms").insert(
    defaultRooms.map((r) => ({
      ...r,
      hotel_id: data.id,
      owner_id: user.id,
    }))
  );

  return data as Hotel;
}

// Update hotel details
export async function updateHotel(
  hotelId: string,
  patch: Partial<{
    name: string;
    city: string;
    state: string;
    address: string;
    phone: string;
    email: string;
    gst_number: string;
    timezone: string;
    currency: string;
    check_in_time: string;
    check_out_time: string;
  }>
): Promise<void> {
  const { error } = await supabase
    .from("hotels")
    .update(patch)
    .eq("id", hotelId);
  if (error) throw error;
}

// Deactivate (soft-delete) a hotel
export async function deactivateHotel(hotelId: string): Promise<void> {
  const { error } = await supabase
    .from("hotels")
    .update({ is_active: false })
    .eq("id", hotelId);
  if (error) throw error;
}
