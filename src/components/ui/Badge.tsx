import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'indigo';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles[variant]} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status ? status.toUpperCase() : '';

  switch (normalized) {
    case 'AVAILABLE':
    case 'APPROVED':
    case 'ACTIVE':
      return <Badge variant="success">{status}</Badge>;
    case 'PENDING':
      return <Badge variant="warning">{status}</Badge>;
    case 'REJECTED':
    case 'TERMINATED':
    case 'FULL':
      return <Badge variant="danger">{status}</Badge>;
    case 'UNDER_MAINTENANCE':
      return <Badge variant="warning">MAINTENANCE</Badge>;
    case 'OCCUPIED':
      return <Badge variant="danger">OCCUPIED</Badge>;
    case 'ALLOCATED':
      return <Badge variant="indigo">{status}</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}
