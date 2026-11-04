import Link from "next/link";
import { Building2, ShieldCheck, Users, BedDouble, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Header / Navigation */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">Smart PG & Hostel</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 transition"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
            >
              Student Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-6">
          <ShieldCheck className="w-4 h-4" /> Relational ACID Transactions &amp; Real-time Audit
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl">
          Smart PG & Hostel <span className="text-indigo-600">Room Allocation</span> System
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl">
          Real-time room occupancy tracking, atomic student room allocation, and MongoDB-powered audit activity logging.
        </p>

        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition"
          >
            Apply for Accommodation <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm transition"
          >
            Sign In
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-left">
          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <BedDouble className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-slate-900">Atomic Concurrency</h3>
            <p className="mt-2 text-sm text-slate-600">
              Pessimistic locking (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">SELECT FOR UPDATE</code>) and stored procedures guarantee room capacity is never exceeded.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-slate-900">Database-Level Integrity</h3>
            <p className="mt-2 text-sm text-slate-600">
              MySQL triggers prevent over-allocation at the database layer while materialized views expose real-time occupancy.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-slate-900">Activity & Audit Logs</h3>
            <p className="mt-2 text-sm text-slate-600">
              MongoDB Atlas stores detailed audit logs for every application, allocation, and status change with aggregation metrics.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          Smart PG/Hostel Management System • Room Allocation and Occupancy Management
        </div>
      </footer>
    </div>
  );
}
