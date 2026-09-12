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

type Payment = {
  id: string;
  hotel_id: string;
  reservation_id: string;
  amount: number;
  payment_method: string;
  reference_number?: string | null;
  notes?: string | null;
  created_at: string;
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

function formatDateTime(value: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getGuestName(guest?: Guest | null) {
  if (!guest) return "Guest";

  return (
    `${guest.first_name || ""} ${guest.last_name || ""}`.trim() || "Guest"
  );
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

function getPaymentMethodLabel(method: string) {
  switch (method) {
    case "Cash":
      return "Cash";

    case "UPI":
      return "UPI";

    case "Card":
      return "Card";

    case "Bank Transfer":
      return "Bank Transfer";

    default:
      return method || "Cash";
  }
}

export default function Home() {
  const [activeSection, setActiveSection] = useState("Dashboard");

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);

  const [search, setSearch] = useState("");

  const [checkInGuestSearch, setCheckInGuestSearch] = useState("");
  const [checkOutGuestSearch, setCheckOutGuestSearch] = useState("");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

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
        paymentsResult,
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

        supabase
          .from("payments")
          .select("*")
          .eq("hotel_id", HOTEL_ID)
          .order("created_at", { ascending: false }),
      ]);

      if (hotelResult.error) throw hotelResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (guestsResult.error) throw guestsResult.error;
      if (reservationsResult.error) throw reservationsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      setHotel(hotelResult.data);
      setRooms((roomsResult.data || []) as Room[]);
      setGuests((guestsResult.data || []) as Guest[]);
      setReservations((reservationsResult.data || []) as Reservation[]);
      setPayments((paymentsResult.data || []) as Payment[]);
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

    if (room) {
      setSelectedRoom(room);
    } else {
      setSelectedRoom(null);
    }

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

    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / millisecondsPerDay
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

      setMessage(
        `Reservation created successfully. Total: ${formatMoney(totalAmount)}`
      );

      setShowReservationModal(false);

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to create reservation.");
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
      setError("Please select block start and end dates.");
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

      if (blockResult.error) {
        throw blockResult.error;
      }

      const roomResult = await supabase
        .from("rooms")
        .update({
          status: "blocked",
        })
        .eq("id", selectedRoom.id);

      if (roomResult.error) {
        throw roomResult.error;
      }

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
        question = `This guest has a balance of ${formatMoney(
          due
        )}. Do you still want to continue to check-OUT ${guestName}?`;
      } else {
        question = `Do you want to continue to check-OUT ${guestName} from Room ${roomNumber}?`;
      }
    }

    if (status === "cancelled") {
      question = `Do you want to cancel reservation ${
        reservation.reservation_number || ""
      }?`;
    }

    if (question && !window.confirm(question)) {
      return;
    }

    setSaving(true);

    try {
      const reservationResult = await supabase
        .from("reservations")
        .update({
          status,
        })
        .eq("id", reservation.id);

      if (reservationResult.error) {
        throw reservationResult.error;
      }

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

        if (roomResult.error) {
          throw roomResult.error;
        }
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
      setError(
        err?.message ||
          "Unable to update reservation. Check your reservation status database constraint."
      );
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

      if (result.error) {
        throw result.error;
      }

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

  function openPayment(reservation: Reservation) {
    clearMessages();

    const total = Number(reservation.total_amount || 0);
    const paid = Number(reservation.paid_amount || 0);
    const due = Math.max(0, total - paid);

    setSelectedReservation(reservation);
    setPaymentAmount(due > 0 ? due.toString() : "");
    setPaymentMethod("Cash");
    setPaymentReference("");
    setPaymentNotes("");
    setShowPaymentModal(true);
  }

  async function recordPayment() {
    clearMessages();

    if (!selectedReservation) {
      setError("Please select a reservation.");
      return;
    }

    const amount = Number(paymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    const total = Number(selectedReservation.total_amount || 0);
    const paid = Number(selectedReservation.paid_amount || 0);
    const due = Math.max(0, total - paid);

    if (amount > due) {
      setError(
        `Payment cannot exceed the current due amount of ${formatMoney(
          due
        )}.`
      );
      return;
    }

    setSaving(true);

    try {
      const paymentResult = await supabase
        .from("payments")
        .insert({
          hotel_id: HOTEL_ID,
          reservation_id: selectedReservation.id,
          amount,
          payment_method: paymentMethod,
          reference_number: paymentReference.trim() || null,
          notes: paymentNotes.trim() || null,
        })
        .select()
        .single();

      if (paymentResult.error) {
        throw paymentResult.error;
      }

      const newPaidAmount = paid + amount;

      const reservationResult = await supabase
        .from("reservations")
        .update({
          paid_amount: newPaidAmount,
        })
        .eq("id", selectedReservation.id);

      if (reservationResult.error) {
        throw reservationResult.error;
      }

      setShowPaymentModal(false);
      setSelectedReservation(null);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");

      if (newPaidAmount >= total) {
        setMessage(
          `Payment recorded successfully. Reservation is now SETTLED.`
        );
      } else {
        setMessage(
          `Payment of ${formatMoney(
            amount
          )} recorded successfully. Remaining due: ${formatMoney(
            total - newPaidAmount
          )}.`
        );
      }

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to record payment.");
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  const todayReservations = useMemo(() => {
    return reservations.filter(
      (reservation) =>
        reservation.check_in === today ||
        reservation.check_out === today
    );
  }, [reservations, today]);

  const checkedInReservations = useMemo(() => {
    return reservations.filter(
      (reservation) => reservation.status === "checked_in"
    );
  }, [reservations]);

  const confirmedReservations = useMemo(() => {
    return reservations.filter(
      (reservation) => reservation.status === "confirmed"
    );
  }, [reservations]);

  const totalRevenue = useMemo(() => {
    return reservations.reduce(
      (sum, reservation) => sum + Number(reservation.total_amount || 0),
      0
    );
  }, [reservations]);

  const totalPaid = useMemo(() => {
    return reservations.reduce(
      (sum, reservation) => sum + Number(reservation.paid_amount || 0),
      0
    );
  }, [reservations]);

  const dueBalance = Math.max(0, totalRevenue - totalPaid);

  const totalPaymentTransactions = useMemo(() => {
    return payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }, [payments]);

  const settledReservations = useMemo(() => {
    return reservations.filter(
      (reservation) =>
        Number(reservation.paid_amount || 0) >=
        Number(reservation.total_amount || 0)
    );
  }, [reservations]);

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
          <h1 className="text-2xl font-bold text-slate-900">
            {title}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        </div>

        {activeSection === "Reservations" && (
          <button
            onClick={() => openReservationModal()}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
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
                className="text-sm font-semibold text-slate-700 hover:underline"
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
                      <p className="text-sm font-semibold text-slate-900">
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

          <MiniStat
            title="Settled"
            value={settledReservations.length}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                Payment Overview
              </h2>

              <p className="text-sm text-slate-500">
                All payment transactions recorded in Staynexa.
              </p>
            </div>

            <div className="text-left md:text-right">
              <p className="text-xs uppercase text-slate-400">
                Transactions
              </p>

              <p className="text-xl font-black text-slate-900">
                {payments.length}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <DashboardMoneyCard
              label="Reservation Value"
              value={totalRevenue}
            />

            <DashboardMoneyCard
              label="Collected"
              value={totalPaymentTransactions}
            />

            <DashboardMoneyCard
              label="Outstanding"
              value={dueBalance}
            />
          </div>
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
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />

            <button
              onClick={() => setSearch("")}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Reservation
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Guest
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Room
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Stay
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Amount
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
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

                    const due = Math.max(0, total - paid);

                    const isSettled = due <= 0;

                    return (
                      <tr
                        key={reservation.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {reservation.reservation_number || "RES"}
                          </p>

                          <p className="text-xs text-slate-400">
                            {reservation.id.slice(0, 8)}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {getGuestName(reservation.guest)}
                          </p>

                          <p className="text-xs text-slate-500">
                            {reservation.guest?.phone || "-"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-900">
                            {reservation.room?.room_number || "-"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          <div>
                            {formatDate(reservation.check_in)}
                          </div>

                          <div>
                            {formatDate(reservation.check_out)}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {formatMoney(total)}
                          </p>

                          {isSettled ? (
                            <span className="mt-1 inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                              SETTLED
                            </span>
                          ) : (
                            <p className="text-xs font-semibold text-red-600">
                              Due {formatMoney(due)}
                            </p>
                          )}
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
                            {reservation.status === "confirmed" && (
                              <button
                                onClick={() =>
                                  updateReservationStatus(
                                    reservation,
                                    "checked_in"
                                  )
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700"
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
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                              >
                                Check-Out
                              </button>
                            )}

                            {!isSettled && (
                              <button
                                onClick={() =>
                                  openPayment(reservation)
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700"
                              >
                                Payment
                              </button>
                            )}

                            <button
                              onClick={() =>
                                openInvoice(reservation)
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
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

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50">
              <div className="p-4 text-sm font-bold text-slate-700">
                Room
              </div>

              {Array.from({ length: 7 }).map((_, index) => {
                const date = new Date();

                date.setDate(date.getDate() + index);

                const value = date.toISOString().split("T")[0];

                return (
                  <div
                    key={value}
                    className="border-l border-slate-200 p-4 text-center"
                  >
                    <p className="text-xs font-semibold text-slate-400">
                      {date.toLocaleDateString("en-IN", {
                        weekday: "short",
                      })}
                    </p>

                    <p className="mt-1 font-bold text-slate-900">
                      {date.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {rooms.map((room) => (
              <div
                key={room.id}
                className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-slate-100"
              >
                <div className="p-4">
                  <p className="font-bold text-slate-900">
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
                      className="relative min-h-[80px] border-l border-slate-100 p-2"
                    >
                      {booking && (
                        <button
                          onClick={() => openInvoice(booking)}
                          className={`h-full w-full rounded-lg p-2 text-left shadow-sm ${
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

                          <p className="mt-1 text-[10px] capitalize">
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

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guest name or phone..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
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
                (reservation) => reservation.guest_id === guest.id
              );

              return (
                <div
                  key={guest.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
                      {guest.first_name?.[0]?.toUpperCase() || "G"}
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {guestReservations.length} stays
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    {getGuestName(guest)}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {guest.phone}
                  </p>

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold uppercase text-slate-400">
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
      (reservation) =>
        reservation.status === "confirmed" &&
        reservation.check_in <= today
    );

    const filtered = pendingCheckIns.filter((reservation) => {
      const value = checkInGuestSearch.toLowerCase();

      return (
        getGuestName(reservation.guest)
          .toLowerCase()
          .includes(value) ||
        reservation.guest?.phone
          ?.toLowerCase()
          .includes(value) ||
        reservation.room?.room_number
          ?.toLowerCase()
          .includes(value)
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
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none shadow-sm focus:border-slate-500"
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
                      <h3 className="font-bold text-slate-900">
                        {getGuestName(reservation.guest)}
                      </h3>

                      <p className="text-sm text-slate-500">
                        {reservation.guest?.phone}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
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
                      className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700"
                    >
                      Continue to Check-In
                    </button>

                    <button
                      onClick={() => openInvoice(reservation)}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700"
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
    const filtered = checkedInReservations.filter(
      (reservation) => {
        const value = checkOutGuestSearch.toLowerCase();

        return (
          getGuestName(reservation.guest)
            .toLowerCase()
            .includes(value) ||
          reservation.guest?.phone
            ?.toLowerCase()
            .includes(value) ||
          reservation.room?.room_number
            ?.toLowerCase()
            .includes(value)
        );
      }
    );

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
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none shadow-sm focus:border-slate-500"
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

              const due = Math.max(0, total - paid);

              const isSettled = due <= 0;

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
                          <h3 className="font-bold text-slate-900">
                            {getGuestName(reservation.guest)}
                          </h3>

                          <p className="text-sm text-slate-500">
                            {reservation.guest?.phone}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase text-slate-400">
                          Total
                        </p>

                        <p className="font-bold text-slate-900">
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

                        {isSettled ? (
                          <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                            SETTLED
                          </span>
                        ) : (
                          <p className="font-bold text-red-600">
                            {formatMoney(due)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!isSettled && (
                        <button
                          onClick={() =>
                            openPayment(reservation)
                          }
                          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white"
                        >
                          Payment
                        </button>
                      )}

                      <button
                        onClick={() =>
                          openInvoice(reservation)
                        }
                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
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
                        className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
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
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Room
                    </p>

                    <h3 className="mt-1 text-2xl font-bold text-slate-900">
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
                  className="mt-5 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700"
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900">
              Reservation Status
            </h2>

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

              <ReportRow
                label="Settled"
                value={settledReservations.length}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900">
              Room Status
            </h2>

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

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-900">
            Payment Summary
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <DashboardMoneyCard
              label="Total Transactions"
              value={payments.length}
              isCount
            />

            <DashboardMoneyCard
              label="Total Collected"
              value={totalPaymentTransactions}
            />

            <DashboardMoneyCard
              label="Outstanding"
              value={dueBalance}
            />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-bold text-slate-900">
              Recent Payments
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Date
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Reservation
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Method
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase text-slate-500">
                    Reference
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-bold uppercase text-slate-500">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8">
                      <EmptyState text="No payments recorded yet." />
                    </td>
                  </tr>
                ) : (
                  payments.slice(0, 20).map((payment) => {
                    const reservation = reservations.find(
                      (item) =>
                        item.id === payment.reservation_id
                    );

                    return (
                      <tr
                        key={payment.id}
                        className="border-t border-slate-100"
                      >
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDateTime(payment.created_at)}
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {reservation
                              ? getGuestName(reservation.guest)
                              : "Guest"}
                          </p>

                          <p className="text-xs text-slate-400">
                            {reservation?.reservation_number ||
                              payment.reservation_id.slice(0, 8)}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                          {getPaymentMethodLabel(
                            payment.payment_method
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {payment.reference_number || "-"}
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-green-600">
                          {formatMoney(
                            Number(payment.amount || 0)
                          )}
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

          <p className="mt-4 text-sm font-medium text-slate-500">
            Loading Staynexa PMS...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="border-b border-slate-200 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 font-bold text-white">
                  S
                </div>

                <div>
                  <p className="font-bold text-slate-900">
                    Staynexa
                  </p>

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
                  className={`mb-1 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeSection === item
                      ? "bg-slate-900 text-white shadow-sm"
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

            <div className="mt-auto border-t border-slate-200 p-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Property
                </p>

                <p className="mt-1 truncate text-sm font-bold text-slate-900">
                  {hotel?.name || "Hotel"}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {rooms.length} rooms
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* MOBILE HEADER */}
        <div className="fixed left-0 right-0 top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-900">
                Staynexa PMS
              </p>

              <p className="text-xs text-slate-500">
                {activeSection}
              </p>
            </div>

            <select
              value={activeSection}
              onChange={(e) =>
                setActiveSection(e.target.value)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
            >
              {menuItems.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        {/* MAIN */}
        <section className="min-w-0 flex-1 pt-20 lg:pt-0">
          <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
            {message && (
              <div className="mb-5 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                <span>{message}</span>

                <button
                  onClick={() => setMessage("")}
                  className="font-bold"
                >
                  ×
                </button>
              </div>
            )}

            {error && (
              <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                <span>{error}</span>

                <button
                  onClick={() => setError("")}
                  className="font-bold"
                >
                  ×
                </button>
              </div>
            )}

            {saving && (
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                Saving changes...
              </div>
            )}

            {renderActiveSection()}
          </div>
        </section>
      </div>

      {/* RESERVATION MODAL */}
      {showReservationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  New Reservation
                </h2>

                <p className="text-sm text-slate-500">
                  Create a new guest reservation
                </p>
              </div>

              <button
                onClick={() =>
                  setShowReservationModal(false)
                }
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Selected Room
                </p>

                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-slate-900">
                      {selectedRoom
                        ? `Room ${selectedRoom.room_number}`
                        : "Select room below"}
                    </p>

                    <p className="text-sm text-slate-500">
                      {selectedRoom?.room_type?.name || ""}
                    </p>
                  </div>

                  <p className="font-bold text-slate-900">
                    {selectedRoom
                      ? formatMoney(
                          Number(
                            selectedRoom.room_type
                              ?.base_price || 0
                          )
                        )
                      : "-"}
                    /night
                  </p>
                </div>
              </div>

              {!selectedRoom && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Select Room
                  </label>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {rooms
                      .filter(
                        (room) =>
                          room.status === "available"
                      )
                      .map((room) => (
                        <button
                          key={room.id}
                          onClick={() =>
                            setSelectedRoom(room)
                          }
                          className="rounded-xl border border-slate-200 p-3 text-left hover:border-slate-900"
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

              <div>
                <h3 className="mb-3 font-bold text-slate-900">
                  Guest Details
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="First Name"
                    value={reservationForm.firstName}
                    onChange={(value) =>
                      setReservationForm((old) => ({
                        ...old,
                        firstName: value,
                      }))
                    }
                  />

                  <Input
                    label="Last Name"
                    value={reservationForm.lastName}
                    onChange={(value) =>
                      setReservationForm((old) => ({
                        ...old,
                        lastName: value,
                      }))
                    }
                  />

                  <Input
                    label="Phone"
                    value={reservationForm.phone}
                    onChange={(value) =>
                      setReservationForm((old) => ({
                        ...old,
                        phone: value,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-bold text-slate-900">
                  Stay Details
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Check-In"
                    type="date"
                    value={reservationForm.checkIn}
                    onChange={(value) =>
                      setReservationForm((old) => ({
                        ...old,
                        checkIn: value,
                      }))
                    }
                  />

                  <Input
                    label="Check-Out"
                    type="date"
                    value={reservationForm.checkOut}
                    onChange={(value) =>
                      setReservationForm((old) => ({
                        ...old,
                        checkOut: value,
                      }))
                    }
                  />

                  <Input
                    label="Adults"
                    type="number"
                    value={reservationForm.adults}
                    onChange={(value) =>
                      setReservationForm((old) => ({
                        ...old,
                        adults: value,
                      }))
                    }
                  />

                  <Input
                    label="Children"
                    type="number"
                    value={reservationForm.children}
                    onChange={(value) =>
                      setReservationForm((old) => ({
                        ...old,
                        children: value,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Special Requests
                </label>

                <textarea
                  value={reservationForm.specialRequests}
                  onChange={(e) =>
                    setReservationForm((old) => ({
                      ...old,
                      specialRequests: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Optional guest requests..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  onClick={() =>
                    setShowReservationModal(false)
                  }
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  onClick={createReservation}
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Create Reservation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK ROOM MODAL */}
      {showBlockModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Block Room {selectedRoom.room_number}
                </h2>

                <p className="text-sm text-slate-500">
                  Prevent this room from being sold
                </p>
              </div>

              <button
                onClick={() =>
                  setShowBlockModal(false)
                }
                className="text-2xl text-slate-400"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-6">
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
                <label className="mb-2 block text-sm font-semibold text-slate-700">
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
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                >
                  <option>Maintenance</option>
                  <option>Owner Block</option>
                  <option>Deep Cleaning</option>
                  <option>Renovation</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  onClick={() =>
                    setShowBlockModal(false)
                  }
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  onClick={blockRoom}
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving ? "Blocking..." : "Block Room"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && selectedReservation && (
        <PaymentModal
          reservation={selectedReservation}
          payments={payments.filter(
            (payment) =>
              payment.reservation_id ===
              selectedReservation.id
          )}
          paymentAmount={paymentAmount}
          setPaymentAmount={setPaymentAmount}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentReference={paymentReference}
          setPaymentReference={setPaymentReference}
          paymentNotes={paymentNotes}
          setPaymentNotes={setPaymentNotes}
          onSave={recordPayment}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedReservation(null);
            setPaymentAmount("");
            setPaymentReference("");
            setPaymentNotes("");
          }}
          saving={saving}
        />
      )}

      {/* BILL MODAL */}
      {showInvoiceModal && selectedReservation && (
        <InvoiceModal
          hotel={hotel}
          reservation={selectedReservation}
          payments={payments.filter(
            (payment) =>
              payment.reservation_id ===
              selectedReservation.id
          )}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </main>
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
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
      />
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {subtitle}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

function DashboardMoneyCard({
  label,
  value,
  isCount = false,
}: {
  label: string;
  value: number;
  isCount?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-slate-900">
        {isCount ? value : formatMoney(value)}
      </p>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-400">
        {title}
      </p>

      <p className="mt-1 text-xl font-bold text-slate-900">
        {value}
      </p>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-slate-900">
        {value}
      </p>
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

      <p className="mt-1 text-sm font-bold text-slate-900">
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
        >
          Block
        </button>
      </div>

      <select
        value={room.status}
        onChange={(e) =>
          onStatus(e.target.value)
        }
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
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
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
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
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
      <span
        className={`h-3 w-3 rounded-full ${color}`}
      />

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
    <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0">
      <span className="text-sm text-slate-600">
        {label}
      </span>

      <span className="font-bold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function PaymentModal({
  reservation,
  payments,
  paymentAmount,
  setPaymentAmount,
  paymentMethod,
  setPaymentMethod,
  paymentReference,
  setPaymentReference,
  paymentNotes,
  setPaymentNotes,
  onSave,
  onClose,
  saving,
}: {
  reservation: Reservation;
  payments: Payment[];
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  paymentReference: string;
  setPaymentReference: (value: string) => void;
  paymentNotes: string;
  setPaymentNotes: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const total = Number(
    reservation.total_amount || 0
  );

  const paid = Number(
    reservation.paid_amount || 0
  );

  const due = Math.max(0, total - paid);

  const isSettled = due <= 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Record Payment
            </h2>

            <p className="text-sm text-slate-500">
              {getGuestName(reservation.guest)} · Room{" "}
              {reservation.room?.room_number || "-"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-2xl text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">
                Total
              </p>

              <p className="mt-1 font-bold text-slate-900">
                {formatMoney(total)}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-green-600">
                Paid
              </p>

              <p className="mt-1 font-bold text-green-700">
                {formatMoney(paid)}
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs text-red-600">
                Due
              </p>

              {isSettled ? (
                <p className="mt-1 font-black text-green-700">
                  SETTLED
                </p>
              ) : (
                <p className="mt-1 font-bold text-red-700">
                  {formatMoney(due)}
                </p>
              )}
            </div>
          </div>

          {!isSettled && (
            <>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Payment Amount
                </label>

                <input
                  type="number"
                  min="0"
                  max={due}
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-bold outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Payment Method
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-slate-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">
                    Bank Transfer
                  </option>
                </select>
              </div>

              {(paymentMethod === "UPI" ||
                paymentMethod === "Card" ||
                paymentMethod === "Bank Transfer") && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Reference Number
                  </label>

                  <input
                    value={paymentReference}
                    onChange={(e) =>
                      setPaymentReference(
                        e.target.value
                      )
                    }
                    placeholder="Transaction / reference number"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Notes
                </label>

                <textarea
                  value={paymentNotes}
                  onChange={(e) =>
                    setPaymentNotes(e.target.value)
                  }
                  rows={2}
                  placeholder="Optional payment notes..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <button
                onClick={() =>
                  setPaymentAmount(
                    due.toString()
                  )
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Pay Full Due: {formatMoney(due)}
              </button>
            </>
          )}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                Payment History
              </h3>

              <span className="text-xs text-slate-400">
                {payments.length} transaction
                {payments.length === 1 ? "" : "s"}
              </span>
            </div>

            {payments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">
                No payments recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {getPaymentMethodLabel(
                          payment.payment_method
                        )}
                      </p>

                      <p className="text-xs text-slate-500">
                        {formatDateTime(
                          payment.created_at
                        )}
                      </p>

                      {payment.reference_number && (
                        <p className="mt-1 text-xs text-slate-400">
                          Ref:{" "}
                          {payment.reference_number}
                        </p>
                      )}
                    </div>

                    <p className="font-black text-green-600">
                      {formatMoney(
                        Number(payment.amount || 0)
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Close
            </button>

            {!isSettled && (
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Payment"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceModal({
  hotel,
  reservation,
  payments,
  onClose,
}: {
  hotel: Hotel | null;
  reservation: Reservation;
  payments: Payment[];
  onClose: () => void;
}) {
  const total = Number(
    reservation.total_amount || 0
  );

  const paid = Number(
    reservation.paid_amount || 0
  );

  const due = Math.max(0, total - paid);

  const isSettled = due <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 print:hidden">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Guest Bill
            </h2>

            <p className="text-sm text-slate-500">
              Professional invoice preview
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            >
              Print
            </button>

            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xl text-slate-500"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row">
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                {hotel?.name || "Hotel"}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {hotel?.address || ""}
              </p>

              <p className="text-sm text-slate-500">
                {hotel?.phone || ""}
              </p>

              {hotel?.email && (
                <p className="text-sm text-slate-500">
                  {hotel.email}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Invoice
              </p>

              <p className="mt-1 text-lg font-bold text-slate-900">
                {reservation.reservation_number ||
                  "RES"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {formatDate(reservation.check_in)}
              </p>

              {isSettled && (
                <span className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                  PAID / SETTLED
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">
                Guest
              </p>

              <p className="mt-2 font-bold text-slate-900">
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

              <p className="mt-2 font-bold text-slate-900">
                Room{" "}
                {reservation.room?.room_number || "-"}
              </p>

              <p className="text-sm text-slate-500">
                {reservation.room?.room_type?.name ||
                  ""}
              </p>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                    Description
                  </th>

                  <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      Room Stay
                    </p>

                    <p className="text-xs text-slate-500">
                      {formatDate(
                        reservation.check_in
                      )}{" "}
                      —{" "}
                      {formatDate(
                        reservation.check_out
                      )}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {reservation.adults} adult
                      {reservation.adults === 1
                        ? ""
                        : "s"}
                      {reservation.children > 0
                        ? ` · ${reservation.children} child${
                            reservation.children === 1
                              ? ""
                              : "ren"
                          }`
                        : ""}
                    </p>
                  </td>

                  <td className="px-4 py-4 text-right font-semibold text-slate-900">
                    {formatMoney(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {payments.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 font-bold text-slate-900">
                Payment History
              </h3>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                        Date
                      </th>

                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                        Method
                      </th>

                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                        Reference
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatDateTime(
                            payment.created_at
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                          {getPaymentMethodLabel(
                            payment.payment_method
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm text-slate-500">
                          {payment.reference_number ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-green-600">
                          {formatMoney(
                            Number(
                              payment.amount || 0
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-6 ml-auto max-w-sm space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">
                Total
              </span>

              <span className="font-semibold">
                {formatMoney(total)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500">
                Paid
              </span>

              <span className="font-semibold text-green-600">
                {formatMoney(paid)}
              </span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-3">
              <span className="font-bold text-slate-900">
                Balance Due
              </span>

              {isSettled ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-black text-green-700">
                  SETTLED
                </span>
              ) : (
                <span className="text-xl font-black text-red-600">
                  {formatMoney(due)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-5 text-center">
            <p className="text-xs text-slate-400">
              Thank you for staying with us.
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Powered by Staynexa PMS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
