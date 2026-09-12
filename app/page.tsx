"use client";

import React, { useState } from "react";

// --- TYPES ---
type StatKey =
  | "newBookings"
  | "inHouse"
  | "arrivals"
  | "departures"
  | "cancellations"
  | "onHold"
  | "noShows"
  | "magicLink";

type Stat = {
  key: StatKey;
  label: string;
  value: number;
  color: string;
  options: string[];
};

// --- STATS DATA ---
const statsData: Stat[] = [
  { key: "newBookings", label: "New bookings", value: 17, color: "border-t-teal-300", options: ["All", "Today", "This Week", "This Month"] },
  { key: "inHouse", label: "In-house", value: 52, color: "border-t-green-300", options: ["All", "Checked In", "Due Out Today"] },
  { key: "arrivals", label: "Arrivals", value: 35, color: "border-t-yellow-300", options: ["All", "Pending Arrival", "Arrival In House"] },
  { key: "departures", label: "Departures", value: 35, color: "border-t-indigo-400", options: ["ALL", "Pending Departure", "Checked-out"] },
  { key: "cancellations", label: "Cancellations", value: 4, color: "border-t-red-400", options: ["Cancelled today", "Cancelled for today"] },
  { key: "onHold", label: "On hold", value: 0, color: "border-t-slate-500", options: ["All", "Pending Payment"] },
  { key: "noShows", label: "No shows", value: 0, color: "border-t-gray-300", options: ["All", "Today"] },
  { key: "magicLink", label: "Magic link", value: 0, color: "border-t-pink-300", options: ["All", "Sent", "Used"] },
];

// --- BOOKINGS DATA ---
const bookingsData = [
  { guest: "Vinay Verma", phone: "91 9886143941", id: "SNBOOKING_34523_9961197299 - (Room Only)", source: "agoda", dates: "Sep 15, 2026 12:00 PM - Sep 16, 2026 11:00 AM", room: "102 (Executive Suite Room)", occupancy: "(2 / 0)", status: "CONFIRMED", amount: "1842.75" },
  { guest: "Tamil Selvan", phone: "NA", id: "SNBOOKING_34523_9543522271 - (EP)", source: "makemytrip", dates: "Sep 13, 2026 12:00 PM - Sep 14, 2026 11:00 AM", room: "311 (Deluxe Room)", occupancy: "(2 / 0)", status: "CONFIRMED", amount: "2050.91" },
  { guest: "Ankit Kumar", phone: "11111111111", id: "SNBOOKING_34523_9919574173 - (Standard)", source: "expedia", dates: "Sep 13, 2026 12:00 PM - Sep 20, 2026 11:00 AM", room: "406 (Deluxe Room)", occupancy: "(2 / 0)", status: "CONFIRMED", amount: "7607.25" },
  { guest: "Mir Ali Moheeb", phone: "NA", id: "SNBOOKING_34523_YKDPF3AQU - (Free Breakfast)", source: "makemytrip", dates: "Sep 09, 2026 12:00 PM - Sep 19, 2026 11:00 AM", room: "410 (Deluxe Room)", occupancy: "(2 / 0)", status: "CHECKED-IN", amount: "20212.50" },
  { guest: "Saikiran D", phone: "918098014393", id: "SNBOOKING_34523_M746XYG53 - (Room Only)", source: "agoda", dates: "Sep 12, 2026 12:00 PM - Sep 13, 2026 11:00 AM", room: "504 (Deluxe Room)", occupancy: "(2 / 0)", status: "PENDING DEPARTURE", amount: "5118.75" },
];

// --- ROOMS DATA ---
const roomsData = [
  { type: "Deluxe Room", inv: 0, price: "2310" },
  { type: "Superior King Room", inv: 0, price: "2415" },
  { type: "Executive Suite Room", inv: 0, price: "2625" },
  { type: "Family Room", inv: 0, price: "5250" },
];

