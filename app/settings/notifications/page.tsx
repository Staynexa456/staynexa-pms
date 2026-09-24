"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useActiveHotel } from "../../lib/use-active-hotel";
import {
  fetchTemplates,
  fetchNotificationLog,
  upsertTemplate,
  defaultTemplates,
  renderTemplate,
  EVENT_LABELS,
  CHANNEL_LABELS,
  type NotificationTemplate,
  type NotificationLog,
  type NotificationEvent,
  type NotificationChannel,
} from "../../lib/notifications";
import SettingsLayout from "../../components/settings/SettingsLayout";

const PREVIEW_VARS = {
  guest_name: "John Doe",
  guest_phone: "+91 98765 43210",
  guest_email: "john@example.com",
  booking_ref: "SNB-2609-ABCD",
  room_type: "Deluxe Room",
  room_number: "101",
  check_in: "2026-10-15",
  check_out: "2026-10-17",
  nights: "2",
  total: "6,200",
  hotel_name: "Vishara Elite Hotel",
  hotel_phone: "+91 6367696367",
};

export default function NotificationsPage() {
  const { hotelId, hotel, loading: hotelLoading } = useActiveHotel() as any;
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"templates" | "log">("templates");
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    if (!hotelId) { setLoading(false); return; }
    try {
      setLoading(true);
      let tpls = await fetchTemplates(hotelId);

      if (tpls.length === 0) {
        const hotelName = hotel?.name || "Your Hotel";
        const defaults = defaultTemplates(hotelId, hotelName);
        for (const d of defaults) {
          await upsertTemplate(hotelId, d);
        }
        tpls = await fetchTemplates(hotelId);
      }

      setTemplates(tpls);

      const logData = await fetchNotificationLog(hotelId, 50);
      setLogs(logData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [hotelId, hotel]);

  useEffect(() => {
    if (hotelLoading) return;
    load();
  }, [load, hotelLoading]);

  const handleSave = async (data: NotificationTemplate) => {
    if (!hotelId) return;
    try {
      await upsertTemplate(hotelId, data);
      showToast("✅ Template saved");
      setEditing(null);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message || "Failed to save"}`);
    }
  };

  const handleToggle = async (tpl: NotificationTemplate) => {
    if (!hotelId) return;
    try {
      await upsertTemplate(hotelId, { ...tpl, is_active: !tpl.is_active });
      showToast(`✓ ${tpl.is_active ? "Disabled" : "Enabled"}`);
      await load();
    } catch (err: any) {
      showToast(`⚠ ${err?.message}`);
    }
  };

  const handleAddTemplate = () => {
    setEditing({
      hotel_id: hotelId || "",
      event_type: "booking_created",
      channel: "email",
      subject: "",
      body: "",
      is_active: true,
    });
  };

  if (hotelLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Notifications"
      subtitle="Email, WhatsApp, and SMS to guests and staff"
      icon="🔔"
    >
      <div className="flex items-center gap-2 mb-5 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === "templates"
              ? "border-teal-500 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          📝 Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab("log")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === "log"
              ? "border-teal-500 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          📨 Sent Log ({logs.length})
        </button>
      </div>

      {activeTab === "templates" && (
        <>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Message Templates</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize messages sent on different events
              </p>
            </div>
            <button
              onClick={handleAddTemplate}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2"
            >
              <span>+</span> New Template
            </button>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <p className="text-sm font-bold text-blue-800">Available Variables</p>
              <p className="text-xs text-blue-700 mt-0.5 font-mono leading-relaxed">
                {Object.keys(PREVIEW_VARS).map((v) => `{{${v}}}`).join(", ")}
              </p>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <p className="text-5xl mb-3">📝</p>
              <p className="font-bold text-slate-700">No templates yet</p>
              <p className="text-sm text-slate-500 mt-1">Click "New Template" to create one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((tpl) => {
                const eventInfo = EVENT_LABELS[tpl.event_type];
                const channelInfo = CHANNEL_LABELS[tpl.channel];
                return (
                  <div
                    key={tpl.id || `${tpl.event_type}-${tpl.channel}`}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden"
                  >
                    <div className="p-5 flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-2xl shrink-0">
                        {eventInfo?.icon || "🔔"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-base font-bold text-slate-900">
                            {eventInfo?.label || tpl.event_type}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                            {channelInfo?.icon} {channelInfo?.label || tpl.channel}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            tpl.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {tpl.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {tpl.subject && (
                          <p className="text-xs text-slate-500 mt-1">
                            <strong>Subject:</strong> {tpl.subject}
                          </p>
                        )}
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2 whitespace-pre-wrap">
                          {tpl.body.slice(0, 150)}
                          {tpl.body.length > 150 && "..."}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleToggle(tpl)}
                          className="w-8 h-8 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 flex items-center justify-center transition"
                          title={tpl.is_active ? "Disable" : "Enable"}
                        >
                          {tpl.is_active ? "🔒" : "🔓"}
                        </button>
                        <button
                          onClick={() => setEditing(tpl)}
                          className="w-8 h-8 rounded-lg hover:bg-teal-50 text-slate-500 hover:text-teal-600 flex items-center justify-center transition"
                          title="Edit"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "log" && (
        <>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">Sent Notifications</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Last 50 notifications across all channels
            </p>
          </div>

          {logs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <p className="text-5xl mb-3">📨</p>
              <p className="font-bold text-slate-700">No notifications sent yet</p>
              <p className="text-sm text-slate-500 mt-1">Notifications will appear here after bookings</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Event</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Channel</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recipient</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const eventInfo = EVENT_LABELS[log.event_type];
                    const channelInfo = CHANNEL_LABELS[log.channel];
                    const statusColors = {
                      pending: "bg-amber-100 text-amber-700",
                      sent: "bg-emerald-100 text-emerald-700",
                      failed: "bg-rose-100 text-rose-700",
                    };
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3 text-xs font-semibold text-slate-700">
                          {eventInfo?.icon} {eventInfo?.label || log.event_type}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600">
                          {channelInfo?.icon} {channelInfo?.label}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600 font-mono truncate max-w-[200px]">
                          {log.recipient}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${statusColors[log.status]}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-[10px] text-slate-500">
                          {log.created_at ? new Date(log.created_at).toLocaleString("en-IN") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && (
        <TemplateModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-semibold z-[100] shadow-2xl">
          {toast}
        </div>
      )}
    </SettingsLayout>
  );
}

function TemplateModal({
  initial,
  onClose,
  onSave,
}: {
  initial: NotificationTemplate;
  onClose: () => void;
  onSave: (data: NotificationTemplate) => Promise<void>;
}) {
  const [data, setData] = useState<NotificationTemplate>(initial);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const update = (patch: Partial<NotificationTemplate>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    if (!data.body.trim()) {
      alert("Message body required");
      return;
    }
    setSaving(true);
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  const preview = showPreview ? renderTemplate(data.body, PREVIEW_VARS) : data.body;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl">
              📝
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Template</h3>
              <p className="text-slate-300 text-xs mt-0.5">
                {initial.id ? "Edit template" : "Create a new template"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-3xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Event
            </label>
            <select
              value={data.event_type}
              onChange={(e) => update({ event_type: e.target.value as NotificationEvent })}
              disabled={!!initial.id}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500 bg-white disabled:bg-slate-50"
            >
              {Object.entries(EVENT_LABELS).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.icon} {info.label} — {info.desc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Channel
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(CHANNEL_LABELS).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ channel: key as NotificationChannel })}
                  disabled={!!initial.id}
                  className={`px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                    data.channel === key
                      ? "bg-slate-900 text-white shadow-lg"
                      : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>{info.icon}</span> {info.label}
                </button>
              ))}
            </div>
          </div>

          {data.channel === "email" && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Subject
              </label>
              <input
                type="text"
                value={data.subject || ""}
                onChange={(e) => update({ subject: e.target.value })}
                placeholder="e.g., Booking Confirmed at {{hotel_name}}"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-teal-500"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Message Body
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-[10px] font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider"
              >
                {showPreview ? "← Edit" : "Preview →"}
              </button>
            </div>
            {showPreview ? (
              <div className="w-full px-4 py-3 border border-teal-300 bg-teal-50 rounded-xl text-sm whitespace-pre-wrap min-h-[200px]">
                {preview}
              </div>
            ) : (
              <textarea
                value={data.body}
                onChange={(e) => update({ body: e.target.value })}
                rows={10}
                placeholder="Hi {{guest_name}}, your booking {{booking_ref}} is confirmed..."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-none outline-none focus:border-teal-500 font-mono"
              />
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Click to insert:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PREVIEW_VARS).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update({ body: data.body + `{{${v}}}` })}
                  className="text-[10px] font-mono px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">Active</p>
              <p className="text-[10px] text-slate-500">Enable sending this notification</p>
            </div>
            <input
              type="checkbox"
              checked={data.is_active}
              onChange={(e) => update({ is_active: e.target.checked })}
              className="w-5 h-5 accent-teal-600"
            />
          </label>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !data.body.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : initial.id ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}