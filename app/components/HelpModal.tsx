"use client";

import React from "react";

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">❓ Help & Support</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl transition">×</button>
        </div>
        
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Frequently Asked Questions</h3>
              <div className="space-y-3">
                {[
                  { q: "How do I check-in a guest?", a: "Open the Calendar, click on the guest's booking bar, and click the 'Check-In Guest' button." },
                  { q: "How do I add an addon?", a: "Open the Folio for a booking, click on 'More Actions', and select 'Add Hotel Addons'." },
                  { q: "How do I view reports?", a: "Go to the Reports Hub from the sidebar, select a category, and click on a report to view." },
                  { q: "How do I change room rates?", a: "Go to Inventory & Rates from the sidebar, select your date range, and update the rates in the grid." },
                  { q: "How do I block a room?", a: "Click on the '+ Create' button in the Calendar, and select 'Block Room'." },
                ].map((faq, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-slate-300 transition">
                    <p className="font-semibold text-slate-800 text-sm">Q: {faq.q}</p>
                    <p className="text-slate-500 text-xs mt-1">A: {faq.a}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Need more help?</h3>
              <div className="flex gap-4">
                <a href="mailto:support@staynexa.in" className="flex-1 bg-teal-50 border border-teal-200 text-teal-700 px-4 py-3 rounded-xl text-center text-sm font-semibold hover:bg-teal-100 transition flex items-center justify-center gap-2">
                  📧 Email Support
                </a>
                <a href="https://wa.me/919999999999" target="_blank" className="flex-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-center text-sm font-semibold hover:bg-emerald-100 transition flex items-center justify-center gap-2">
                  💬 WhatsApp Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}