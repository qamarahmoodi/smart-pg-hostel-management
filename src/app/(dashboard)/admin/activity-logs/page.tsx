'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Calendar,
  Clock,
  Filter,
  RefreshCw,
  Database,
  Search,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  KeyRound,
  UserCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ActivityLogsApiResponse,
  ActivityLogSummaryItem,
  SerializedActivityLog,
} from '@/types';

// Action formatting helper
function getActionMeta(action: string) {
  switch (action) {
    case 'ROOM_ALLOCATED':
      return {
        label: 'Room Allocated',
        variant: 'success' as const,
        icon: KeyRound,
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeBg: 'bg-emerald-100 text-emerald-800',
      };
    case 'APPLICATION_APPROVED':
      return {
        label: 'Application Approved',
        variant: 'success' as const,
        icon: CheckCircle2,
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeBg: 'bg-emerald-100 text-emerald-800',
      };
    case 'APPLICATION_SUBMITTED':
      return {
        label: 'Application Submitted',
        variant: 'info' as const,
        icon: FileText,
        bg: 'bg-sky-50 text-sky-700 border-sky-200',
        badgeBg: 'bg-sky-100 text-sky-800',
      };
    case 'APPLICATION_REJECTED':
      return {
        label: 'Application Rejected',
        variant: 'danger' as const,
        icon: XCircle,
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        badgeBg: 'bg-rose-100 text-rose-800',
      };
    case 'ALLOCATION_TERMINATED':
      return {
        label: 'Allocation Terminated',
        variant: 'danger' as const,
        icon: AlertTriangle,
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        badgeBg: 'bg-amber-100 text-amber-800',
      };
    case 'ROOM_STATUS_CHANGED':
      return {
        label: 'Room Status Changed',
        variant: 'warning' as const,
        icon: RefreshCw,
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        badgeBg: 'bg-indigo-100 text-indigo-800',
      };
    case 'STUDENT_REGISTERED':
      return {
        label: 'Student Registered',
        variant: 'indigo' as const,
        icon: UserCheck,
        bg: 'bg-purple-50 text-purple-700 border-purple-200',
        badgeBg: 'bg-purple-100 text-purple-800',
      };
    default:
      return {
        label: action.replace(/_/g, ' '),
        variant: 'neutral' as const,
        icon: Activity,
        bg: 'bg-slate-50 text-slate-700 border-slate-200',
        badgeBg: 'bg-slate-100 text-slate-800',
      };
  }
}

