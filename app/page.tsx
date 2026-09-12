"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutGrid,
  Calendar as CalendarIcon,
  RefreshCw,
  Users,
  FileText,
  Search,
  Sparkles,
  HelpCircle,
  Key,
  Download,
} from "lucide-react";
// import { supabase } from "../supabase"; // Uncomment when your supabase file is ready

// --- MOCK DATA ---
const statsData = [
  { label: "New bookings", value: 17, color: "border-t-teal-300" },
  { label: "In-house", value: 52, color: "border-t-green-300" },
  { label: "Arrivals", value: 35, color: "border-t-yellow-300" },
  { label: "Departures", value: 35, color: "border-t-indigo-400" },
  { label: "Cancellations", value: 4, color: "border-t-red-400" },
  { label: "On hold", value: 0, color: "border-t-slate-500" },
  { label: "No shows", value: 0, color: "border-t-gray-300" },
  { label: "Magic link", value: 0, color: "border-t-pink-300" },
];

const bookingsData = [
  {
    guest: "Vinay Verma",
    phone: "91 9886143941",
    id: "SFBOOKING_34523_9961197299 - (Room Only)",
    source: "agoda",
    dates: "Sep 15, 2026 12:00 PM - Sep 16, 2026 11:00 AM",
    room: "102 (Executive Suite Room)",
    occupancy: "(2 / 0)",
    status: "CONFIRMED",
    amount: "1842.75",
  },
  {
    guest: "Tamil Selvan",
    phone: "NA",
    id: "SFBOOKING_34523_9543522271 - (EP)",
    source: "makemytrip",
    dates: "Sep 13, 2026 12:00 PM - Sep 14, 2026 11:00 AM",
    room: "311 (Deluxe Room)",
    occupancy: "(2 / 0)",
    status: "CONFIRMED",
    amount: "2050.91",
  },
];

const roomsData = [
  { type: "Deluxe Room", inv: 0, price: "2310" },
  { type: "Superior King Room", inv: 0, price: "2415" },
  { type: "Executive Suite Room", inv: 0, price: "2625" },
  { type: "Family Room", inv: 0, price: "5250" },
];

