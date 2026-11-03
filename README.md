# Smart PG & Hostel Room Allocation and Occupancy Management System

A full-stack web application designed for students and hostel administrators to handle room browsing, transparent applications, and atomic room allocations without overbooking beds.

Built as an academic DBMS Level 3 project demonstrating real-world relational database design with MySQL 8+ and activity logging with MongoDB Atlas.

---

## 💡 What Problem Does This Solve?

Finding PG or hostel accommodation usually involves paper forms, phone calls, and wardens manually keeping track of available beds on registers or spreadsheets. This leads to common headaches:
- Students have no way of knowing how many beds are genuinely free.
- Two students might accidentally be assigned to the same bed when wardens allocate rooms simultaneously.
- Room status changes and application decisions have no audit trail.

This system solves these issues through a **polyglot database approach**:
1. **MySQL 8+ (InnoDB):** Manages all structured relational data (`users`, `hostels`, `room_types`, `rooms`, `applications`, and `allocations`). It uses pessimistic row locking (`SELECT ... FOR UPDATE`), custom triggers, and stored procedures to guarantee that a room's physical capacity is never exceeded.
2. **MongoDB Atlas:** Records flexible activity and audit logs whenever important actions occur (like student signups, application submissions, approvals, and bed allocations).

---

## 🧰 Tech Stack

- **Frontend & APIs:** Next.js 14 (App Router, Server Components & Route Handlers)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Lucide Icons
- **Primary Database:** MySQL 8+ (via `mysql2`)
- **Secondary Database:** MongoDB Atlas (via official `mongodb` driver)
- **Authentication:** Stateless signed JWT session cookies (`jose`) and password hashing with `bcryptjs`

---

## 📁 Project Structure

```
smart-pg-hostel-management/
├── src/
│   ├── app/                     # Next.js App Router (pages and APIs)
│   │   ├── (auth)/              # Login and student registration
│   │   ├── (dashboard)/         # Protected student and admin portals
│   │   ├── api/                 # REST Route Handlers
│   │   ├── layout.tsx           # Global HTML layout
│   │   └── page.tsx             # Public landing page
│   ├── components/              # Reusable UI components
│   │   ├── layout/              # Navbars, headers, sidebars
│   │   └── ui/                  # Buttons, cards, modals, form inputs
│   ├── lib/                     # Server utilities and DB clients
│   │   ├── auth/                # Session cookies and RBAC guards
│   │   ├── db/                  # MySQL pool & MongoDB client singletons
│   │   └── logger/              # Activity logging helper
│   └── types/                   # Shared TypeScript definitions
├── database/                    # SQL scripts & DBMS artifacts
│   ├── schema.sql               # Tables, constraints, and indexes
│   ├── views.sql                # room_occupancy_summary view
│   ├── triggers.sql             # Allocation integrity triggers
│   ├── procedures.sql           # Atomic room allocation stored procedure
│   ├── seed.sql                 # Demonstration seed data
│   └── demo_queries.sql         # Viva demonstration SQL queries
├── .env.example                 # Environment variable templates
├── AGENTS.md                    # Project guidelines & conventions
├── PROJECT_SPEC.md              # Detailed project specifications
├── DATABASE_CONCEPTS.md         # Advanced DBMS concepts breakdown
├── DEMO_TALKING_POINTS.md       # Viva questions and answers
├── FRIEND_TASKS.md              # Reserved teammate contribution task
└── README.md                    # This guide
```

---

## ⚡ Quick Start & Setup

### 1. Requirements
- Node.js 20+ (tested on Node v26)
- npm 10+
- MySQL Server 8.0+
- MongoDB Atlas cluster (free M0 tier is sufficient)

### 2. Install Dependencies
```bash
git clone https://github.com/qamarahmoodi/smart-pg-hostel-management.git
cd smart-pg-hostel-management
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Update `.env.local` with your MySQL and MongoDB credentials:
```env
# Application & Auth
AUTH_SECRET="your-secure-random-32-char-secret-key"
SESSION_COOKIE_NAME="smart_pg_session"
SESSION_MAX_AGE_SECONDS=604800