export default function ActivityLogsPage() {
  const [data, setData] = useState<ActivityLogsApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedTarget, setSelectedTarget] = useState<string>('ALL');
  const [limit, setLimit] = useState<number>(20);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // UI helpers
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showVivaNotes, setShowVivaNotes] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (selectedAction !== 'ALL') params.set('action', selectedAction);
      if (selectedTarget !== 'ALL') params.set('targetType', selectedTarget);
      params.set('limit', limit.toString());

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch activity logs');
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading audit logs.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedAction, selectedTarget, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLogs();
  };

  const handleSeedDemoData = async () => {
    try {
      setIsSeeding(true);
      setSeedNotice(null);
      const res = await fetch('/api/admin/logs', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSeedNotice(json.message);
        await fetchLogs();
      } else {
        setError(json.message || 'Failed to seed sample logs');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to seed logs');
    } finally {
      setIsSeeding(false);
    }
  };

  // Filter logs locally for search query
  const filteredRecentLogs = (data?.recentLogs || []).filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const actionMatch = log.action.toLowerCase().includes(q);
    const targetMatch = log.targetType.toLowerCase().includes(q) || log.targetId.toString().includes(q);
    const detailsMatch = JSON.stringify(log.details || {}).toLowerCase().includes(q);
    const performerMatch =
      typeof log.performedBy === 'object'
        ? (log.performedBy.email || '').toLowerCase().includes(q) ||
          (log.performedBy.role || '').toLowerCase().includes(q)
        : log.performedBy.toString().includes(q);

    return actionMatch || targetMatch || detailsMatch || performerMatch;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Activity & Audit Logs</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Database className="w-3 h-3" /> MongoDB Atlas
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time administrative audit trail and event analytics aggregated via MongoDB aggregation pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowVivaNotes(!showVivaNotes)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {showVivaNotes ? 'Hide Pipeline Architecture' : 'MongoDB Aggregation Architecture'}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Educational Callout: Viva & Architecture Breakdown */}
      {showVivaNotes && (
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-lg border border-indigo-800/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white tracking-wide">
                DBMS Level 3 Polyglot Architecture & Aggregation Pipeline
              </h2>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-800/60 text-indigo-200 border border-indigo-700">
              MongoDB 6+ Aggregation Framework
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Why Polyglot (MySQL + MongoDB)?
              </div>
              <p className="text-slate-300 leading-relaxed">
                Primary relational data (rooms, allocations, users) requires <strong>ACID transactions</strong> and pessimistic locking in <strong>MySQL 8</strong>. Audit logs are high-throughput, append-only, and semi-structured, making <strong>MongoDB Atlas</strong> optimal without transaction overhead or lock contention.
              </p>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Aggregation Pipeline Stages
              </div>
              <ul className="text-slate-300 space-y-1 list-disc pl-4">
                <li><code className="text-indigo-200 font-mono font-bold">$group</code>: Groups by action/date with accumulators <code className="text-amber-200 font-mono">$sum: 1</code> & <code className="text-emerald-200 font-mono">$max: &quot;$timestamp&quot;</code>.</li>
                <li><code className="text-indigo-200 font-mono font-bold">$sort</code>: Sorts by event frequency descending (<code className="text-amber-200 font-mono">&#123; count: -1 &#125;</code>).</li>
                <li><code className="text-indigo-200 font-mono font-bold">$project</code>: Reshapes output keys and strips internal MongoDB <code className="text-indigo-200 font-mono">_id</code>.</li>
                <li><code className="text-indigo-200 font-mono font-bold">$dateToString</code>: Extracts daily buckets (<code className="text-amber-200 font-mono">%Y-%m-%d</code>).</li>
              </ul>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Indexed Query Performance
              </div>
              <p className="text-slate-300 leading-relaxed">
                Compound and single indexes are maintained:
                <br /><code className="text-indigo-200 font-mono">&#123; timestamp: -1 &#125;</code> for rapid recent events sorting.
                <br /><code className="text-indigo-200 font-mono">&#123; action: 1 &#125;</code> & <code className="text-indigo-200 font-mono">&#123; targetType: 1 &#125;</code> for indexed group & filter scans.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Seed Notice */}
      {seedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
          <span>{seedNotice}</span>
          <button
            type="button"
            onClick={() => setSeedNotice(null)}
            className="text-emerald-600 hover:text-emerald-900 font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Unable to load MongoDB activity logs</div>
              <div className="text-rose-700 text-xs mt-0.5">{error}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <LoadingSpinner message="Executing MongoDB aggregation pipelines..." />
      ) : (
        <>
          {/* Summary KPI Cards Grid (Computed via $group and $sum) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Audit Events Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Audit Events</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{data?.totalLogs ?? 0}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Stored in MongoDB `activity_logs`</div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
            </div>

            {/* Top Action Cards from Aggregation */}
            {(data?.summary || []).slice(0, 3).map((item: ActivityLogSummaryItem) => {
              const meta = getActionMeta(item.action);
              const Icon = meta.icon;

              return (
                <div
                  key={item.action}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-slate-300 transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-medium text-slate-500 truncate">{meta.label}</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{item.count}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {item.lastOccurred
                          ? new Date(item.lastOccurred).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Breakdown Chips (Full aggregation output) */}
          {data?.summary && data.summary.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Aggregated Action Frequencies (via $group pipeline)
              </div>
              <div className="flex flex-wrap gap-2">
                {data.summary.map((item) => {
                  const meta = getActionMeta(item.action);
                  const isSelected = selectedAction === item.action;
                  return (
                    <button
                      key={item.action}
                      type="button"
                      onClick={() => setSelectedAction(isSelected ? 'ALL' : item.action)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{meta.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                          isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter logs by keyword, email, room, or target ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              {/* Action Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Event Actions</option>
                  <option value="ROOM_ALLOCATED">Room Allocated</option>
                  <option value="APPLICATION_SUBMITTED">Application Submitted</option>
                  <option value="APPLICATION_APPROVED">Application Approved</option>
                  <option value="APPLICATION_REJECTED">Application Rejected</option>
                  <option value="ALLOCATION_TERMINATED">Allocation Terminated</option>
                  <option value="ROOM_STATUS_CHANGED">Room Status Changed</option>
                  <option value="STUDENT_REGISTERED">Student Registered</option>
                </select>

                {/* Target Type Filter */}
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Targets</option>
                  <option value="room">Room</option>
                  <option value="allocation">Allocation</option>
                  <option value="application">Application</option>
                  <option value="user">User</option>
                  <option value="hostel">Hostel</option>
                </select>

                {/* Limit selector */}
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={10}>10 items</option>
                  <option value={20}>20 items</option>
                  <option value={50}>50 items</option>
                  <option value={100}>100 items</option>
                </select>
              </div>
            </div>
          </div>

          {/* Activity Logs Table */}
          {filteredRecentLogs.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                icon={Activity}
                title="No Activity Logs Found"
                description={
                  data?.totalLogs === 0
                    ? 'No audit events recorded in MongoDB yet. Events are logged automatically upon allocations, registrations, and application decisions.'
                    : 'No activity logs matched your active filter or search criteria.'
                }
              />
              {data?.totalLogs === 0 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSeedDemoData}
                    disabled={isSeeding}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isSeeding ? 'Generating Sample Logs...' : 'Seed Sample Audit Records (For Demo / Viva)'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Recent Audit Records (Sorted by timestamp DESC)
                </div>
                <div className="text-xs text-slate-500">
                  Showing {filteredRecentLogs.length} of {data?.totalLogs ?? 0} total events
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 divide-y divide-slate-200">
                  <thead className="bg-slate-50/60 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Action Event</th>
                      <th className="px-5 py-3">Performed By</th>
                      <th className="px-5 py-3">Target Entity</th>
                      <th className="px-5 py-3">Event Details</th>
                      <th className="px-4 py-3 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecentLogs.map((log: SerializedActivityLog) => {
                      const meta = getActionMeta(log.action);
                      const Icon = meta.icon;
                      const isExpanded = expandedLogId === log._id;

                      const performerDisplay =
                        typeof log.performedBy === 'object' && log.performedBy !== null
                          ? log.performedBy.email || `User #${log.performedBy.userId || 'N/A'}`
                          : `User #${log.performedBy}`;

                      const performerRole =
                        typeof log.performedBy === 'object' && log.performedBy !== null
                          ? log.performedBy.role
                          : undefined;

                      return (
                        <React.Fragment key={log._id}>
                          <tr className="hover:bg-slate-50/70 transition">
                            {/* Timestamp */}
                            <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500">
                              <div className="font-medium text-slate-700">
                                {new Date(log.timestamp).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {new Date(log.timestamp).toLocaleTimeString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </div>
                            </td>

                            {/* Action Badge */}
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.bg}`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {meta.label}
                              </span>
                            </td>

                            {/* Performed By */}
                            <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                              <div className="font-medium text-slate-800">{performerDisplay}</div>
                              {performerRole && (
                                <span className="inline-block mt-0.5 text-[10px] uppercase font-bold text-slate-400">
                                  {performerRole}
                                </span>
                              )}
                            </td>

                            {/* Target Entity */}
                            <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                                {log.targetType}:{log.targetId}
                              </span>
                              {log.studentId && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Student #{log.studentId}
                                </div>
                              )}
                            </td>

                            {/* Details summary */}
                            <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                              {log.details && Object.keys(log.details).length > 0 ? (
                                <span className="text-slate-700">
                                  {Object.entries(log.details)
                                    .slice(0, 2)
                                    .map(([k, v]) => `${k}: ${String(v)}`)
                                    .join(' • ')}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">No additional payload</span>
                              )}
                            </td>

                            {/* Expand Details Button */}
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition"
                              >
                                {isExpanded ? (
                                  <>
                                    <span>Collapse</span>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </>
                                ) : (
                                  <>
                                    <span>Details</span>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded JSON Inspector Row */}
                          {isExpanded && (
                            <tr className="bg-slate-900 text-slate-200">
                              <td colSpan={6} className="px-6 py-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs text-slate-400">
                                    <span className="font-mono">
                                      MongoDB Document ID: <strong className="text-indigo-300">{log._id}</strong>
                                    </span>
                                    <span>Collection: activity_logs</span>
                                  </div>
                                  <pre className="p-3 rounded-lg bg-slate-950 text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                                    {JSON.stringify(
                                      {
                                        _id: log._id,
                                        action: log.action,
                                        performedBy: log.performedBy,
                                        targetType: log.targetType,
                                        targetId: log.targetId,
                                        studentId: log.studentId,
                                        roomId: log.roomId,
                                        timestamp: log.timestamp,
                                        details: log.details,
                                      },
                                      null,
                                      2
                                    )}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
