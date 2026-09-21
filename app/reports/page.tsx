"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReportsIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reports/property");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin" />
        <p className="text-sm text-slate-500">Loading reports...</p>
      </div>
    </div>
  );
}