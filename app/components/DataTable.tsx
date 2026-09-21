"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ReportColumn } from "../lib/report-utils";

type DataTableProps = {
  data: any[];
  columns: ReportColumn[];
  loading?: boolean;
  onRowSelect?: (selectedIds: string[]) => void;
};

export default function DataTable({ data, columns, loading = false, onRowSelect }: DataTableProps) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map(c => c.key));
  const [showColumnPanel, setShowColumnPanel] = useState(false);

  // পেজিনেশন স্টেট
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setVisibleColumns(columns.map(c => c.key));
    setSelectedRows([]);
    setCurrentPage(1);
  }, [columns]);

  const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    columns.forEach(col => {
      if (col.format === "currency" || col.format === "number") {
        t[col.key] = data.reduce((sum, row) => sum + (Number(row[col.key]) || 0), 0);
      }
    });
    return t;
  }, [data, columns]);

  const handleSelectAll = () => {
    if (selectedRows.length === paginatedData.length) {
      setSelectedRows([]);
      onRowSelect?.([]);
    } else {
      const allIds = paginatedData.map((r, i) => r.id || String(i));
      setSelectedRows(allIds);
      onRowSelect?.(allIds);
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = selectedRows.includes(id)
      ? selectedRows.filter(r => r !== id)
      : [...selectedRows, id];
    setSelectedRows(newSelected);
    onRowSelect?.(newSelected);
  };

  const fmtC = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-24 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full border-[3px] border-slate-200 border-t-slate-900 animate-spin" />
        <p className="text-sm text-slate-500 font-semibold">Loading report data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden">
      {/* ═══ টেবিল হেডার কন্ট্রোলস ═══ */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={selectedRows.length === paginatedData.length && paginatedData.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-slate-300 cursor-pointer" />
          <p className="text-sm font-bold text-slate-800">Report Data</p>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">{data.length} records</span>
        </div>
      </div>

      {/* ═══ ডেটা টেবিল ═══ */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10 text-center border-r border-slate-100">
                <input type="checkbox" checked={selectedRows.length === paginatedData.length && paginatedData.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-slate-300" />
              </th>
              {columns.filter(c => visibleColumns.includes(c.key)).map((c) => (
                <th key={c.key} className={`px-4 py-3 border-r border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                  <div className="flex flex-col gap-1 items-start justify-between h-full">
                    <span>{c.label}</span>
                    <svg className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-700 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-slate-400">No records found.</td>
              </tr>
            ) : (
              paginatedData.map((r: any, i: number) => {
                const rowId = r.id || String(i);
                const isSelected = selectedRows.includes(rowId);
                return (
                  <tr key={rowId} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? "bg-slate-50" : ""}`}>
                    <td className="px-4 py-3 text-center border-r border-slate-100">
                      <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(rowId)} className="w-4 h-4 rounded border-slate-300 cursor-pointer" />
                    </td>
                    {columns.filter(c => visibleColumns.includes(c.key)).map((c) => {
                      const v = r[c.key];
                      let display: any = v;

                      if (v === null || v === undefined || v === "") display = <span className="text-slate-300">—</span>;
                      else if (c.format === "currency" && typeof v === "number") display = <span className="font-semibold tabular-nums">{fmtC(v)}</span>;
                      else if (c.format === "percent" && typeof v === "number") display = <span className="font-semibold tabular-nums">{v.toFixed(1)}%</span>;
                      else if (c.format === "status") {
                        const color: Record<string, string> = {
                          "CHECKED-IN": "bg-emerald-100 text-emerald-700", CONFIRMED: "bg-amber-100 text-amber-700",
                          "CHECKED-OUT": "bg-slate-100 text-slate-600", CANCELLED: "bg-rose-100 text-rose-700",
                          "NO-SHOW": "bg-rose-100 text-rose-700", CLEAN: "bg-emerald-100 text-emerald-700",
                          DIRTY: "bg-rose-100 text-rose-700", INSPECTED: "bg-sky-100 text-sky-700", MAINTENANCE: "bg-amber-100 text-amber-700",
                        };
                        display = <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${color[v] || "bg-slate-100 text-slate-600"}`}>{v}</span>;
                      } else if (c.key === "notes" && typeof v === "string" && v.length > 80) display = <span title={v}>{v.slice(0, 80)}…</span>;

                      return (
                        <td key={c.key} className={`px-4 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800 text-xs">
              <tr>
                <td className="px-4 py-3 border-r border-slate-200"></td>
                {columns.filter(c => visibleColumns.includes(c.key)).map((c, index) => {
                  const isFirstVisible = index === 0;
                  const isNumeric = c.format === "currency" || c.format === "number";
                  return (
                    <td key={c.key} className={`px-4 py-3 tabular-nums border-r border-slate-200 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                      {isFirstVisible && <span className="uppercase tracking-wider">Total</span>}
                      {isNumeric && totals[c.key] !== undefined && (c.format === "currency" ? fmtC(totals[c.key]) : totals[c.key].toLocaleString("en-IN"))}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ═══ Stayflexi Style Pagination ═══ */}
      <div className="border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between bg-white text-xs text-slate-500 gap-3">
        <div className="flex items-center gap-4">
           <span>Rows: <span className="font-semibold text-slate-700">{data.length}</span></span>
           <span>Total Rows: <span className="font-semibold text-slate-700">{data.length}</span></span>
        </div>
        
        <div className="flex items-center gap-4">
           <span>1 to {Math.min(startIndex + itemsPerPage, data.length)} of {data.length}</span>
           <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-30 transition">|&lt;</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-30 transition">&lt;</button>
              <span className="px-2 font-semibold text-slate-700">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-30 transition">&gt;</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-30 transition">&gt;|</button>
           </div>
        </div>
      </div>

      {/* ═══ Stayflexi Style Columns Side Panel ═══ */}
      <div className="absolute top-0 right-0 h-full flex items-center z-40">
         <button 
            onClick={() => setShowColumnPanel(!showColumnPanel)}
            className="bg-white border border-slate-200 shadow-md rounded-l-xl px-2 py-4 flex flex-col items-center gap-2 text-slate-500 hover:text-slate-900 transition"
            title="Toggle Columns"
         >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
            <span className="text-[10px] font-bold uppercase tracking-wider rotate-90 mt-2 whitespace-nowrap">Columns</span>
         </button>

         {showColumnPanel && (
            <div className="absolute right-12 top-4 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 z-50">
               <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-slate-800">Toggle Columns</p>
                  <button onClick={() => setShowColumnPanel(false)} className="text-slate-400 hover:text-slate-700">✕</button>
               </div>
               <div className="space-y-2 max-h-80 overflow-y-auto">
                  {columns.map(col => (
                     <label key={col.key} className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition">
                        <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={(e) => {
                           if (e.target.checked) setVisibleColumns([...visibleColumns, col.key]);
                           else setVisibleColumns(visibleColumns.filter(k => k !== col.key));
                        }} className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                        <span className="text-xs font-medium text-slate-700">{col.label}</span>
                     </label>
                  ))}
               </div>
            </div>
         )}
      </div>

    </div>
  );
}