// app/active-hotel.ts

const STORAGE_KEY = "staynexa_active_hotel_id";

export function getActiveHotelId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setActiveHotelId(hotelId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, hotelId);
  window.dispatchEvent(new CustomEvent("hotel-switched", { detail: hotelId }));
}

export function clearActiveHotel() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
