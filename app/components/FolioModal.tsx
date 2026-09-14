"use client";

import { useState } from "react";
import { getPaid, getBalance, type Booking } from "../types";
import { addPayment } from "../db";

export default function FolioModal({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const [charges, setCharges] = useState<any[]>([]);
  const [newCharge, setNewCharge] = useState({ description: "", amount: 0 });

  const balance = getBalance(booking);

  const handleAddCharge = () => {
    if (!newCharge.description || newCharge.amount <= 0) return;
    setCharges([...charges, { id: Date.now().toString(), ...newCharge }]);
    setNewCharge({ description: "", amount: 0 });
  };

  const handlePayment = async () => {
    const amountToPay = parseFloat(prompt(`Enter payment amount (Balance: ₹${balance})`) || "0");
    if (amountToPay > 0) {
      try {
        await addPayment(booking.id, { amount: amountToPay, method: "CASH", reference: "", note: "Folio payment" });
        alert("Payment recorded");
        onClose();
      } catch (err) {
        alert("Failed to record payment");
      }
    }
  };

  const roomTotal = booking.amount || 0;
  const extrasTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const grandTotal = roomTotal + extrasTotal;
  const paid = getPaid(booking) + extrasTotal;
  const finalBalance = grandTotal - paid;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-[500px]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-navy">Folio · {booking.primaryGuest.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl">✕</button>
        </div>

        <div className="space-y-3 text-sm mb-4">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Room Charges</span>
            <span className="font-medium">₹{roomTotal.toFixed(2)}</span>
          </div>

          {charges.map((c) => (
            <div key={c.id} className="flex justify-between text-xs">
              <span>{c.description}</span>
              <span>₹{c.amount.toFixed(2)}</span>
            </div>
          ))}

          <div className="flex gap-2 mt-2">
            <input type="text" placeholder="Charge (e.g. Minibar)" value={newCharge.description} onChange={(e) => setNewCharge({ ...newCharge, description: e.target.value })} className="border p-1 rounded flex-1 text-xs" />
            <input type="number" placeholder="₹" value={newCharge.amount || ""} onChange={(e) => setNewCharge({ ...newCharge, amount: parseFloat(e.target.value) })} className="border p-1 rounded w-20 text-xs" />
            <button onClick={handleAddCharge} className="bg-blue-600 text-white px-3 py-1 rounded text-xs">Add</button>
          </div>
        </div>

        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Charges</span>
            <span className="font-medium">₹{grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Paid</span>
            <span className="font-medium text-emerald-600">₹{paid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="font-semibold text-navy">Balance Due</span>
            <span className={`font-bold ${finalBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>₹{finalBalance.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-navy hover:bg-cream">Close</button>
          {finalBalance > 0 && (
            <button onClick={handlePayment} className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold">Collect Payment</button>
          )}
        </div>
      </div>
    </div>
  );
}
