// app/settings/users/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabase";
import {
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type UserRole,
  type HotelUser,
} from "../../lib/roles";

export default function UsersManagementPage() {
  const [hotelId, setHotelId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("receptionist");
  const [users, setUsers] = useState<HotelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModal, setInviteModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("receptionist");
  const [inviting, setInviting] = useState(false);

  // ═══════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════
  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // Get hotel ID
      let hId = "";
      if (typeof window !== "undefined") {
        hId = localStorage.getItem("selected_hotel_id") || "";
      }

      if (!hId) {
        const { data: ownedHotels } = await supabase
          .from("hotels")
          .select("id")
          .eq("owner_id", user.id)
          .limit(1);
        if (ownedHotels && ownedHotels.length > 0) {
          hId = ownedHotels[0].id;
        }
      }

      if (!hId) {
        setLoading(false);
        return;
      }

      setHotelId(hId);

      // Get current user's role
      const { data: myMembership } = await supabase
        .from("hotel_users")
        .select("role")
        .eq("hotel_id", hId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (myMembership) {
        setCurrentUserRole(myMembership.role);
      }

      // Get all users for this hotel
      const { data: hotelUsers } = await supabase
        .from("hotel_users")
        .select("*")
        .eq("hotel_id", hId)
        .order("role")
        .order("created_at");

      setUsers(hotelUsers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ═══════════════════════════════════════════════
  // INVITE USER
  // ═══════════════════════════════════════════════
  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setMessage("⚠️ Email required");
      return;
    }
    if (!inviteEmail.includes("@")) {
      setMessage("⚠️ Invalid email");
      return;
    }

    setInviting(true);
    setMessage(null);

    try {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);

      // Check if user already exists
      const { data: existing } = await supabase
        .from("hotel_users")
        .select("id, status")
        .eq("hotel_id", hotelId)
        .eq("email", inviteEmail.toLowerCase())
        .maybeSingle();

      if (existing) {
        if (existing.status === "active") {
          setMessage("⚠️ This user is already a team member");
          setInviting(false);
          return;
        }
        // Reactivate
        await supabase
          .from("hotel_users")
          .update({
            role: inviteRole,
            name: inviteName.trim() || null,
            phone: invitePhone.trim() || null,
            status: "pending",
            invite_token: token,
            invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // New invite
        await supabase.from("hotel_users").insert({
          hotel_id: hotelId,
          email: inviteEmail.toLowerCase(),
          name: inviteName.trim() || null,
          phone: invitePhone.trim() || null,
          role: inviteRole,
          status: "pending",
          invite_token: token,
          invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Send invite email
      try {
        const { data: hotel } = await supabase
          .from("hotels")
          .select("name")
          .eq("id", hotelId)
          .single();

        const inviteUrl = `${window.location.origin}/accept-invite?token=${token}`;

        await fetch("/api/send-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inviteEmail.toLowerCase(),
            name: inviteName.trim(),
            role: inviteRole,
            hotelName: hotel?.name || "Hotel",
            inviteUrl,
          }),
        });
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
      }

      setMessage(`✓ Invitation sent to ${inviteEmail}`);
      setInviteModal(false);
      setInviteEmail("");
      setInviteName("");
      setInvitePhone("");
      setInviteRole("receptionist");
      await load();
    } catch (err: any) {
      setMessage(`⚠️ Error: ${err.message}`);
    } finally {
      setInviting(false);
    }
  };

  // ═══════════════════════════════════════════════
  // CHANGE ROLE
  // ═══════════════════════════════════════════════
  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (newRole === "owner" && currentUserRole !== "owner") {
      setMessage("⚠️ Only owner can assign owner role");
      return;
    }

    const targetUser = users.find((u) => u.id === userId);
    if (targetUser?.role === "owner") {
      setMessage("⚠️ Cannot change owner's role");
      return;
    }

    try {
      await supabase
        .from("hotel_users")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", userId);
      setMessage(`✓ Role updated to ${ROLE_LABELS[newRole].label}`);
      await load();
    } catch (err: any) {
      setMessage(`⚠️ Error: ${err.message}`);
    }
  };

  // ═══════════════════════════════════════════════
  // REVOKE ACCESS
  // ═══════════════════════════════════════════════
  const handleRevoke = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser?.role === "owner") {
      setMessage("⚠️ Cannot revoke owner access");
      return;
    }
    if (targetUser?.user_id === currentUserId) {
      setMessage("⚠️ Cannot revoke your own access");
      return;
    }

    if (!confirm("Revoke this user's access?")) return;

    try {
      await supabase
        .from("hotel_users")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", userId);
      setMessage("✓ Access revoked");
      await load();
    } catch (err: any) {
      setMessage(`⚠️ Error: ${err.message}`);
    }
  };

  // ═══════════════════════════════════════════════
  // REACTIVATE
  // ═══════════════════════════════════════════════
  const handleReactivate = async (userId: string) => {
    try {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await supabase
        .from("hotel_users")
        .update({
          status: "pending",
          invite_token: token,
          invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      setMessage("✓ Access restored");
      await load();
    } catch (err: any) {
      setMessage(`⚠️ Error: ${err.message}`);
    }
  };

  // ═══════════════════════════════════════════════
  // RESEND INVITE
  // ═══════════════════════════════════════════════
  const handleResend = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    try {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await supabase
        .from("hotel_users")
        .update({
          invite_token: token,
          invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      const { data: hotel } = await supabase
        .from("hotels")
        .select("name")
        .eq("id", hotelId)
        .single();

      const inviteUrl = `${window.location.origin}/accept-invite?token=${token}`;

      await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          hotelName: hotel?.name || "Hotel",
          inviteUrl,
        }),
      });

      setMessage(`✓ Invitation resent to ${targetUser.email}`);
      await load();
    } catch (err: any) {
      setMessage(`⚠️ Error: ${err.message}`);
    }
  };

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Users & Permissions</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your hotel staff and their access levels
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setInviteModal(true)}
              className="px-5 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition flex items-center gap-2 shadow-lg"
            >
              + Invite User
            </button>
          )}
        </div>

        {/* MESSAGE */}
        {message && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-bold ${
            message.startsWith("✓")
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}>
            {message}
          </div>
        )}

        {/* ROLE LEGEND */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Roles & Access Levels</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(ROLE_LABELS).map(([key, val]) => (
              <div key={key} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{val.icon}</span>
                  <span className="text-xs font-bold text-slate-800">{val.label}</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* USERS LIST */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">
              Team Members ({users.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {users.map((user) => {
              const roleInfo = ROLE_LABELS[user.role];
              const isOwner = user.role === "owner";
              const isSelf = user.user_id === currentUserId;

              return (
                <div key={user.id} className="p-5 flex items-center justify-between gap-4 flex-wrap">
                  {/* Left: Avatar + Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-[250px]">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-md ${
                      roleInfo.color === "purple" ? "bg-purple-100 text-purple-700" :
                      roleInfo.color === "blue" ? "bg-blue-100 text-blue-700" :
                      roleInfo.color === "teal" ? "bg-teal-100 text-teal-700" :
                      roleInfo.color === "amber" ? "bg-amber-100 text-amber-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {roleInfo.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {user.name || user.email.split("@")[0]}
                        </p>
                        {isSelf && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            YOU
                          </span>
                        )}
                        {user.status === "pending" && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            PENDING
                          </span>
                        )}
                        {user.status === "revoked" && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            REVOKED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      {user.phone && <p className="text-xs text-slate-400">{user.phone}</p>}
                    </div>
                  </div>

                  {/* Center: Role */}
                  <div className="flex items-center gap-3">
                    {canManage && !isOwner && user.status === "active" ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeRole(user.id, e.target.value as UserRole)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-teal-500"
                      >
                        {Object.entries(ROLE_LABELS).map(([key, val]) => (
                          <option key={key} value={key}>{val.icon} {val.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                        roleInfo.color === "purple" ? "bg-purple-100 text-purple-700" :
                        roleInfo.color === "blue" ? "bg-blue-100 text-blue-700" :
                        roleInfo.color === "teal" ? "bg-teal-100 text-teal-700" :
                        roleInfo.color === "amber" ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {roleInfo.icon} {roleInfo.label}
                      </span>
                    )}
                  </div>

                  {/* Right: Actions */}
                  {canManage && !isOwner && !isSelf && (
                    <div className="flex items-center gap-2">
                      {user.status === "active" && (
                        <button
                          onClick={() => handleRevoke(user.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                        >
                          Revoke
                        </button>
                      )}
                      {user.status === "pending" && (
                        <button
                          onClick={() => handleResend(user.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-teal-600 hover:bg-teal-50 transition"
                        >
                          Resend Invite
                        </button>
                      )}
                      {user.status === "revoked" && (
                        <button
                          onClick={() => handleReactivate(user.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PERMISSION MATRIX */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">Permission Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase tracking-wider">Permission</th>
                  {Object.entries(ROLE_LABELS).map(([key, val]) => (
                    <th key={key} className="text-center py-3 px-2 font-bold text-slate-500 uppercase tracking-wider">
                      {val.icon} {val.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "view_dashboard", label: "View Dashboard" },
                  { key: "manage_bookings", label: "Manage Bookings" },
                  { key: "checkin_checkout", label: "Check-in / Check-out" },
                  { key: "manage_payments", label: "Manage Payments" },
                  { key: "manage_housekeeping", label: "Housekeeping" },
                  { key: "manage_rates", label: "Manage Rates" },
                  { key: "manage_rooms", label: "Manage Rooms" },
                  { key: "view_reports", label: "View Reports" },
                  { key: "manage_users", label: "Manage Users" },
                  { key: "manage_settings", label: "Manage Settings" },
                  { key: "manage_hotel", label: "Manage Hotel" },
                  { key: "manage_channel", label: "Channel Manager" },
                ].map((row) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="py-2.5 px-2 font-semibold text-slate-700">{row.label}</td>
                    {Object.keys(ROLE_LABELS).map((roleKey) => {
                      const has = ROLE_PERMISSIONS[roleKey as UserRole].includes(row.key as any);
                      return (
                        <td key={roleKey} className="text-center py-2.5 px-2">
                          {has ? (
                            <span className="text-emerald-500 text-base">✓</span>
                          ) : (
                            <span className="text-slate-300 text-base">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* INVITE MODAL */}
      {inviteModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Invite Team Member</h3>
                <p className="text-xs text-slate-500">Send an invitation link</p>
              </div>
              <button onClick={() => setInviteModal(false)} className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-slate-400">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-2">Email *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-2">Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-2">Phone</label>
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-2">Role *</label>
                <div className="space-y-2">
                  {Object.entries(ROLE_LABELS).filter(([k]) => k !== "owner").map(([key, val]) => (
                    <label
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                        inviteRole === key ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="invite_role"
                        checked={inviteRole === key}
                        onChange={() => setInviteRole(key as UserRole)}
                        className="w-4 h-4"
                      />
                      <span className="text-lg">{val.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{val.label}</p>
                        <p className="text-[10px] text-slate-500">{val.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-slate-50 flex gap-3">
              <button
                onClick={() => setInviteModal(false)}
                className="px-5 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-teal-700 disabled:opacity-50"
              >
                {inviting ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
