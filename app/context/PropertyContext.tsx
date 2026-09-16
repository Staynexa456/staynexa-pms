// app/context/PropertyContext.tsx
'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchHotels } from '../db';

type Hotel = { id: string; name: string; city?: string; state?: string };

type Ctx = {
  currentHotel: Hotel | null;
  hotels: Hotel[];
  setCurrentHotel: (h: Hotel) => void;
  isLoading: boolean;
};

const PropertyContext = createContext<Ctx | undefined>(undefined);

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [currentHotel, setCurrentHotelState] = useState<Hotel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchHotels();
        setHotels(data);

        const savedId = localStorage.getItem('currentHotelId');
        const saved = data.find((h) => h.id === savedId);
        const initial = saved || data[0] || null;
        setCurrentHotelState(initial);
        if (initial) localStorage.setItem('currentHotelId', initial.id);
      } catch (e) {
        console.error('Failed to load hotels', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const setCurrentHotel = (h: Hotel) => {
    setCurrentHotelState(h);
    localStorage.setItem('currentHotelId', h.id);
    window.dispatchEvent(new CustomEvent('hotel-changed', { detail: h.id }));
  };

  return (
    <PropertyContext.Provider value={{ currentHotel, hotels, setCurrentHotel, isLoading }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const ctx = useContext(PropertyContext);
  if (!ctx) throw new Error('useProperty must be inside PropertyProvider');
  return ctx;
}
