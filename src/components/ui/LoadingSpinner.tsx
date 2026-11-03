import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-500">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse space-y-4">
      <div className="h-4 bg-slate-200 rounded w-1/3" />
      <div className="h-8 bg-slate-200 rounded w-1/2" />
      <div className="h-3 bg-slate-200 rounded w-full" />
    </div>
  );
}
