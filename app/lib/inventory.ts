// app/lib/inventory.ts
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export type RoomStatus = "CLEAN" | "DIRTY" | "INSPECTED" | "MAINTENANCE";

export type InventoryRoom = {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  base_price: number;
  housekeeping_status: RoomStatus;
  housekeeping_notes?: string;
  last_cleaned_at?: string;
  last_cleaned_by?: string;
  is_active: boolean;
  created_at?: string;
};

export type RoomTypeSummary = {
  type: string;
  count: number;
  basePrice: number;
  clean: number;
  dirty: number;
  inspected: number;
  maintenance: number;
};

export type InventoryStats = {
  totalRooms: number;
  clean: number;
  dirty: number;
  inspected: number;
  maintenance: number;
  totalRoomTypes: number;
  avgBasePrice: number;
};

// ═══════════════════════════════════════════════
// FETCH
// ═══════════════════════════════════════════════

export async function fetchInventory(hotelId: string): Promise<InventoryRoom[]> {
  if (!hotelId) return [];
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("room_number");

  if (error) {
    console.error("[fetchInventory]", error);
    return [];
  }
  return (data || []) as InventoryRoom[];
}

// ═══════════════════════════════════════════════
// CREATE
// ═══════════════════════════════════════════════

export async function createRoom(payload: {
  hotel_id: string;
  room_number: string;
  room_type: string;
  base_price: number;
}): Promise<InventoryRoom> {
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      hotel_id: payload.hotel_id,
      room_number: payload.room_number.trim(),
      room_type: payload.room_type.trim(),
      base_price: payload.base_price,
      housekeeping_status: "CLEAN",
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("[createRoom]", error);
    throw error;
  }
  return data as InventoryRoom;
}

// ═══════════════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════════════

export async function updateRoom(
  roomId: string,
  updates: Partial<InventoryRoom>
): Promise<void> {
  const cleanUpdates: Record<string, any> = {};
  ["room_number", "room_type", "base_price", "housekeeping_status", "housekeeping_notes", "is_active"].forEach((k) => {
    if ((updates as any)[k] !== undefined) {
      cleanUpdates[k] = (updates as any)[k];
    }
  });

  if (Object.keys(cleanUpdates).length === 0) return;

  const { error } = await supabase
    .from("rooms")
    .update(cleanUpdates)
    .eq("id", roomId);

  if (error) {
    console.error("[updateRoom]", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════

export async function deleteRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) {
    console.error("[deleteRoom]", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════════

export async function bulkUpdateBasePrice(
  hotelId: string,
  roomType: string,
  newPrice: number
): Promise<void> {
  const { error } = await supabase
    .from("rooms")
    .update({ base_price: newPrice })
    .eq("hotel_id", hotelId)
    .eq("room_type", roomType);

  if (error) {
    console.error("[bulkUpdateBasePrice]", error);
    throw error;
  }
}

export async function bulkUpdateStatus(
  roomIds: string[],
  status: RoomStatus
): Promise<void> {
  if (roomIds.length === 0) return;
  const { error } = await supabase
    .from("rooms")
    .update({
      housekeeping_status: status,
      last_cleaned_at:
        status === "CLEAN" || status === "INSPECTED"
          ? new Date().toISOString()
          : null,
    })
    .in("id", roomIds);

  if (error) {
    console.error("[bulkUpdateStatus]", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════
// COMPUTED
// ═══════════════════════════════════════════════

export function computeStats(rooms: InventoryRoom[]): InventoryStats {
  const totalRooms = rooms.length;
  const clean = rooms.filter((r) => r.housekeeping_status === "CLEAN").length;
  const dirty = rooms.filter((r) => r.housekeeping_status === "DIRTY").length;
  const inspected = rooms.filter((r) => r.housekeeping_status === "INSPECTED").length;
  const maintenance = rooms.filter((r) => r.housekeeping_status === "MAINTENANCE").length;
  const types = new Set(rooms.map((r) => r.room_type || "Standard"));

  const avgBasePrice =
    totalRooms > 0
      ? rooms.reduce((s, r) => s + (Number(r.base_price) || 0), 0) / totalRooms
      : 0;

  return {
    totalRooms,
    clean,
    dirty,
    inspected,
    maintenance,
    totalRoomTypes: types.size,
    avgBasePrice,
  };
}

export function computeRoomTypeSummary(
  rooms: InventoryRoom[]
): RoomTypeSummary[] {
  const map = new Map<string, RoomTypeSummary>();
  rooms.forEach((r) => {
    const type = r.room_type || "Standard";
    if (!map.has(type)) {
      map.set(type, {
        type,
        count: 0,
        basePrice: Number(r.base_price) || 0,
        clean: 0,
        dirty: 0,
        inspected: 0,
        maintenance: 0,
      });
    }
    const entry = map.get(type)!;
    entry.count += 1;
    if (r.housekeeping_status === "CLEAN") entry.clean += 1;
    else if (r.housekeeping_status === "DIRTY") entry.dirty += 1;
    else if (r.housekeeping_status === "INSPECTED") entry.inspected += 1;
    else if (r.housekeeping_status === "MAINTENANCE") entry.maintenance += 1;
  });
  return Array.from(map.values()).sort((a, b) => a.type.localeCompare(b.type));
}

export function getStatusColor(status: RoomStatus) {
  switch (status) {
    case "CLEAN":
      return {
        bg: "bg-emerald-100",
        text: "text-emerald-700",
        border: "border-emerald-300",
        dot: "bg-emerald-500",
        icon: "✓",
      };
    case "DIRTY":
      return {
        bg: "bg-rose-100",
        text: "text-rose-700",
        border: "border-rose-300",
        dot: "bg-rose-500",
        icon: "🧹",
      };
    case "INSPECTED":
      return {
        bg: "bg-sky-100",
        text: "text-sky-700",
        border: "border-sky-300",
        dot: "bg-sky-500",
        icon: "🔍",
      };
    case "MAINTENANCE":
      return {
        bg: "bg-amber-100",
        text: "text-amber-700",
        border: "border-amber-300",
        dot: "bg-amber-500",
        icon: "🔧",
      };
    default:
      return {
        bg: "bg-slate-100",
        text: "text-slate-600",
        border: "border-slate-300",
        dot: "bg-slate-400",
        icon: "?",
      };
  }
}