export default function DashboardPage() {
  const [activeDropdown, setActiveDropdown] = useState<StatKey | null>(null);
  const [activeFilter, setActiveFilter] = useState<{ key: StatKey; value: string } | null>(null);

  const handleStatClick = (key: StatKey) => {
    setActiveDropdown(activeDropdown === key ? null : key);
  };

  const handleOptionSelect = (key: StatKey, option: string) => {
    setActiveFilter({ key, value: option });
    setActiveDropdown(null);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-navy">
            Good evening
          </h1>
          <p className="text-muted mt-1 text-sm md:text-base">
            Here is what going on with your property on{" "}
            <span className="font-semibold text-navy underline decoration-gold decoration-2 underline-offset-4">
              12 Sep 2026
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1 bg-cream-dark p-1 rounded-lg">
          <button className="px-5 py-2 bg-navy text-cream text-sm font-medium rounded-md shadow-sm">
            Reservations
          </button>
          <button className="px-5 py-2 text-navy/60 text-sm font-medium hover:text-navy transition">
            Performance
          </button>
        </div>
      </div>

      {/* BANNER */}
      <div className="bg-white border border-cream-dark rounded-xl p-4 flex gap-4 items-start mb-6 shadow-sm">
        <div className="text-xl">🚀</div>
        <div className="flex-1">
          <h3 className="font-serif text-base font-semibold text-navy">
            Welcome to Staynexa PMS
          </h3>
          <p className="text-xs text-muted mt-1 mb-3">
            Manage your property with ease. AI-powered insights, faster check-ins, and smarter operations for modern hoteliers.
          </p>
          <button className="bg-navy text-cream text-xs font-semibold px-4 py-2 rounded-md tracking-wide hover:bg-navy-light transition">
            Explore Features
          </button>
        </div>
      </div>

      {/* ─── STATS CARDS WITH DROPDOWNS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {statsData.map((stat) => {
          const isActive = activeDropdown === stat.key;
          const isFiltered = activeFilter?.key === stat.key;

          return (
            <div key={stat.key} className="relative">
              <button
                onClick={() => handleStatClick(stat.key)}
                className={`w-full bg-white rounded-lg p-4 flex flex-col justify-between h-28 border-t-4 ${stat.color} text-left transition-all duration-200 ${
                  isActive
                    ? "shadow-lg ring-2 ring-gold -translate-y-1"
                    : isFiltered
                    ? "shadow-md ring-1 ring-gold/40"
                    : "shadow-sm hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                <span className="font-serif text-3xl font-semibold text-navy leading-none">
                  {stat.value}
                </span>
                <span className="text-xs text-muted font-medium tracking-wide">
                  {stat.label}
                  {isFiltered && (
                    <span className="block text-[10px] text-gold-dark mt-0.5 font-semibold">
                      ▸ {activeFilter.value}
                    </span>
                  )}
                </span>
              </button>

              {isActive && (
                <>
                  {/* Click-away overlay */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setActiveDropdown(null)}
                  />
                  {/* Dropdown */}
                  <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-cream-dark rounded-lg shadow-xl min-w-[190px] py-1 overflow-hidden">
                    {stat.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleOptionSelect(stat.key, option)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors flex items-center justify-between ${
                          activeFilter?.value === option
                            ? "text-gold-dark font-semibold bg-cream/60"
                            : "text-navy/80"
                        }`}
                      >
                        <span>{option}</span>
                        {activeFilter?.value === option && (
                          <span className="text-gold">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ACTIVE FILTER BANNER */}
      {activeFilter && (
        <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 mb-4 flex justify-between items-center">
          <p className="text-sm text-navy">
            Filtering by:{" "}
            <span className="font-semibold text-gold-dark">
              {activeFilter.value}
            </span>
          </p>
          <button
            onClick={() => setActiveFilter(null)}
            className="text-xs text-navy/60 hover:text-navy underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* SEARCH & SORT BAR */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Type and press enter to add tags and search"
          className="w-full md:w-1/2 p-2.5 border border-cream-dark rounded-lg text-sm outline-none focus:border-gold transition-colors bg-white"
        />
        <div className="flex gap-2 items-center text-sm w-full md:w-auto justify-end">
          <span className="text-muted text-xs">Sort by</span>
          <select className="border border-cream-dark rounded-lg p-2 outline-none text-navy/80 bg-white text-sm">
            <option>Booking Date</option>
            <option>Guest Name</option>
          </select>
          <select className="border border-cream-dark rounded-lg p-2 outline-none text-navy/80 bg-white text-sm">
            <option>25</option>
            <option>50</option>
          </select>
          <button className="border border-navy text-navy px-3 py-2 rounded-lg text-sm font-medium hover:bg-navy hover:text-cream transition">
            Download report
          </button>
        </div>
      </div>

      {/* MAIN GRID: Bookings + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* BOOKINGS LIST */}
        <div className="xl:col-span-3 bg-white border border-cream-dark rounded-xl shadow-sm divide-y divide-cream-dark">
          {bookingsData.map((b, idx) => (
            <div
              key={idx}
              className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-sm hover:bg-cream/40 transition-colors"
            >
              <div className="md:col-span-2">
                <p className="font-semibold text-navy">{b.guest}</p>
                <p className="text-muted text-xs mt-0.5">{b.phone}</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-navy/70 text-xs">{b.id}</p>
                <div className="mt-1 flex items-center">
                  {b.source === "agoda" && <span className="text-[10px] font-bold text-red-500">agoda</span>}
                  {b.source === "makemytrip" && (
                    <span className="text-[10px] font-bold text-red-600">
                      make<span className="text-blue-600">MyTrip</span>
                    </span>
                  )}
                  {b.source === "expedia" && <span className="text-[10px] font-bold text-blue-800">Expedia</span>}
                </div>
              </div>
              <div className="md:col-span-3">
                <p className="text-navy/70 text-xs">{b.dates}</p>
              </div>
              <div className="md:col-span-2 md:text-right">
                <div className="flex items-center md:justify-end gap-1 text-navy font-medium text-xs">
                  🔑 {b.room}
                </div>
                <p className="text-muted text-xs mt-0.5">{b.occupancy}</p>
              </div>
              <div className="md:col-span-2 md:text-right">
                <p className={`text-xs font-bold ${b.status === "PENDING DEPARTURE" ? "text-red-500" : "text-navy/70"}`}>
                  {b.status}
                </p>
                <p className="text-xs text-navy mt-0.5">
                  Total <span className="font-semibold">Rs. {b.amount}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="xl:col-span-1 space-y-4">
          {/* AVAILABILITY */}
          <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-5">
            <h3 className="font-serif text-base font-semibold text-navy mb-3 text-center">
              Availability Today
            </h3>
            <div className="text-xs">
              <div className="grid grid-cols-3 font-semibold text-muted border-b border-cream-dark pb-2 mb-2">
                <span className="text-left">Room category</span>
                <span className="text-right">Inv.</span>
                <span className="text-right">Base Price</span>
              </div>
              {roomsData.map((room, idx) => (
                <div key={idx} className="grid grid-cols-3 py-2 text-navy/80">
                  <span className="text-left">{room.type}</span>
                  <span className="text-right">{room.inv}</span>
                  <span className="text-right">Rs. {room.price}</span>
                </div>
              ))}
              <div className="grid grid-cols-3 pt-3 mt-1 border-t border-cream-dark font-bold text-navy">
                <span className="text-left">Total Available</span>
                <span className="text-right">0</span>
                <span></span>
              </div>
            </div>
          </div>

          {/* RAZORPAY */}
          <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-5 text-center relative">
            <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
              Important
            </span>
            <h3 className="font-serif text-sm font-semibold text-navy mb-2">
              Complete Razorpay onboarding
            </h3>
            <p className="text-xs text-muted mb-4">
              As per RBI guidelines, all merchants should complete KYC to use Razorpay.
            </p>
            <button className="border border-navy text-navy text-xs font-bold px-4 py-2 rounded-md hover:bg-navy hover:text-cream transition">
              SETUP NOW
            </button>
          </div>

          {/* UPGRADE */}
          <div className="bg-white border border-cream-dark rounded-xl shadow-sm p-5 text-center">
            <h3 className="font-serif text-sm font-semibold text-navy mb-2">
              Upgrade to Staynexa Empower
            </h3>
            <p className="text-xs text-muted mb-4">
              Revenue management service to boost your online bookings by 30%.
            </p>
            <button className="border border-cream-dark text-navy/70 text-xs font-bold px-4 py-2 rounded-md flex items-center justify-center gap-2 w-full hover:bg-cream transition">
              📊 REQUEST DEMO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
