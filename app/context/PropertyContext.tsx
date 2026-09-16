// app/context/PropertyContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../supabase'; // adjust path if needed

type Hotel = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
};

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
        const { data, error } = await supabase
          .from('hotels')
          .select('id, name, city, state')
          .order('name');

        if (error) throw error;
        const list = (data || []) as Hotel[];
        setHotels(list);

        const savedId = typeof window !== 'undefined'
          ? localStorage.getItem('currentHotelId')
          : null;
        const saved = list.find((h) => h.id === savedId);
        const initial = saved || list[0] || null;

        setCurrentHotelState(initial);
        if (initial) localStorage.setItem('currentHotelId', initial.id);
      } catch (err) {
        console.error('[PropertyContext] Failed to load hotels:', err);
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
  if (!ctx) throw new Error('useProperty must be used inside PropertyProvider');
  return ctx;
}