# MySQL (Primary Store)
MYSQL_HOST="localhost"
MYSQL_PORT=3306
MYSQL_USER="root"
MYSQL_PASSWORD="your_mysql_password"
MYSQL_DATABASE="smart_hostel_db"
MYSQL_CONNECTION_LIMIT=10

# MongoDB Atlas (Audit Logging)
MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/hostel_management?retryWrites=true&w=majority"
MONGODB_DB="hostel_management"
```

### 4. Setup MySQL Database
Run the SQL scripts in this exact order:
```bash
# 1. Create tables, constraints, and indexes
mysql -u root -p < database/schema.sql

# 2. Create the occupancy view
mysql -u root -p < database/views.sql

# 3. Create capacity enforcement triggers
mysql -u root -p < database/triggers.sql

# 4. Create the allocation stored procedure
mysql -u root -p < database/procedures.sql

# 5. Load realistic demo seed data
mysql -u root -p < database/seed.sql
```

### 5. Start the Web App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Demo Accounts

All pre-seeded demo accounts use the password: `Password@123`

| Role | Name | Email | Scenario |
| :--- | :--- | :--- | :--- |
| **Admin** | System Administrator | `admin@smartpg.com` | Manages hostels, reviews applications, allocates rooms |
| **Student** | Aarav Sharma | `aarav.sharma@example.com` | Already allocated to Room G-101 |
| **Student** | Priya Patel | `priya.patel@example.com` | Allocated to Room S-102 (Double Sharing) |
| **Student** | Ananya Verma | `ananya.verma@example.com` | Roommate with Priya in Room S-102 |
| **Student** | Rohan Gupta | `rohan.gupta@example.com` | Application `APPROVED` (Ready to allocate in viva demo) |
| **Student** | Sneha Reddy | `sneha.reddy@example.com` | Application `PENDING` (Ready to approve in viva demo) |
| **Student** | Vikram Singh | `vikram.singh@example.com` | Application `REJECTED` (Incomplete documentation) |

---

## 🎓 Key DBMS Concepts Implemented

1. **ACID Transactions & Concurrency Control:**
   - The stored procedure `sp_allocate_room` uses pessimistic locking (`SELECT ... FOR UPDATE`) so two wardens allocating the last bed at the exact same moment cannot cause an overbooking.
2. **Database View (`room_occupancy_summary`):**
   - Uses `LEFT JOIN` on active allocations to calculate live occupied and available beds dynamically, even for empty rooms.
3. **Database Triggers:**
   - `trg_before_allocation_insert` prevents any direct insert that violates room capacity or assigns a student with an existing active bed.
   - `trg_after_allocation_insert` and `trg_after_allocation_update` automatically update physical room status between `AVAILABLE` and `OCCUPIED`.
4. **Normalized Relational Design:**
   - 6 tables with proper foreign keys, `ON DELETE CASCADE/RESTRICT` rules, composite unique constraints (`hostel_id + room_number`), and domain `CHECK` constraints.
5. **Practical Demo Queries:**
   - See [`database/demo_queries.sql`](file:///c:/Users/Qamar/Downloads/smart-pg-hostel-management/database/demo_queries.sql) for joins, subqueries, grouping, aggregations, trigger tests, and stored procedure calls.

For in-depth explanations and viva question preparations, check out [`DATABASE_CONCEPTS.md`](file:///c:/Users/Qamar/Downloads/smart-pg-hostel-management/DATABASE_CONCEPTS.md) and [`DEMO_TALKING_POINTS.md`](file:///c:/Users/Qamar/Downloads/smart-pg-hostel-management/DEMO_TALKING_POINTS.md).

---

## 👥 Division of Work

- **Primary Developer:** Full-stack architecture, relational database schema, views, triggers, stored procedures, Next.js portals, and MongoDB activity logging setup.
- **Teammate Task (Reserved):** Detailed in [`FRIEND_TASKS.md`](file:///c:/Users/Qamar/Downloads/smart-pg-hostel-management/FRIEND_TASKS.md) — building the MongoDB activity log aggregation query, admin API route, and visualizer page.
