import { supabase } from "@/lib/supabase"; // আপনার supabase ক্লায়েন্ট পাথটি দিন

// ... বাকি কোড

  const handleSubmit = async () => {
    if (blockMode) {
      if (!onBlockRoom) return;
      setSaving(true);
      try {
        await onBlockRoom({
          roomNumber,
          checkIn,
          checkOut,
          reason: blockReason,
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!guestName.trim()) {
      alert("Guest name is required");
      return;
    }
    if (!roomNumber.trim()) {
      alert("Room number is required");
      return;
    }

    setSaving(true);
    try {
      // ১. প্রথমে বুকিং সেভ করুন (আপনার onSubmit কল)
      await onSubmit({
        roomNumber,
        checkIn,
        checkOut,
        ratePlan,
        source: subSegment.toLowerCase().replace(/\s+/g, ""),
        primaryGuest: {
          name: guestName.trim(),
          email: guestEmail.trim(),
          phone: guestPhone.trim(),
          address: guestAddress.trim(),
          city: guestCity.trim(),
          state: guestState.trim(),
          pincode: guestZip.trim(),
          idType: guestIdType as any,
          idNumber: guestIdNumber.trim(),
        },
        adults,
        children,
        infants,
        amount: totalWithTax,
        tax: taxAmount,
        notes: "",
      });

      // ২. বুকিং সেভ হওয়ার পর notification_log-এ ডেটা তৈরি করুন
      // ধরুন আপনার 'bookingData' ভেরিয়েবলে বুকিং আইডি আছে (onSubmit থেকে আসা)
      // এক্ষেত্রে onSubmit ফাংশন থেকে বুকিং আইডি রিটার্ন করানো ভালো

      const bookingRef = `SNB-${Date.now()}`; // সাময়িকভাবে, আসল আইডি ব্যবহার করবেন
      
      // ভাউচার ডেটা (যা PDF তৈরি করতে লাগবে)
      const voucherData = {
        bookingRef: bookingRef,
        guestName: guestName.trim(),
        hotelName: "Vishara Elite Hotel", // আপনার হোটেলের নাম
        roomType: roomNumber,
        checkIn,
        checkOut,
        amount: totalWithTax,
        email: guestEmail.trim(),
        phone: guestPhone.trim(),
      };

      // গেস্টকে ইমেইল পাঠানোর জন্য লগ তৈরি
      if (guestEmail.trim()) {
        await supabase.from("notification_log").insert({
          hotel_id: "YOUR_HOTEL_ID", // আপনার হোটেলের ID
          channel: "email",
          recipient: guestEmail.trim(),
          subject: "Booking Confirmation - Staynexa",
          body: `Dear ${guestName}, your booking is confirmed! Your booking reference is ${bookingRef}. We look forward to hosting you.`,
          status: "pending",
          metadata: { voucherData, attachPdf: true },
        });
      }

      // গেস্টকে হোয়াটসঅ্যাপ পাঠানোর জন্য লগ তৈরি
      if (guestPhone.trim()) {
        await supabase.from("notification_log").insert({
          hotel_id: "YOUR_HOTEL_ID", // আপনার হোটেলের ID
          channel: "whatsapp",
          recipient: guestPhone.trim(),
          subject: "Booking Confirmation",
          body: `Dear ${guestName}, your booking is confirmed! Booking Ref: ${bookingRef}.`,
          status: "pending",
          metadata: { voucherData, attachPdf: true },
        });
      }

      // ৩. নোটিফিকেশন প্রসেস করার জন্য API কল করুন (এটি মেইল/হোয়াটসঅ্যাপ পাঠাবে)
      await fetch("/api/notifications/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: "YOUR_HOTEL_ID" }),
      });

      alert("Booking created and notifications sent!");

    } catch (error) {
      console.error("Booking error:", error);
      alert("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };