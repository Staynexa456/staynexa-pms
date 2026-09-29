// app/lib/use-user-role.ts
"use client";

import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import type { UserRole, Permission } from "./roles";
import { hasPermission as checkPermission } from "./roles";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  hotelId: string;
  permissions: Permission[];
};

export function useUserRole() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setLoading(false);
          return;
        }

        // Try localStorage hotel first
        let hotelId = "";
        if (typeof window !== "undefined") {
          hotelId = localStorage.getItem("selected_hotel_id") || "";
        }

        // Find user's role for this hotel
        let query = supabase
          .from("hotel_users")
          .select("*")
          .eq("user_id", authUser.id)
          .eq("status", "active");

        if (hotelId) {
          query = query.eq("hotel_id", hotelId);
        }

        const { data: memberships } = await query.limit(1);

        if (memberships && memberships.length > 0) {
          const m = memberships[0];
          setUser({
            id: authUser.id,
            email: authUser.email || "",
            name: m.name || authUser.email?.split("@")[0] || "",
            role: m.role,
            hotelId: m.hotel_id,
            permissions: [],
          });
        } else {
          // Fallback: check if user is hotel owner
          const { data: ownedHotels } = await supabase
            .from("hotels")
            .select("id")
            .eq("owner_id", authUser.id)
            .limit(1);

          if (ownedHotels && ownedHotels.length > 0) {
            setUser({
              id: authUser.id,
              email: authUser.email || "",
              name: authUser.user_metadata?.full_name || "Owner",
              role: "owner",
              hotelId: ownedHotels[0].id,
              permissions: [],
            });
          }
        }
      } catch (err) {
        console.error("[useUserRole]", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const can = (permission: Permission): boolean => {
    return checkPermission(user?.role, permission);
  };

  return { user, loading, can };
}