// --- MAIN COMPONENT ---
export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // async function fetchData() {
    //   const { data, error } = await supabase.from('rooms').select('*');
    //   if (data) console.log(data);
    // }
    // fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* 1. TOP NAVIGATION */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center rounded font-bold text-lg">S</div>
          <div className="flex items-center gap-4 text-gray-500">
            <LayoutGrid size={20} className="hover:text-slate-900 cursor-pointer" />
            <CalendarIcon size={20} className="hover:text-slate-900 cursor-pointer" />
            <RefreshCw size={20} className="hover:text-slate-900 cursor-pointer" />
            <Users size={20} className="hover:text-slate-900 cursor-pointer" />
            <FileText size={20} className="hover:text-slate-900 cursor-pointer" />
          </div>
          <div className="relative ml-4 hidden md:block">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input type="text" placeholder="Search for reservation" className="pl-9 pr-4 py-2 border border-gray-300 rounded text-sm w-64 outline-none focus:border-slate-500" />
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <button className="hidden md:flex items-center gap-2 border border-gray-300 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-gray-50">
            <Sparkles size={16} className="text-slate-700" /> <span>flexi AI</span>
          </button>
          <a href="#" className="hidden md:flex text-sm text-gray-500 hover:underline items-center gap-1"><HelpCircle size={16} /> help?</a>
          <button className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded">New UI</button>
          <div className="flex items-center gap-2 border-l pl-4">
            <span className="text-sm font-medium text-gray-700 hidden md:block">Vishara Elite</span>
            <div className="flex gap-1 ml-2">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <div className="w-5 h-5 bg-slate-800 text-white rounded flex items-center justify-center text-xs">V</div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT GRID */}
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN (Main Content) */}
        <div className="xl:col-span-3 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Good evening</h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">Here is what going on with your property on <span className="font-semibold underline decoration-dotted">12 Sep 2026</span></p>
            </div>
            <div className="bg-gray-100 p-1 rounded-md flex border border-gray-200">
              <button className="px-4 py-1.5 bg-slate-800 text-white text-sm font-medium rounded shadow-sm">Reservations</button>
              <button className="px-4 py-1.5 text-gray-600 text-sm font-medium hover:text-gray-900">Performance</button>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex gap-4 items-start">
            <div className="mt-1 text-xl">🚀</div>
            <div>
              <h3 className="font-bold text-gray-900">The New Stayflexi is Here</h3>
              <p className="text-sm text-gray-500 mt-1 mb-3">AI-powered, faster, smarter, and fully redesigned for modern hoteliers. Experience it now!</p>
              <button className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded">Access New UI</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {statsData.map((stat, idx) => (
              <div key={idx} className={`bg-white rounded shadow-sm p-4 flex flex-col justify-between h-28 border-t-4 ${stat.color}`}>
                <span className="text-3xl font-bold text-slate-800">{stat.value}</span>
                <span className="text-xs text-slate-600 font-medium">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6">
            <input type="text" placeholder="Type and press enter to add tags and search" className="w-full md:w-1/2 p-2 border border-gray-300 rounded text-sm outline-none focus:border-slate-500" />
            <div className="flex gap-2 items-center text-sm w-full md:w-auto justify-end">
              <span className="text-gray-500 hidden md:block">Sort by</span>
              <select className="border border-gray-300 rounded p-1.5 outline-none"><option>Booking Date</option><option>Guest Name</option></select>
              <button className="border border-gray-800 text-gray-800 px-3 py-1.5 rounded font-medium hover:bg-gray-100">Download report</button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded shadow-sm divide-y divide-gray-100">
            {bookingsData.map((b, idx) => (
              <div key={idx} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center text-sm">
                <div className="md:col-span-2">
                  <p className="font-semibold text-gray-900">{b.guest}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{b.phone}</p>
                </div>
                <div className="md:col-span-3">
                  <p className="text-gray-600 text-xs">{b.id}</p>
                  <div className="mt-1 flex items-center">
                    {b.source === "agoda" && <span className="text-[10px] font-bold text-red-500 tracking-tighter">agoda</span>}
                    {b.source === "makemytrip" && <span className="text-[10px] font-bold text-red-600">make<span className="text-blue-600">MyTrip</span></span>}
                  </div>
                </div>
                <div className="md:col-span-3"><p className="text-gray-600 text-xs">{b.dates}</p></div>
                <div className="md:col-span-2 md:text-right">
                  <div className="flex items-center md:justify-end gap-1 text-gray-800 font-medium text-xs"><Key size={12} /> {b.room}</div>
                  <p className="text-gray-400 text-xs mt-0.5">{b.occupancy}</p>
                </div>
                <div className="md:col-span-2 md:text-right">
                  <p className="text-xs font-bold text-gray-600">{b.status}</p>
                  <p className="text-xs text-gray-800 mt-0.5">Total <span className="font-bold">Rs. {b.amount}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN (Sidebar Widgets) */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <h3 className="text-center font-bold text-gray-800 mb-4">Availability Today</h3>
            <div className="text-xs">
              <div className="grid grid-cols-3 font-semibold text-gray-500 border-b pb-2 mb-2">
                <span className="text-left">Room category</span><span className="text-right">Inventory</span><span className="text-right">Base Price</span>
              </div>
              {roomsData.map((room, idx) => (
                <div key={idx} className="grid grid-cols-3 py-2 text-gray-700">
                  <span className="text-left">{room.type}</span><span className="text-right">{room.inv}</span><span className="text-right">Rs. {room.price}</span>
                </div>
              ))}
              <div className="grid grid-cols-3 pt-3 mt-1 border-t font-bold text-gray-800">
                <span className="text-left">Total Available Rooms</span><span className="text-right">0</span><span></span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded shadow-sm p-5 text-center relative">
            <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">Important</span>
            <h3 className="font-bold text-gray-800 mb-2">Complete Razorpay onboarding</h3>
            <p className="text-xs text-gray-500 mb-4">As per RBI guidelines, all merchants should complete the KYC process in order to use Razorpay payment gateway.</p>
            <p className="text-xs text-gray-600 mb-4">Review <a href="#" className="text-blue-600 hover:underline">Razorpay's</a> account opening guidelines to get started.</p>
            <button className="border border-gray-800 text-gray-800 text-xs font-bold px-4 py-2 rounded hover:bg-gray-50">SETUP NOW</button>
          </div>

          <div className="bg-white border border-gray-200 rounded shadow-sm p-5 text-center">
            <h3 className="font-bold text-gray-800 mb-2 text-sm">Upgrade to Stayflexi Empower</h3>
            <p className="text-xs text-gray-500 mb-4">Revenue management service by Stayflexi to boost your online bookings by 30%.</p>
            <button className="border border-gray-300 text-gray-700 text-xs font-bold px-4 py-2 rounded flex items-center justify-center gap-2 w-full hover:bg-gray-50">
              <Download size={14} /> REQUEST DEMO
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded shadow-sm p-5 text-center">
            <h3 className="font-bold text-gray-800 text-sm">Download Stayflexi App</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
