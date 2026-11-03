# AGENTS.md — Development Guidelines & Instructions

This document provides project-specific operational and coding instructions for AI assistants and developers contributing to the **Smart PG/Hostel Room Allocation and Occupancy Management System**.

---

## 1. Project Context & Architecture

- **Project:** Academic DBMS Level 3 Project — Smart PG/Hostel Management System.
- **Goal:** Manage room availability, transparent application workflows, and atomic room allocations while preventing over-allocation and maintaining full audit trails.
- **Polyglot Database Architecture:**
  - **MySQL 8+ (via `mysql2/promise`):** Primary relational data store for structured, transactional, and relational records:
    - Tables: `users`, `hostels`, `room_types`, `rooms`, `applications`, `allocations`.
    - Enforces ACID transactions, pessimistic locking (`SELECT ... FOR UPDATE`), constraints, views, triggers, and stored procedures.
  - **MongoDB Atlas (via official `mongodb` driver):** High-throughput, flexible document store for audit and activity logs (`activity_logs` collection). Never duplicates primary relational records.

---

## 2. Technology Stack & Key Libraries

- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS (modern, clean, accessible UI)
- **Icons:** `lucide-react`
- **Primary Database:** MySQL 8+ with `mysql2` connection pool
- **Secondary Database:** MongoDB Atlas with `mongodb`
- **Security & Passwords:** `bcryptjs` for hashing passwords
- **Authentication:** Stateless signed JWT session cookies with `jose` (HTTP-only, secure, sameSite)
- **Runtime:** Node.js v20+ / v26+

---

## 3. Directory Structure Conventions

```
smart-pg-hostel-management/
├── src/
│   ├── app/                     # Next.js App Router pages and route handlers
│   │   ├── (auth)/              # Auth routes (login, register)
│   │   ├── (dashboard)/         # Protected layouts & pages
│   │   │   ├── student/         # Student portal (browse, apply, view room)
│   │   │   └── admin/           # Admin portal (hostels, rooms, applications, occupancy)
│   │   ├── api/                 # Next.js Route Handlers
│   │   │   ├── auth/            # /login, /register, /logout, /me
│   │   │   ├── hostels/         # Hostel management & browsing
│   │   │   ├── rooms/           # Room inventory & status
│   │   │   ├── applications/    # Application submission & review
│   │   │   ├── allocations/     # Room allocation (stored procedure / transactions)
│   │   │   └── logs/            # MongoDB activity log endpoint (Reserved / Read-only)
│   │   ├── layout.tsx           # Global root layout
│   │   ├── page.tsx             # Public landing page
│   │   └── globals.css          # Tailwind base styling
│   ├── components/              # Reusable UI components
│   │   ├── ui/                  # Generic UI widgets (buttons, modals, inputs, badges)
│   │   ├── layout/              # Navbars, sidebars, headers
│   │   └── modules/             # Domain-specific components (HostelCard, RoomGrid, etc.)
│   ├── lib/                     # Server-only utilities & database clients
│   │   ├── db/
│   │   │   ├── mysql.ts         # MySQL connection pool singleton
│   │   │   └── mongodb.ts       # MongoDB client singleton
│   │   ├── auth/                # JWT session creation, validation, cookies, role checks
│   │   └── logger/              # Activity logger helper inserting into MongoDB
│   └── types/                   # Shared TypeScript interfaces & types
├── database/                    # SQL scripts & DBMS artifacts
│   ├── schema.sql               # Tables, constraints, indexes
│   ├── views.sql                # room_occupancy_summary view
│   ├── triggers.sql             # Allocation integrity triggers
│   ├── procedures.sql           # Atomic room allocation stored procedure
│   ├── seed.sql                 # Realistic demonstration seed data
│   └── demo_queries.sql         # Practical SQL demo queries for viva
├── docs/                        # Project documentation and architectural diagrams
├── .env.example                 # Environment variable templates (no secrets)
├── PROJECT_SPEC.md              # Requirements and specifications
├── DATABASE_CONCEPTS.md         # Advanced DBMS concepts documentation
├── DEMO_TALKING_POINTS.md       # Viva preparation and Q&A
├── FRIEND_TASKS.md              # Reserved task description for teammate
└── README.md                    # Setup and execution guide
```

---

## 4. Coding & Architecture Rules

1. **Security & Secrets:**
   - Never commit `.env` or `.env.local` files.
   - Never expose MySQL or MongoDB credentials to the browser (`NEXT_PUBLIC_` prefixes must never be used for backend secrets).
   - All backend API endpoints must validate user authorization (RBAC: `admin` vs `student`).
   - Use parameterized queries (`pool.execute(sql, [values])`) at all times to prevent SQL injection.

2. **DBMS Rigor (Academic Level 3 Standard):**
   - Room allocations **must be atomic** using explicit transactions or the dedicated stored procedure with pessimistic locking (`SELECT ... FOR UPDATE`).
   - Active room occupancy must never exceed room capacity defined in `room_types`.
   - MySQL triggers must catch and reject any direct invalid inserts/updates on allocations that violate capacity.
   - Do not fake DBMS features. Code must call the views, triggers, and procedures created.

3. **MongoDB Logging Rules:**
   - Log all critical business events asynchronously without failing the primary transaction if the log store has a transient glitch.
   - Standard log schema: `action`, `performedBy`, `targetType`, `targetId`, `studentId`, `roomId`, `timestamp`, `details`.
   - Create indexes on `timestamp`, `action`, `performedBy`, and `targetType`.

4. **Teammate Boundary (`FRIEND_TASKS.md`):**
   - **Do NOT implement** the reserved task: the MongoDB Activity Log Aggregation & Admin Viewer.
   - Provide the logging infrastructure and clear interfaces, but leave the aggregation endpoint and viewer UI for the teammate.

5. **UI & Code Quality:**
   - Build responsive, polished Tailwind UI with clear loading, error, and empty states.
   - Maintain documentation integrity and preserve all comments and type definitions.
   - Do not push commits to remote repositories without explicit user instruction.
