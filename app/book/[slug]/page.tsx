// app/book/[slug]/page.tsx (শুধু BookingModal ফাংশনটি রিপ্লেস করুন, বাকি ফাইল আগের মতোই রাখুন)

function BookingModal({
  hotel,
  room,
  plan,
  checkIn,
  checkOut,
  adults,
  children,
  accentColor,
  config,
  onClose,
  onSuccess,
}: {
  hotel: PublicHotel;
  room: PublicRoomType;
  plan: PublicRatePlan;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  accentColor: string;
  config: BookingEngineConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const nights = nightsBetween(checkIn, checkOut);
  const pricePerNight = (room.base_price || 0) + (plan.rate_difference || 0);
  const subtotal = pricePerNight * nights;
  const tax = computeTax(subtotal);
  const total = subtotal + tax;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    ref: string;
    name: string;
    paymentStatus: "paid" | "pending" | "none";
  } | null>(null);

  const [upiQR, setUpiQR] = useState<{
    qrCodeUrl: string;
    upiId: string;
    amount: number;
    deepLink: string;
    orderId: string;
  } | null>(null);
  const [upiBookingInfo, setUpiBookingInfo] = useState<{
    bookingId: string;
    bookingRef: string;
    roomNumber: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const paymentEnabled = config?.payment_enabled === true;

  // 🚨 আপডেটেড লজিক (bookingId ও bookingRef ঠিকমতো পাস হচ্ছে)
  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("Please enter your full name"); return; }
    if (!phone.trim()) { setError("Please enter your phone number"); return; }
    if (phone.replace(/\D/g, "").length < 10) { setError("Please enter a valid phone number"); return; }

    setSubmitting(true);
    try {
      const { supabase } = await import("../../supabase");

      const { data: roomsData } = await supabase
        .from("rooms")
        .select("id, room_number")
        .eq("hotel_id", hotel.id)
        .eq("room_type", room.room_type);

      if (!roomsData || roomsData.length === 0) throw new Error("No rooms of this type found");

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("room_id")
        .eq("hotel_id", hotel.id)
        .in("status", ["CONFIRMED", "CHECKED-IN", "PENDING DEPARTURE", "BLOCKED"])
        .lt("check_in", checkOut)
        .gt("check_out", checkIn);

      const bookedRoomIds = new Set((bookingsData || []).map((b: any) => b.room_id).filter(Boolean));
      const freeRoom = roomsData.find((r: any) => !bookedRoomIds.has(r.id));
      if (!freeRoom) throw new Error("No rooms available for these dates.");

      const booking = await createReservation({
        roomNumber: freeRoom.room_number,
        checkIn,
        checkOut,
        ratePlan: plan.code,
        source: "bookingengine",
        primaryGuest: { name: name.trim(), phone: phone.trim(), email: email.trim(), address: "", city: "", state: "", pincode: "" },
        adults, children, infants: 0,
        amount: subtotal,
        tax,
        notes: notes.trim() || `Online booking · ${plan.name}`,
        hotelId: hotel.id,
      });

      const bookingId = (booking as any)?.id;
      const bookingRef = (booking as any)?.booking_ref;

      if (!bookingId || !bookingRef) {
        throw new Error("Booking created but reference ID missing. Please contact support.");
      }

      if (paymentEnabled && config?.payment_gateway && config.payment_gateway !== "none") {
        await handlePaymentFlow(bookingId, bookingRef, freeRoom.room_number);
        return;
      }

      await triggerNotifications(bookingId, bookingRef, freeRoom.room_number);
      setConfirmation({ ref: bookingRef, name: name.trim(), paymentStatus: "none" });
      setSubmitting(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Booking failed.");
      setSubmitting(false);
    }
  };

  // 🚨 আপডেটেড লজিক (bookingId পাঠানো হচ্ছে)
  const handlePaymentFlow = async (bookingId: string, bookingRef: string, roomNumber: string) => {
    setPaymentProcessing(true);
    setUpiBookingInfo({ bookingId, bookingRef, roomNumber });

    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: hotel.id,
          amount: total,
          bookingRef,
          bookingId, // 👈 CRITICAL FIX
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Payment initialization failed");

      // UPI QR Flow
      if (data.gateway === "upi_qr") {
        setUpiQR({
          qrCodeUrl: data.qrCodeUrl,
          upiId: data.upiId,
          amount: data.amount,
          deepLink: data.deepLink,
          orderId: data.orderId,
        });
        setPaymentProcessing(false);
        return;
      }

      // Razorpay
      if (data.gateway === "razorpay") {
        await loadRazorpayScript();
        const options = {
          key: data.publicKey,
          amount: data.amount,
          currency: "INR",
          name: hotel.name,
          description: `Booking ${bookingRef}`,
          order_id: data.orderId,
          prefill: { name: name.trim(), contact: phone.trim(), email: email.trim() },
          theme: { color: accentColor },
          handler: async function (response: any) {
            await verifyPayment({
              hotelId: hotel.id,
              gateway: "razorpay",
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              bookingId,
              bookingRef,
              roomNumber,
            });
          },
          modal: {
            ondismiss: () => {
              setPaymentProcessing(false);
              setSubmitting(false);
              setError("Payment cancelled.");
            },
          },
        };
        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      }
      // Cashfree
      else if (data.gateway === "cashfree") {
        await loadCashfreeScript();
        const cashfree = (window as any).Cashfree({ mode: data.mode || "production" });
        cashfree.checkout({ paymentSessionId: data.paymentLink, redirectTarget: "_modal" });
      }
    } catch (err: any) {
      console.error("[Payment Flow]", err);
      setError(err.message || "Payment failed");
      setPaymentProcessing(false);
      setSubmitting(false);
    }
  };

  const verifyPayment = async (params: any) => {
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        await triggerNotifications(params.bookingId, params.bookingRef, params.roomNumber);
        setConfirmation({ ref: params.bookingRef, name: name.trim(), paymentStatus: "paid" });
      } else {
        setError(data.error || "Payment verification failed");
      }
    } catch (err: any) {
      console.error("[Verify]", err);
      setError("Payment confirmation error.");
    } finally {
      setPaymentProcessing(false);
      setSubmitting(false);
    }
  };

  // 🚨 আপডেটেড লজিক (UPI ভেরিফিকেশন)
  const handleUPIConfirm = async () => {
    if (!upiBookingInfo || !upiQR) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: hotel.id,
          gateway: "upi_qr",
          orderId: upiQR.orderId,
          bookingId: upiBookingInfo.bookingId,
          bookingRef: upiBookingInfo.bookingRef,
          roomNumber: upiBookingInfo.roomNumber,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Verification failed");

      await triggerNotifications(upiBookingInfo.bookingId, upiBookingInfo.bookingRef, upiBookingInfo.roomNumber);
      setUpiQR(null);
      setConfirmation({
        ref: upiBookingInfo.bookingRef,
        name: name.trim(),
        paymentStatus: "pending",
      });
    } catch (err: any) {
      console.error(err);
      setError("Could not confirm. Please contact the hotel.");
    } finally {
      setVerifying(false);
      setPaymentProcessing(false);
      setSubmitting(false);
    }
  };

  const triggerNotifications = async (bookingId: string, bookingRef: string, roomNumber: string) => {
    try {
      const { triggerBookingNotifications } = await import("../../lib/notifications");
      await triggerBookingNotifications({
        hotelId: hotel.id,
        bookingId,
        bookingRef,
        guestName: name.trim(),
        guestPhone: phone.trim(),
        guestEmail: email.trim(),
        roomType: room.room_type,
        roomNumber: roomNumber || "",
        checkIn,
        checkOut,
        nights,
        total,
        hotelName: hotel.name,
        hotelPhone: config?.contact_phone,
      });
    } catch (notifErr) {
      console.error("[Notification trigger failed]", notifErr);
    }
  };

  // 👇👇👇 নিচের সব JSX/HTML ডিজাইন আপনার আগের কোডের মতোই ১০০% অপরিবর্তিত 👇👇👇
  
  // ═══ UPI QR MODAL ═══
  if (upiQR) {
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-slate-400 font-semibold">Pay via UPI</p>
                <h3 className="text-xl font-serif font-semibold text-slate-900 mt-1">Scan QR Code</h3>
              </div>
              <button
                onClick={() => {
                  setUpiQR(null);
                  setPaymentProcessing(false);
                  setSubmitting(false);
                }}
                disabled={verifying}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition border border-slate-200 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-sm">
                <img src={upiQR.qrCodeUrl} alt="UPI QR Code" className="w-64 h-64" />
              </div>
              <p className="text-xs text-slate-500 mt-4 text-center">Scan with any UPI app — GPay, PhonePe, Paytm</p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl text-center border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount to Pay</p>
              <p className="text-3xl font-serif font-bold text-slate-900">₹{upiQR.amount.toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-500 mt-2 font-mono break-all">{upiQR.upiId}</p>
            </div>

            <a
              href={upiQR.deepLink}
              className="block w-full py-3.5 rounded-xl text-xs font-bold text-white text-center uppercase tracking-[0.2em] bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 transition shadow-lg shadow-teal-500/30"
            >
              📱 Open UPI App
            </a>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <strong>ℹ️ Important:</strong> After paying, click <strong>"I've Paid"</strong> below. The hotel will verify your payment and confirm the booking.
              </p>
            </div>
          </div>

          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setUpiQR(null);
                setPaymentProcessing(false);
                setSubmitting(false);
              }}
              disabled={verifying}
              className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition uppercase tracking-[0.15em] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUPIConfirm}
              disabled={verifying}
              className="px-6 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition flex-1 uppercase tracking-[0.15em] bg-slate-900 hover:bg-slate-800"
            >
              {verifying ? "Submitting..." : "✓ I've Paid"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ SUCCESS SCREEN ═══
  if (confirmation) {
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="p-10 text-center border-b border-slate-100">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-900 flex items-center justify-center text-4xl text-white">✓</div>
            <p className="text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-2">
              {confirmation.paymentStatus === "paid" ? "Confirmed" : confirmation.paymentStatus === "pending" ? "Pending" : "Confirmed"}
            </p>
            <h3 className="text-3xl font-serif font-semibold text-slate-900 mb-2">Your Stay Awaits</h3>
            <p className="text-sm text-slate-500">
              {confirmation.paymentStatus === "paid"
                ? "Payment confirmed. A confirmation has been sent."
                : confirmation.paymentStatus === "pending"
                ? "Booking received. Awaiting payment verification from hotel."
                : "A confirmation has been sent to you."}
            </p>
          </div>
          <div className="p-8 space-y-5">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.3em] mb-2">Booking Reference</p>
              <p className="text-2xl font-serif font-bold text-slate-900 tracking-wider">{confirmation.ref}</p>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl space-y-3 text-sm border border-slate-100">
              <div className="flex justify-between"><span className="text-slate-500">Guest</span><span className="font-semibold text-slate-800">{confirmation.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Room</span><span className="font-semibold text-slate-800">{room.room_type}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Check-in</span><span className="font-semibold text-slate-800">{prettyDate(checkIn)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Check-out</span><span className="font-semibold text-slate-800">{prettyDate(checkOut)}</span></div>
              <div className="flex justify-between pt-3 border-t border-slate-200"><span className="text-slate-500">Total</span><span className="font-serif font-bold text-lg text-slate-900">₹{total.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Payment</span>
                {confirmation.paymentStatus === "paid" ? (
                  <span className="font-bold text-emerald-600">✅ Paid</span>
                ) : confirmation.paymentStatus === "pending" ? (
                  <span className="font-bold text-amber-600">⏳ Pending Verification</span>
                ) : (
                  <span className="font-bold text-slate-500">Pay at Hotel</span>
                )}
              </div>
            </div>
          </div>
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => { onClose(); onSuccess(); }}
              className="w-full py-3.5 rounded-xl text-xs font-bold text-white uppercase tracking-[0.2em] bg-slate-900 hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ FORM STATE ═══
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] tracking-[0.3em] uppercase text-slate-400 font-semibold">Reserve Your Stay</p>
            <button onClick={onClose} disabled={paymentProcessing} className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition border border-slate-200 disabled:opacity-50">×</button>
          </div>
          <h3 className="text-2xl font-serif font-semibold text-slate-900">{room.room_type}</h3>
          <p className="text-xs text-slate-500 mt-1">{plan.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Check-in</span><span className="font-semibold text-slate-800">{prettyDate(checkIn)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Check-out</span><span className="font-semibold text-slate-800">{prettyDate(checkOut)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Guests</span><span className="font-semibold text-slate-800">{adults} Adult{adults > 1 ? "s" : ""}{children > 0 ? `, ${children} Child${children > 1 ? "ren" : ""}` : ""}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Nights</span><span className="font-semibold text-slate-800">{nights}</span></div>
          </div>

          <div className="p-5 bg-slate-900 rounded-2xl space-y-3 text-sm text-white">
            <div className="flex justify-between"><span className="text-slate-400">₹{pricePerNight.toLocaleString("en-IN")} × {nights} night{nights > 1 ? "s" : ""}</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Taxes (GST)</span><span>₹{tax.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between pt-3 border-t border-white/10"><span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Total</span><span className="font-serif font-bold text-xl">₹{total.toLocaleString("en-IN")}</span></div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Full Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent transition" autoFocus disabled={paymentProcessing} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Phone Number *</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent transition" disabled={paymentProcessing} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Email (Optional)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-slate-900 bg-transparent transition" disabled={paymentProcessing} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Special Requests (Optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any special requests..." className="w-full px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-800 resize-none outline-none focus:border-slate-900 bg-transparent transition" disabled={paymentProcessing} />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <p className="text-xs text-rose-700 font-medium">⚠ {error}</p>
            </div>
          )}
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button onClick={onClose} disabled={submitting || paymentProcessing} className="px-6 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition uppercase tracking-[0.15em] disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || paymentProcessing} className="px-6 py-3 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition flex-1 uppercase tracking-[0.15em]" style={{ background: accentColor }}>
            {paymentProcessing ? "Processing payment..." : submitting ? "Creating booking..." : paymentEnabled ? `Pay ₹${total.toLocaleString("en-IN")}` : `Confirm · ₹${total.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </div>
  );
}
