'use client';

import React from 'react';
import { useMerchant } from '@/context/MerchantContext';
import {
  Search,
  Download,
  RotateCw,
  Bot,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function MerchantHeader() {
  const {
    searchQuery,
    setSearchQuery,
    isSyncing,
    fetchIncidents,
    handleExportCSV,
    channelResult,
    setChannelResult,
    isCopilotOpen,
    setIsCopilotOpen,
  } = useMerchant();

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0 gap-4">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by customer name, phone, or incident ID..."
          className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Global Action Controls */}
      <div className="flex items-center gap-2">
        {/* Toast Notification */}
        {channelResult && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate max-w-xs">{channelResult}</span>
            <button
              onClick={() => setChannelResult(null)}
              className="text-emerald-600 hover:text-emerald-800 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Sync Button */}
        <button
          onClick={() => fetchIncidents()}
          disabled={isSyncing}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
          title="Refresh Data"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* CSV Export Button */}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all border border-slate-200 shadow-xs"
          title="Export CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Export CSV</span>
        </button>

        {/* AI Copilot Toggle Button */}
        <button
          onClick={() => setIsCopilotOpen(!isCopilotOpen)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
            isCopilotOpen
              ? 'bg-blue-600 text-white shadow-blue-500/20'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
          }`}
        >
          <Bot className={`w-3.5 h-3.5 ${isCopilotOpen ? 'text-white' : 'text-blue-600'}`} />
          <span>AI Recovery Copilot</span>
        </button>
      </div>
    </header>
  );
}
