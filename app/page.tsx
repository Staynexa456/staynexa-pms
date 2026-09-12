"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const HOTEL_ID = "3a455cbe-ac87-4599-866e-d1da35318a22";

type RoomType = {
  id: string;
  name: string;
  base_price: number;
};

type Room = {
  id: string;
  hotel_id: string;
  room_number: string;
  floor: number | null;
  status: string;
  room_type_id?: string | null;
  room_type?: RoomType | null;
  notes?: string | null;
};

type Guest = {
  id: string;
  hotel_id: string;
  first_name: string;
  last_name: string;
  phone: string;
};

type Reservation = {
  id: string;
  hotel_id: string;
  room_id: string;
  guest_id: string;
  reservation_number: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  status: string;
  total_amount: number;
  paid_amount: number;
  special_requests?: string | null;
  created_at?: string;
  guest?: Guest | null;
  room?: Room | null; 
};

type Hotel = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

const menuItems = [
  "Dashboard",
  "Reservations",
  "Calendar",
  "Guests",
  "Rooms",
  "Check-In",
  "Check-Out",
  "Housekeeping",
  "Reports",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(date: string) {
  if (!date) return "-";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getGuestName(guest?: Guest | null) {
  if (!guest) return "Guest";

  return `${guest.first_name || ""} ${guest.last_name || ""}`.trim() || "Guest";
}

function getStatusClasses(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-yellow-100 text-yellow-800";
    case "checked_in":
      return "bg-green-100 text-green-800";
    case "checked_out":
      return "bg-red-100 text-red-800";
    case "cancelled":
      return "bg-slate-100 text-slate-600";
    case "no_show":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getRoomStatusClasses(status: string) {
  switch (status) {
    case "available":
      return "bg-green-50 border-green-200 text-green-700";
    case "occupied":
      return "bg-red-50 border-red-200 text-red-700";
    case "cleaning":
      return "bg-yellow-50 border-yellow-200 text-yellow-700";
    case "blocked":
      return "bg-slate-100 border-slate-300 text-slate-700";
    case "maintenance":
      return "bg-orange-50 border-orange-200 text-orange-700";
    default:
      return "bg-slate-50 border-slate-200 text-slate-700";
  }
}

export default function Home() {
  const [activeSection, setActiveSection] = useState("Dashboard");

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);

  const [search, setSearch] = useState("");

  const [checkInGuestSearch, setCheckInGuestSearch] = useState("");
  const [checkOutGuestSearch, setCheckOutGuestSearch] = useState("");

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "Cash",
    note: "",
  });

  const [reservationForm, setReservationForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    checkIn: "",
    checkOut: "",
    adults: "1",
    children: "0",
    specialRequests: "",
  });

  const [blockForm, setBlockForm] = useState({
    startDate: "",
    endDate: "",
    reason: "Maintenance",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        hotelResult,
        roomsResult,
        guestsResult,
        reservationsResult,
      ] = await Promise.all([
        supabase
          .from("hotels")
          .select("*")
          .eq("id", HOTEL_ID)
          .single(),

        supabase
          .from("rooms")
          .select(`
            *,
            room_type:room_types(*)
          `)
          .eq("hotel_id", HOTEL_ID)
          .order("room_number"),

        supabase
          .from("guests")
          .select("*")
          .eq("hotel_id", HOTEL_ID)
          .order("first_name"),

        supabase
          .from("reservations")
          .select(`
            *,
            guest:guests(*),
            room:rooms(
              *,
              room_type:room_types(*)
            )
          `)
          .eq("hotel_id", HOTEL_ID)
          .order("check_in", { ascending: true }),
      ]);

      if (hotelResult.error) throw hotelResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (guestsResult.error) throw guestsResult.error;
      if (reservationsResult.error) throw reservationsResult.error;

      setHotel(hotelResult.data);
      setRooms((roomsResult.data || []) as Room[]);
      setGuests((guestsResult.data || []) as Guest[]);
      setReservations((reservationsResult.data || []) as Reservation[]);
    } catch (err: any) {
      setError(err?.message || "Unable to load hotel data.");
    } finally {
      setLoading(false);
    }
  }

  function clearMessages() {
    setMessage("");
    setError("");
  }

  function openReservationModal(room?: Room) {
    clearMessages();

    setSelectedRoom(room || null);

    setReservationForm({
      firstName: "",
      lastName: "",
      phone: "",
      checkIn: new Date().toISOString().split("T")[0],
      checkOut: "",
      adults: "1",
      children: "0",
      specialRequests: "",
    });

    setShowReservationModal(true);
  }

  function openBlockModal(room: Room) {
    clearMessages();

    setSelectedRoom(room);

    setBlockForm({
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      reason: "Maintenance",
    });

    setShowBlockModal(true);
  }

  function openPaymentModal(reservation: Reservation) {
    clearMessages();

    setSelectedReservation(reservation);

    const due =
      Number(reservation.total_amount || 0) -
      Number(reservation.paid_amount || 0);

    setPaymentForm({
      amount: due > 0 ? String(due) : "",
      method: "Cash",
      note: "",
    });

    setShowPaymentModal(true);
  }

  function openEditModal(reservation: Reservation) {
    clearMessages();

    setSelectedReservation(reservation);

    setReservationForm({
      firstName: reservation.guest?.first_name || "",
      lastName: reservation.guest?.last_name || "",
      phone: reservation.guest?.phone || "",
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      adults: String(reservation.adults || 1),
      children: String(reservation.children || 0),
      specialRequests: reservation.special_requests || "",
    });

    setSelectedRoom(reservation.room || null);
    setShowEditModal(true);
  }

  async function createReservation() {
    clearMessages();

    if (!selectedRoom) {
      setError("Please select a room.");
      return;
    }

    if (
      !reservationForm.firstName.trim() ||
      !reservationForm.lastName.trim() ||
      !reservationForm.phone.trim()
    ) {
      setError("Please enter guest first name, last name and phone.");
      return;
    }

    if (!reservationForm.checkIn || !reservationForm.checkOut) {
      setError("Please select check-in and check-out dates.");
      return;
    }

    const checkIn = new Date(`${reservationForm.checkIn}T00:00:00`);
    const checkOut = new Date(`${reservationForm.checkOut}T00:00:00`);

    if (checkOut <= checkIn) {
      setError("Check-out date must be after check-in date.");
      return;
    }

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const rate = Number(selectedRoom.room_type?.base_price || 0);
    const totalAmount = nights * rate;

    setSaving(true);

    try {
      let guest: Guest | null = null;

      const existingGuestResult = await supabase
        .from("guests")
        .select("*")
        .eq("hotel_id", HOTEL_ID)
        .eq("phone", reservationForm.phone.trim())
        .maybeSingle();

      if (existingGuestResult.error) {
        throw existingGuestResult.error;
      }

      if (existingGuestResult.data) {
        guest = existingGuestResult.data as Guest;

        const updateGuestResult = await supabase
          .from("guests")
          .update({
            first_name: reservationForm.firstName.trim(),
            last_name: reservationForm.lastName.trim(),
          })
          .eq("id", guest.id);

        if (updateGuestResult.error) {
          throw updateGuestResult.error;
        }
      } else {
        const insertGuestResult = await supabase
          .from("guests")
          .insert({
            hotel_id: HOTEL_ID,
            first_name: reservationForm.firstName.trim(),
            last_name: reservationForm.lastName.trim(),
            phone: reservationForm.phone.trim(),
          })
          .select()
          .single();

        if (insertGuestResult.error) {
          throw insertGuestResult.error;
        }

        guest = insertGuestResult.data as Guest;
      }

      const reservationResult = await supabase
        .from("reservations")
        .insert({
          hotel_id: HOTEL_ID,
          room_id: selectedRoom.id,
          guest_id: guest.id,
          check_in: reservationForm.checkIn,
          check_out: reservationForm.checkOut,
          adults: Number(reservationForm.adults) || 1,
          children: Number(reservationForm.children) || 0,
          status: "confirmed",
          total_amount: totalAmount,
          paid_amount: 0,
          special_requests:
            reservationForm.specialRequests.trim() || null,
        })
        .select()
        .single();

      if (reservationResult.error) {
        throw reservationResult.error;
      }

      setShowReservationModal(false);

      setMessage(
        `Reservation created successfully. Total: ${formatMoney(
          totalAmount
        )}`
      );

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to create reservation.");
    } finally {
      setSaving(false);
    }
  }

  async function editReservation() {
    if (!selectedReservation || !selectedRoom) {
      setError("Reservation or room is missing.");
      return;
    }

    clearMessages();

    if (
      !reservationForm.firstName.trim() ||
      !reservationForm.lastName.trim() ||
      !reservationForm.phone.trim()
    ) {
      setError("Please enter guest details.");
      return;
    }

    if (!reservationForm.checkIn || !reservationForm.checkOut) {
      setError("Please select both dates.");
      return;
    }

    const checkIn = new Date(`${reservationForm.checkIn}T00:00:00`);
    const checkOut = new Date(`${reservationForm.checkOut}T00:00:00`);

    if (checkOut <= checkIn) {
      setError("Check-out date must be after check-in.");
      return;
    }

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const rate = Number(selectedRoom.room_type?.base_price || 0);
    const newTotal = nights * rate;

    setSaving(true);

    try {
      const guestResult = await supabase
        .from("guests")
        .update({
          first_name: reservationForm.firstName.trim(),
          last_name: reservationForm.lastName.trim(),
          phone: reservationForm.phone.trim(),
        })
        .eq("id", selectedReservation.guest_id);

      if (guestResult.error) throw guestResult.error;

      const reservationResult = await supabase
        .from("reservations")
        .update({
          room_id: selectedRoom.id,
          check_in: reservationForm.checkIn,
          check_out: reservationForm.checkOut,
          adults: Number(reservationForm.adults) || 1,
          children: Number(reservationForm.children) || 0,
          total_amount: newTotal,
          special_requests:
            reservationForm.specialRequests.trim() || null,
        })
        .eq("id", selectedReservation.id);

      if (reservationResult.error) {
        throw reservationResult.error;
      }

      setShowEditModal(false);
      setMessage("Reservation updated successfully.");

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to update reservation.");
    } finally {
      setSaving(false);
    }
  }

  async function recordPayment() {
    if (!selectedReservation) return;

    clearMessages();

    const total = Number(selectedReservation.total_amount || 0);
    const paid = Number(selectedReservation.paid_amount || 0);
    const due = total - paid;
    const amount = Number(paymentForm.amount);

    if (!amount || amount <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    if (amount > due) {
      setError(
        `Payment cannot be greater than the outstanding balance of ${formatMoney(
          due
        )}.`
      );
      return;
    }

    setSaving(true);

    try {
      const newPaid = paid + amount;

      const result = await supabase
        .from("reservations")
        .update({
          paid_amount: newPaid,
        })
        .eq("id", selectedReservation.id);

      if (result.error) throw result.error;

      setShowPaymentModal(false);

      setMessage(
        `Payment of ${formatMoney(amount)} recorded successfully. ${
          newPaid >= total ? "Reservation is fully settled." : ""
        }`
      );

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to record payment.");
    } finally {
      setSaving(false);
    }
  }

  async function blockRoom() {
    clearMessages();

    if (!selectedRoom) {
      setError("Please select a room.");
      return;
    }

    if (!blockForm.startDate || !blockForm.endDate) {
      setError("Please select block dates.");
      return;
    }

    if (blockForm.endDate < blockForm.startDate) {
      setError("End date cannot be before start date.");
      return;
    }

    setSaving(true);

    try {
      const blockResult = await supabase
        .from("room_blocks")
        .insert({
          hotel_id: HOTEL_ID,
          room_id: selectedRoom.id,
          start_date: blockForm.startDate,
          end_date: blockForm.endDate,
          reason: blockForm.reason,
        });

      if (blockResult.error) throw blockResult.error;

      const roomResult = await supabase
        .from("rooms")
        .update({
          status: "blocked",
        })
        .eq("id", selectedRoom.id);

      if (roomResult.error) throw roomResult.error;

      setShowBlockModal(false);

      setMessage(
        `Room ${selectedRoom.room_number} has been blocked successfully.`
      );

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to block room.");
    } finally {
      setSaving(false);
    }
  }

  async function updateReservationStatus(
    reservation: Reservation,
    status: string
  ) {
    clearMessages();

    const guestName = getGuestName(reservation.guest);
    const roomNumber = reservation.room?.room_number || "";

    let question = "";

    if (status === "checked_in") {
      question = `Do you want to continue to check-IN ${guestName} into Room ${roomNumber}?`;
    }

    if (status === "checked_out") {
      const due =
        Number(reservation.total_amount || 0) -
        Number(reservation.paid_amount || 0);

      if (due > 0) {
        const continueCheckout = window.confirm(
          `${guestName} has an outstanding balance of ${formatMoney(
            due
          )}.\n\nDo you want to continue to check-OUT anyway?`
        );

        if (!continueCheckout) return;
      } else {
        question = `Do you want to continue to check-OUT ${guestName} from Room ${roomNumber}?`;
      }
    }

    if (status === "cancelled") {
      question = `Do you want to cancel reservation ${
        reservation.reservation_number || ""
      }?`;
    }

    if (question && !window.confirm(question)) return;

    setSaving(true);

    try {
      const reservationResult = await supabase
        .from("reservations")
        .update({
          status,
        })
        .eq("id", reservation.id);

      if (reservationResult.error) throw reservationResult.error;

      if (reservation.room_id) {
        let roomStatus = "available";

        if (status === "checked_in") {
          roomStatus = "occupied";
        }

        if (status === "checked_out") {
          roomStatus = "cleaning";
        }

        const roomResult = await supabase
          .from("rooms")
          .update({
            status: roomStatus,
          })
          .eq("id", reservation.room_id);

        if (roomResult.error) throw roomResult.error;
      }

      setMessage(
        status === "checked_in"
          ? `${guestName} checked in successfully.`
          : status === "checked_out"
          ? `${guestName} checked out successfully.`
          : "Reservation updated successfully."
      );

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to update reservation.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRoomStatus(room: Room, status: string) {
    clearMessages();

    if (!window.confirm(`Change Room ${room.room_number} to ${status}?`)) {
      return;
    }

    setSaving(true);

    try {
      const result = await supabase
        .from("rooms")
        .update({
          status,
        })
        .eq("id", room.id);

      if (result.error) throw result.error;

      setMessage(`Room ${room.room_number} updated to ${status}.`);

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to update room.");
    } finally {
      setSaving(false);
    }
  }

  function openInvoice(reservation: Reservation) {
    setSelectedReservation(reservation);
    setShowInvoiceModal(true);
  }

  const today = new Date().toISOString().split("T")[0];

  const todayReservations = useMemo(
    () =>
      reservations.filter(
        (r) => r.check_in === today || r.check_out === today
      ),
    [reservations, today]
  );

  const checkedInReservations = useMemo(
    () => reservations.filter((r) => r.status === "checked_in"),
    [reservations]
  );

  const confirmedReservations = useMemo(
    () => reservations.filter((r) => r.status === "confirmed"),
    [reservations]
  );

  const totalRevenue = useMemo(
    () =>
      reservations.reduce(
        (sum, r) => sum + Number(r.total_amount || 0),
        0
      ),
    [reservations]
  );

  const totalPaid = useMemo(
    () =>
      reservations.reduce(
        (sum, r) => sum + Number(r.paid_amount || 0),
        0
      ),
    [reservations]
  );

  const dueBalance = totalRevenue - totalPaid;

  const filteredReservations = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return reservations;

    return reservations.filter((reservation) => {
      const guestName = getGuestName(reservation.guest).toLowerCase();
      const phone = reservation.guest?.phone?.toLowerCase() || "";
      const room = reservation.room?.room_number?.toLowerCase() || "";
      const reservationNumber =
        reservation.reservation_number?.toLowerCase() || "";

      return (
        guestName.includes(value) ||
        phone.includes(value) ||
        room.includes(value) ||
        reservationNumber.includes(value)
      );
    });
  }, [reservations, search]);

  const filteredGuests = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return guests;

    return guests.filter((guest) => {
      const name = getGuestName(guest).toLowerCase();

      return (
        name.includes(value) ||
        guest.phone.toLowerCase().includes(value)
      );
    });
  }, [guests, search]);

  const availableRooms = rooms.filter(
    (room) => room.status === "available"
  ).length;

  const occupiedRooms = rooms.filter(
    (room) => room.status === "occupied"
  ).length;

  const blockedRooms = rooms.filter(
    (room) => room.status === "blocked"
  ).length;

  const cleaningRooms = rooms.filter(
    (room) => room.status === "cleaning"
  ).length;

  function renderHeader(title: string, subtitle: string) {
    return (
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        {activeSection === "Reservations" && (
          <button
            onClick={() => openReservationModal()}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            + New Reservation
          </button>
        )}
      </div>
    );
  }

  function renderDashboard() {
    return (
      <>
        {renderHeader(
          "Dashboard",
          "Welcome to your hotel front office."
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Rooms"
            value={rooms.length}
            subtitle="All hotel rooms"
            icon="▦"
          />

          <StatCard
            title="Available"
            value={availableRooms}
            subtitle="Ready for booking"
            icon="✓"
          />

          <StatCard
            title="Occupied"
            value={occupiedRooms}
            subtitle="Currently occupied"
            icon="⌂"
          />

          <StatCard
            title="Due Balance"
            value={formatMoney(dueBalance)}
            subtitle="Outstanding amount"
            icon="₹"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">
                  Room Overview
                </h2>

                <p className="text-sm text-slate-500">
                  Current room status
                </p>
              </div>

              <button
                onClick={() => setActiveSection("Rooms")}
                className="text-sm font-semibold text-slate-700"
              >
                View all
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onReserve={() => openReservationModal(room)}
                  onBlock={() => openBlockModal(room)}
                  onStatus={(status) =>
                    updateRoomStatus(room, status)
                  }
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">
              Today's Activity
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {todayReservations.length} reservation activities today
            </p>

            <div className="mt-5 space-y-3">
              {todayReservations.length === 0 ? (
                <EmptyState text="No activity for today." />
              ) : (
                todayReservations.slice(0, 6).map((reservation) => (
                  <div
                    key={reservation.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">
                        {getGuestName(reservation.guest)}
                      </p>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusClasses(
                          reservation.status
                        )}`}
                      >
                        {reservation.status.replace("_", " ")}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Room {reservation.room?.room_number || "-"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat
            title="Confirmed"
            value={confirmedReservations.length}
          />

          <MiniStat
            title="Checked In"
            value={checkedInReservations.length}
          />

          <MiniStat
            title="Blocked Rooms"
            value={blockedRooms}
          />

          <MiniStat
            title="Cleaning"
            value={cleaningRooms}
          />
        </div>
      </>
    );
  }

  function renderReservations() {
    return (
      <>
        {renderHeader(
          "Reservations",
          "Manage bookings, guests, payments and room assignments."
        )}

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guest, phone, room or reservation number..."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />

            <button
              onClick={() => setSearch("")}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-xs uppercase text-slate-500">
                    Reservation
                  </th>

                  <th className="px-5 py-4 text-xs uppercase text-slate-500">
                    Guest
                  </th>

                  <th className="px-5 py-4 text-xs uppercase text-slate-500">
                    Room
                  </th>

                  <th className="px-5 py-4 text-xs uppercase text-slate-500">
                    Stay
                  </th>

                  <th className="px-5 py-4 text-xs uppercase text-slate-500">
                    Amount
                  </th>

                  <th className="px-5 py-4 text-xs uppercase text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4 text-xs uppercase text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10">
                      <EmptyState text="No reservations found." />
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((reservation) => {
                    const total = Number(
                      reservation.total_amount || 0
                    );

                    const paid = Number(
                      reservation.paid_amount || 0
                    );

                    const due = total - paid;

                    return (
                      <tr
                        key={reservation.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold">
                            {reservation.reservation_number || "RES"}
                          </p>

                          <p className="text-xs text-slate-400">
                            {reservation.id.slice(0, 8)}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold">
                            {getGuestName(reservation.guest)}
                          </p>

                          <p className="text-xs text-slate-500">
                            {reservation.guest?.phone || "-"}
                          </p>
                        </td>

                        <td className="px-5 py-4 font-semibold">
                          {reservation.room?.room_number || "-"}
                        </td>

                        <td className="px-5 py-4 text-sm">
                          <div>{formatDate(reservation.check_in)}</div>
                          <div>{formatDate(reservation.check_out)}</div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold">
                            {formatMoney(total)}
                          </p>

                          <p
                            className={`text-xs font-semibold ${
                              due > 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {due > 0
                              ? `Due ${formatMoney(due)}`
                              : "SETTLED"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${getStatusClasses(
                              reservation.status
                            )}`}
                          >
                            {reservation.status.replace("_", " ")}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                openEditModal(reservation)
                              }
                              className="rounded-lg border px-3 py-2 text-xs font-bold"
                            >
                              Edit
                            </button>

                            {due > 0 && (
                              <button
                                onClick={() =>
                                  openPaymentModal(reservation)
                                }
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                              >
                                Payment
                              </button>
                            )}

                            {reservation.status === "confirmed" && (
                              <button
                                onClick={() =>
                                  updateReservationStatus(
                                    reservation,
                                    "checked_in"
                                  )
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white"
                              >
                                Check-In
                              </button>
                            )}

                            {reservation.status === "checked_in" && (
                              <button
                                onClick={() =>
                                  updateReservationStatus(
                                    reservation,
                                    "checked_out"
                                  )
                                }
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white"
                              >
                                Check-Out
                              </button>
                            )}

                            <button
                              onClick={() => openInvoice(reservation)}
                              className="rounded-lg border px-3 py-2 text-xs font-bold"
                            >
                              Bill
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  function renderCalendar() {
    return (
      <>
        {renderHeader(
          "Reservation Calendar",
          "Visual overview of check-ins and check-outs."
        )}

        <div className="mb-5 flex flex-wrap gap-3">
          <Legend color="bg-green-500" text="Check-In Guest" />
          <Legend color="bg-red-500" text="Check-Out Guest" />
          <Legend color="bg-yellow-400" text="Pending / Confirmed" />
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[180px_repeat(7,1fr)] border-b bg-slate-50">
              <div className="p-4 font-bold">Room</div>

              {Array.from({ length: 7 }).map((_, index) => {
                const date = new Date();
                date.setDate(date.getDate() + index);

                const value = date.toISOString().split("T")[0];

                return (
                  <div
                    key={value}
                    className="border-l p-4 text-center"
                  >
                    <p className="text-xs text-slate-400">
                      {date.toLocaleDateString("en-IN", {
                        weekday: "short",
                      })}
                    </p>

                    <p className="font-bold">
                      {date.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {rooms.map((room) => (
              <div
                key={room.id}
                className="grid grid-cols-[180px_repeat(7,1fr)] border-b"
              >
                <div className="p-4">
                  <p className="font-bold">
                    Room {room.room_number}
                  </p>

                  <p className="text-xs text-slate-500">
                    {room.room_type?.name || "Room"}
                  </p>
                </div>

                {Array.from({ length: 7 }).map((_, index) => {
                  const date = new Date();
                  date.setDate(date.getDate() + index);

                  const dateValue = date
                    .toISOString()
                    .split("T")[0];

                  const booking = reservations.find(
                    (reservation) =>
                      reservation.room_id === room.id &&
                      reservation.check_in <= dateValue &&
                      reservation.check_out > dateValue
                  );

                  return (
                    <div
                      key={`${room.id}-${dateValue}`}
                      className="min-h-[80px] border-l p-2"
                    >
                      {booking && (
                        <button
                          onClick={() => openInvoice(booking)}
                          className={`h-full w-full rounded-lg p-2 text-left ${
                            booking.status === "checked_in"
                              ? "bg-green-100 text-green-800"
                              : booking.status === "checked_out"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          <p className="truncate text-xs font-bold">
                            {getGuestName(booking.guest)}
                          </p>

                          <p className="text-[10px] capitalize">
                            {booking.status.replace("_", " ")}
                          </p>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  function renderGuests() {
    return (
      <>
        {renderHeader(
          "Guests",
          "Guest directory and contact information."
        )}

        <div className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guest name or phone..."
            className="w-full rounded-xl border px-4 py-3 text-sm"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredGuests.length === 0 ? (
            <div className="col-span-full">
              <EmptyState text="No guests found." />
            </div>
          ) : (
            filteredGuests.map((guest) => {
              const guestReservations = reservations.filter(
                (r) => r.guest_id === guest.id
              );

              return (
                <div
                  key={guest.id}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 font-bold text-white">
                      {guest.first_name?.[0]?.toUpperCase() || "G"}
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                      {guestReservations.length} stays
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold">
                    {getGuestName(guest)}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {guest.phone}
                  </p>

                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs uppercase text-slate-400">
                      Guest ID
                    </p>

                    <p className="mt-1 break-all text-xs text-slate-600">
                      {guest.id}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </>
    );
  }

  function renderRooms() {
    return (
      <>
        {renderHeader(
          "Rooms",
          "Manage room status, reservations and room blocks."
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <RoomStatusSummary
            label="Available"
            value={availableRooms}
          />

          <RoomStatusSummary
            label="Occupied"
            value={occupiedRooms}
          />

          <RoomStatusSummary
            label="Cleaning"
            value={cleaningRooms}
          />

          <RoomStatusSummary
            label="Blocked"
            value={blockedRooms}
          />

          <RoomStatusSummary
            label="Total"
            value={rooms.length}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              large
              onReserve={() => openReservationModal(room)}
              onBlock={() => openBlockModal(room)}
              onStatus={(status) =>
                updateRoomStatus(room, status)
              }
            />
          ))}
        </div>
      </>
    );
  }

  function renderCheckIn() {
    const pendingCheckIns = reservations.filter(
      (r) =>
        r.status === "confirmed" &&
        r.check_in <= today
    );

    const filtered = pendingCheckIns.filter((r) => {
      const value = checkInGuestSearch.toLowerCase();

      return (
        getGuestName(r.guest).toLowerCase().includes(value) ||
        r.guest?.phone?.toLowerCase().includes(value) ||
        r.room?.room_number?.toLowerCase().includes(value)
      );
    });

    return (
      <>
        {renderHeader(
          "Check-In",
          "Process arriving guests and assign occupied rooms."
        )}

        <div className="mb-5">
          <input
            value={checkInGuestSearch}
            onChange={(e) =>
              setCheckInGuestSearch(e.target.value)
            }
            placeholder="Search arriving guest..."
            className="w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-sm"
          />
        </div>

        <div className="grid gap-4">
          {filtered.length === 0 ? (
            <EmptyState text="No pending check-ins." />
          ) : (
            filtered.map((reservation) => (
              <div
                key={reservation.id}
                className="rounded-2xl border border-yellow-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 font-bold text-yellow-800">
                      {reservation.room?.room_number}
                    </div>

                    <div>
                      <h3 className="font-bold">
                        {getGuestName(reservation.guest)}
                      </h3>

                      <p className="text-sm text-slate-500">
                        {reservation.guest?.phone}
                      </p>

                      <p className="text-xs text-slate-400">
                        {formatDate(reservation.check_in)} →{" "}
                        {formatDate(reservation.check_out)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        updateReservationStatus(
                          reservation,
                          "checked_in"
                        )
                      }
                      className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white"
                    >
                      Continue to Check-In
                    </button>

                    <button
                      onClick={() => openPaymentModal(reservation)}
                      className="rounded-xl border px-5 py-3 text-sm font-bold"
                    >
                      Payment
                    </button>

                    <button
                      onClick={() => openInvoice(reservation)}
                      className="rounded-xl border px-5 py-3 text-sm font-bold"
                    >
                      View Bill
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  function renderCheckOut() {
    const filtered = checkedInReservations.filter((r) => {
      const value = checkOutGuestSearch.toLowerCase();

      return (
        getGuestName(r.guest).toLowerCase().includes(value) ||
        r.guest?.phone?.toLowerCase().includes(value) ||
        r.room?.room_number?.toLowerCase().includes(value)
      );
    });

    return (
      <>
        {renderHeader(
          "Check-Out",
          "Settle guest balances and release rooms for housekeeping."
        )}

        <div className="mb-5">
          <input
            value={checkOutGuestSearch}
            onChange={(e) =>
              setCheckOutGuestSearch(e.target.value)
            }
            placeholder="Search checked-in guest..."
            className="w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-sm"
          />
        </div>

        <div className="grid gap-4">
          {filtered.length === 0 ? (
            <EmptyState text="No guests currently checked in." />
          ) : (
            filtered.map((reservation) => {
              const total = Number(
                reservation.total_amount || 0
              );

              const paid = Number(
                reservation.paid_amount || 0
              );

              const due = total - paid;

              return (
                <div
                  key={reservation.id}
                  className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-red-100 px-4 py-3 font-bold text-red-800">
                          Room {reservation.room?.room_number}
                        </span>

                        <div>
                          <h3 className="font-bold">
                            {getGuestName(reservation.guest)}
                          </h3>

                          <p className="text-sm text-slate-500">
                            {reservation.guest?.phone}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-5">
                      <div>
                        <p className="text-xs uppercase text-slate-400">
                          Total
                        </p>

                        <p className="font-bold">
                          {formatMoney(total)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase text-slate-400">
                          Paid
                        </p>

                        <p className="font-bold text-green-600">
                          {formatMoney(paid)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase text-slate-400">
                          Due
                        </p>

                        <p className="font-bold text-red-600">
                          {formatMoney(due)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {due > 0 && (
                        <button
                          onClick={() =>
                            openPaymentModal(reservation)
                          }
                          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
                        >
                          Settle
                        </button>
                      )}

                      <button
                        onClick={() => openInvoice(reservation)}
                        className="rounded-xl border px-4 py-3 text-sm font-bold"
                      >
                        Bill
                      </button>

                      <button
                        onClick={() =>
                          updateReservationStatus(
                            reservation,
                            "checked_out"
                          )
                        }
                        className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white"
                      >
                        Check-Out
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </>
    );
  }

  function renderHousekeeping() {
    const cleaningRoomsList = rooms.filter(
      (room) => room.status === "cleaning"
    );

    return (
      <>
        {renderHeader(
          "Housekeeping",
          "Manage rooms that require cleaning after check-out."
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cleaningRoomsList.length === 0 ? (
            <div className="col-span-full">
              <EmptyState text="No rooms currently waiting for cleaning." />
            </div>
          ) : (
            cleaningRoomsList.map((room) => (
              <div
                key={room.id}
                className="rounded-2xl border border-yellow-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-slate-400">
                      Room
                    </p>

                    <h3 className="text-2xl font-bold">
                      {room.room_number}
                    </h3>
                  </div>

                  <div className="rounded-xl bg-yellow-100 px-3 py-2 text-sm font-bold text-yellow-800">
                    Cleaning
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-500">
                  {room.room_type?.name || "Room"}
                </p>

                <button
                  onClick={() =>
                    updateRoomStatus(room, "available")
                  }
                  className="mt-5 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white"
                >
                  Mark Room Clean
                </button>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  function renderReports() {
    const occupancyRate =
      rooms.length > 0
        ? Math.round((occupiedRooms / rooms.length) * 100)
        : 0;

    return (
      <>
        {renderHeader(
          "Reports",
          "Quick operational and financial overview."
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Revenue"
            value={formatMoney(totalRevenue)}
            subtitle="Reservation value"
            icon="₹"
          />

          <StatCard
            title="Collected"
            value={formatMoney(totalPaid)}
            subtitle="Payments received"
            icon="✓"
          />

          <StatCard
            title="Outstanding"
            value={formatMoney(dueBalance)}
            subtitle="Due from guests"
            icon="!"
          />

          <StatCard
            title="Occupancy"
            value={`${occupancyRate}%`}
            subtitle="Current rooms"
            icon="%"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="font-bold">Reservation Status</h2>

            <div className="mt-5 space-y-4">
              <ReportRow
                label="Confirmed"
                value={
                  reservations.filter(
                    (r) => r.status === "confirmed"
                  ).length
                }
              />

              <ReportRow
                label="Checked In"
                value={
                  reservations.filter(
                    (r) => r.status === "checked_in"
                  ).length
                }
              />

              <ReportRow
                label="Checked Out"
                value={
                  reservations.filter(
                    (r) => r.status === "checked_out"
                  ).length
                }
              />

              <ReportRow
                label="Cancelled"
                value={
                  reservations.filter(
                    (r) => r.status === "cancelled"
                  ).length
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="font-bold">Room Status</h2>

            <div className="mt-5 space-y-4">
              <ReportRow
                label="Available"
                value={availableRooms}
              />

              <ReportRow
                label="Occupied"
                value={occupiedRooms}
              />

              <ReportRow
                label="Cleaning"
                value={cleaningRooms}
              />

              <ReportRow
                label="Blocked"
                value={blockedRooms}
              />

              <ReportRow
                label="Total Rooms"
                value={rooms.length}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderActiveSection() {
    switch (activeSection) {
      case "Dashboard":
        return renderDashboard();
      case "Reservations":
        return renderReservations();
      case "Calendar":
        return renderCalendar();
      case "Guests":
        return renderGuests();
      case "Rooms":
        return renderRooms();
      case "Check-In":
        return renderCheckIn();
      case "Check-Out":
        return renderCheckOut();
      case "Housekeeping":
        return renderHousekeeping();
      case "Reports":
        return renderReports();
      default:
        return renderDashboard();
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-500">
            Loading Staynexa PMS...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="border-b px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 font-bold text-white">
                  S
                </div>

                <div>
                  <p className="font-bold">Staynexa</p>
                  <p className="text-xs text-slate-500">
                    Hotel PMS
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 py-5">
              <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Front Office
              </p>

              {menuItems.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setActiveSection(item);
                    setSearch("");
                    clearMessages();
                  }}
                  className={`mb-1 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                    activeSection === item
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="mr-3 inline-block w-5">
                    {item === "Dashboard"
                      ? "⌂"
                      : item === "Reservations"
                      ? "▣"
                      : item === "Calendar"
                      ? "▦"
                      : item === "Guests"
                      ? "♙"
                      : item === "Rooms"
                      ? "▤"
                      : item === "Check-In"
                      ? "↓"
                      : item === "Check-Out"
                      ? "↑"
                      : item === "Housekeeping"
                      ? "✦"
                      : "▥"}
                  </span>

                  {item}
                </button>
              ))}
            </div>

            <div className="mt-auto border-t p-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Property
                </p>

                <p className="mt-1 truncate text-sm font-bold">
                  {hotel?.name || "Hotel"}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {rooms.length} rooms
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="fixed left-0 right-0 top-0 z-30 border-b bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">Staynexa PMS</p>

              <p className="text-xs text-slate-500">
                {activeSection}
              </p>
            </div>

            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              {menuItems.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        <section className="min-w-0 flex-1 pt-20 lg:pt-0">
          <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
            {message && (
              <div className="mb-5 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                <span>{message}</span>

                <button onClick={() => setMessage("")}>
                  ×
                </button>
              </div>
            )}

            {error && (
              <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                <span>{error}</span>

                <button onClick={() => setError("")}>
                  ×
                </button>
              </div>
            )}

            {saving && (
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Saving changes...
              </div>
            )}

            {renderActiveSection()}
          </div>
        </section>
      </div>

      {showReservationModal && (
        <Modal title="New Reservation" onClose={() => setShowReservationModal(false)}>
          <div className="space-y-5">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">
                Selected Room
              </p>

              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">
                    {selectedRoom
                      ? `Room ${selectedRoom.room_number}`
                      : "Select room below"}
                  </p>

                  <p className="text-sm text-slate-500">
                    {selectedRoom?.room_type?.name || ""}
                  </p>
                </div>

                <p className="font-bold">
                  {selectedRoom
                    ? formatMoney(
                        Number(
                          selectedRoom.room_type?.base_price || 0
                        )
                      )
                    : "-"}
                  /night
                </p>
              </div>
            </div>

            {!selectedRoom && (
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Select Room
                </label>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {rooms
                    .filter((room) => room.status === "available")
                    .map((room) => (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        className="rounded-xl border p-3 text-left hover:border-slate-900"
                      >
                        <p className="font-bold">
                          Room {room.room_number}
                        </p>

                        <p className="text-xs text-slate-500">
                          {room.room_type?.name}
                        </p>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <ReservationFields
              form={reservationForm}
              setForm={setReservationForm}
            />

            <ModalButtons
              onCancel={() => setShowReservationModal(false)}
              onSave={createReservation}
              text={saving ? "Saving..." : "Create Reservation"}
            />
          </div>
        </Modal>
      )}

      {showEditModal && selectedReservation && (
        <Modal
          title="Edit Reservation"
          onClose={() => setShowEditModal(false)}
        >
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Room
              </label>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {rooms
                  .filter(
                    (room) =>
                      room.status === "available" ||
                      room.id === selectedReservation.room_id
                  )
                  .map((room) => (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`rounded-xl border p-3 text-left ${
                        selectedRoom?.id === room.id
                          ? "border-slate-900 bg-slate-50"
                          : ""
                      }`}
                    >
                      <p className="font-bold">
                        Room {room.room_number}
                      </p>

                      <p className="text-xs text-slate-500">
                        {room.room_type?.name}
                      </p>
                    </button>
                  ))}
              </div>
            </div>

            <ReservationFields
              form={reservationForm}
              setForm={setReservationForm}
            />

            <ModalButtons
              onCancel={() => setShowEditModal(false)}
              onSave={editReservation}
              text={saving ? "Updating..." : "Save Changes"}
            />
          </div>
        </Modal>
      )}

      {showBlockModal && selectedRoom && (
        <Modal
          title={`Block Room ${selectedRoom.room_number}`}
          subtitle="Prevent this room from being sold"
          onClose={() => setShowBlockModal(false)}
        >
          <div className="space-y-5">
            <Input
              label="Start Date"
              type="date"
              value={blockForm.startDate}
              onChange={(value) =>
                setBlockForm((old) => ({
                  ...old,
                  startDate: value,
                }))
              }
            />

            <Input
              label="End Date"
              type="date"
              value={blockForm.endDate}
              onChange={(value) =>
                setBlockForm((old) => ({
                  ...old,
                  endDate: value,
                }))
              }
            />

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Reason
              </label>

              <select
                value={blockForm.reason}
                onChange={(e) =>
                  setBlockForm((old) => ({
                    ...old,
                    reason: e.target.value,
                  }))
                }
                className="w-full rounded-xl border px-4 py-3 text-sm"
              >
                <option>Maintenance</option>
                <option>Owner Block</option>
                <option>Deep Cleaning</option>
                <option>Renovation</option>
                <option>Other</option>
              </select>
            </div>

            <ModalButtons
              onCancel={() => setShowBlockModal(false)}
              onSave={blockRoom}
              text={saving ? "Blocking..." : "Block Room"}
            />
          </div>
        </Modal>
      )}

      {showPaymentModal && selectedReservation && (
        <PaymentModal
          reservation={selectedReservation}
          form={paymentForm}
          setForm={setPaymentForm}
          onClose={() => setShowPaymentModal(false)}
          onSave={recordPayment}
          saving={saving}
        />
      )}

      {showInvoiceModal && selectedReservation && (
        <InvoiceModal
          hotel={hotel}
          reservation={selectedReservation}
          onClose={() => setShowInvoiceModal(false)}
          onPayment={() => {
            setShowInvoiceModal(false);
            openPaymentModal(selectedReservation);
          }}
        />
      )}
    </main>
  );
}

function ReservationFields({
  form,
  setForm,
}: {
  form: {
    firstName: string;
    lastName: string;
    phone: string;
    checkIn: string;
    checkOut: string;
    adults: string;
    children: string;
    specialRequests: string;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
}) {
  return (
    <>
      <div>
        <h3 className="mb-3 font-bold">Guest Details</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First Name"
            value={form.firstName}
            onChange={(value) =>
              setForm((old) => ({
                ...old,
                firstName: value,
              }))
            }
          />

          <Input
            label="Last Name"
            value={form.lastName}
            onChange={(value) =>
              setForm((old) => ({
                ...old,
                lastName: value,
              }))
            }
          />

          <Input
            label="Phone"
            value={form.phone}
            onChange={(value) =>
              setForm((old) => ({
                ...old,
                phone: value,
              }))
            }
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-bold">Stay Details</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Check-In"
            type="date"
            value={form.checkIn}
            onChange={(value) =>
              setForm((old) => ({
                ...old,
                checkIn: value,
              }))
            }
          />

          <Input
            label="Check-Out"
            type="date"
            value={form.checkOut}
            onChange={(value) =>
              setForm((old) => ({
                ...old,
                checkOut: value,
              }))
            }
          />

          <Input
            label="Adults"
            type="number"
            value={form.adults}
            onChange={(value) =>
              setForm((old) => ({
                ...old,
                adults: value,
              }))
            }
          />

          <Input
            label="Children"
            type="number"
            value={form.children}
            onChange={(value) =>
              setForm((old) => ({
                ...old,
                children: value,
              }))
            }
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">
          Special Requests
        </label>

        <textarea
          value={form.specialRequests}
          onChange={(e) =>
            setForm((old) => ({
              ...old,
              specialRequests: e.target.value,
            }))
          }
          rows={3}
          placeholder="Optional guest requests..."
          className="w-full rounded-xl border px-4 py-3 text-sm"
        />
      </div>
    </>
  );
}

function PaymentModal({
  reservation,
  form,
  setForm,
  onClose,
  onSave,
  saving,
}: {
  reservation: Reservation;
  form: {
    amount: string;
    method: string;
    note: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      amount: string;
      method: string;
      note: string;
    }>
  >;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const total = Number(reservation.total_amount || 0);
  const paid = Number(reservation.paid_amount || 0);
  const due = total - paid;
  const entered = Number(form.amount || 0);
  const remaining = Math.max(0, due - entered);

  return (
    <Modal
      title="Record Payment"
      subtitle={getGuestName(reservation.guest)}
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <SummaryBox label="Total" value={formatMoney(total)} />
          <SummaryBox label="Paid" value={formatMoney(paid)} />
          <SummaryBox
            label="Due"
            value={formatMoney(due)}
            danger={due > 0}
          />
        </div>

        <Input
          label="Payment Amount"
          type="number"
          value={form.amount}
          onChange={(value) =>
            setForm((old) => ({
              ...old,
              amount: value,
            }))
          }
        />

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Payment Method
          </label>

          <select
            value={form.method}
            onChange={(e) =>
              setForm((old) => ({
                ...old,
                method: e.target.value,
              }))
            }
            className="w-full rounded-xl border px-4 py-3 text-sm"
          >
            <option>Cash</option>
            <option>UPI</option>
            <option>Card</option>
            <option>Bank Transfer</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Note
          </label>

          <textarea
            value={form.note}
            onChange={(e) =>
              setForm((old) => ({
                ...old,
                note: e.target.value,
              }))
            }
            rows={2}
            placeholder="Optional payment note"
            className="w-full rounded-xl border px-4 py-3 text-sm"
          />
        </div>

        <div
          className={`rounded-xl p-4 ${
            remaining === 0
              ? "bg-green-50 text-green-800"
              : "bg-blue-50 text-blue-800"
          }`}
        >
          <div className="flex justify-between">
            <span>Remaining balance</span>

            <strong>{formatMoney(remaining)}</strong>
          </div>

          {remaining === 0 && (
            <p className="mt-1 text-xs font-semibold">
              This payment will fully settle the reservation.
            </p>
          )}
        </div>

        <ModalButtons
          onCancel={onClose}
          onSave={onSave}
          text={saving ? "Saving..." : "Record Payment"}
        />
      </div>
    </Modal>
  );
}

function InvoiceModal({
  hotel,
  reservation,
  onClose,
  onPayment,
}: {
  hotel: Hotel | null;
  reservation: Reservation;
  onClose: () => void;
  onPayment: () => void;
}) {
  const total = Number(reservation.total_amount || 0);
  const paid = Number(reservation.paid_amount || 0);
  const due = total - paid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-5 print:hidden">
          <div>
            <h2 className="text-xl font-bold">
              Guest Bill
            </h2>

            <p className="text-sm text-slate-500">
              Professional invoice preview
            </p>
          </div>

          <div className="flex gap-2">
            {due > 0 && (
              <button
                onClick={onPayment}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
              >
                Add Payment
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            >
              Print
            </button>

            <button
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col justify-between gap-5 border-b pb-6 sm:flex-row">
            <div>
              <h1 className="text-2xl font-black">
                {hotel?.name || "Hotel"}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {hotel?.address || ""}
              </p>

              <p className="text-sm text-slate-500">
                {hotel?.phone || ""}
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Invoice
              </p>

              <p className="mt-1 text-lg font-bold">
                {reservation.reservation_number || "RES"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {formatDate(reservation.check_in)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">
                Guest
              </p>

              <p className="mt-2 font-bold">
                {getGuestName(reservation.guest)}
              </p>

              <p className="text-sm text-slate-500">
                {reservation.guest?.phone || ""}
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs font-bold uppercase text-slate-400">
                Room
              </p>

              <p className="mt-2 font-bold">
                Room {reservation.room?.room_number || "-"}
              </p>

              <p className="text-sm text-slate-500">
                {reservation.room?.room_type?.name || ""}
              </p>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500">
                    Description
                  </th>

                  <th className="px-4 py-3 text-right text-xs uppercase text-slate-500">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-t">
                  <td className="px-4 py-4">
                    <p className="font-semibold">
                      Room Stay
                    </p>

                    <p className="text-xs text-slate-500">
                      {formatDate(reservation.check_in)} —{" "}
                      {formatDate(reservation.check_out)}
                    </p>
                  </td>

                  <td className="px-4 py-4 text-right font-semibold">
                    {formatMoney(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 ml-auto max-w-sm space-y-3">
            <div className="flex justify-between text-sm">
              <span>Total</span>
              <span className="font-semibold">
                {formatMoney(total)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Paid</span>
              <span className="font-semibold text-green-600">
                {formatMoney(paid)}
              </span>
            </div>

            <div className="flex justify-between border-t pt-3">
              <span className="font-bold">
                Balance Due
              </span>

              <span
                className={`text-xl font-black ${
                  due > 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {due > 0
                  ? formatMoney(due)
                  : "SETTLED"}
              </span>
            </div>
          </div>

          <div className="mt-10 border-t pt-5 text-center">
            <p className="text-xs text-slate-400">
              Thank you for staying with us.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>

            {subtitle && (
              <p className="text-sm text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-2xl text-slate-400"
          >
            ×
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalButtons({
  onCancel,
  onSave,
  text,
}: {
  onCancel: () => void;
  onSave: () => void;
  text: string;
}) {
  return (
    <div className="flex justify-end gap-3 border-t pt-5">
      <button
        onClick={onCancel}
        className="rounded-xl border px-5 py-3 text-sm font-semibold"
      >
        Cancel
      </button>

      <button
        onClick={onSave}
        className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white"
      >
        {text}
      </button>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-500"
      />
    </div>
  );
}

function SummaryBox({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${
        danger ? "bg-red-50" : "bg-slate-50"
      }`}
    >
      <p className="text-xs font-semibold uppercase text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 font-bold ${
          danger ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>

          <p className="mt-2 text-2xl font-bold">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {subtitle}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 font-bold">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-400">
        {title}
      </p>

      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function RoomStatusSummary({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function RoomCard({
  room,
  onReserve,
  onBlock,
  onStatus,
  large = false,
}: {
  room: Room;
  onReserve: () => void;
  onBlock: () => void;
  onStatus: (status: string) => void;
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${getRoomStatusClasses(
        room.status
      )}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase opacity-60">
            Floor {room.floor || "-"}
          </p>

          <h3
            className={`mt-1 font-bold text-slate-900 ${
              large ? "text-2xl" : "text-xl"
            }`}
          >
            {room.room_number}
          </h3>
        </div>

        <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold uppercase">
          {room.status}
        </span>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {room.room_type?.name || "Room"}
      </p>

      <p className="mt-1 text-sm font-bold">
        {formatMoney(
          Number(room.room_type?.base_price || 0)
        )}

        <span className="text-xs font-normal text-slate-400">
          {" "}
          / night
        </span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {room.status === "available" && (
          <button
            onClick={onReserve}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"
          >
            Reserve
          </button>
        )}

        <button
          onClick={onBlock}
          className="rounded-lg border bg-white px-3 py-2 text-xs font-bold"
        >
          Block
        </button>
      </div>

      <select
        value={room.status}
        onChange={(e) => onStatus(e.target.value)}
        className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-xs font-semibold"
      >
        <option value="available">Available</option>
        <option value="occupied">Occupied</option>
        <option value="cleaning">Cleaning</option>
        <option value="blocked">Blocked</option>
        <option value="maintenance">Maintenance</option>
      </select>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
        —
      </div>

      <p className="mt-3 text-sm font-medium text-slate-500">
        {text}
      </p>
    </div>
  );
}

function Legend({
  color,
  text,
}: {
  color: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-semibold text-slate-600">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {text}
    </div>
  );
}

function ReportRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>

      <span className="font-bold">{value}</span>
    </div>
  );
}
