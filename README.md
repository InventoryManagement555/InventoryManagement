# D-Mart Style Inventory Management System

A hostable, high-fidelity MVP of an Inventory Management System (Furniture + Grocery) featuring role-based auth, live ledger transaction history (where stock is always computed from the ledger rather than edited directly), automated demand forecasting, a fuzzy-matched natural language report assistant, role-appropriate operational views for admin and staff users, and a sticky navigation sidebar layout.

## Repository Architecture

The project is structured as a monorepo with clear subfolders for backend and frontend:

```
/backend
  /app
    /routers        # FastAPI endpoints (auth, items, stock, dashboard, forecasts, assistant, alerts, audit, export)
    /models         # SQLAlchemy database models (PostgreSQL)
    /schemas        # Pydantic schemas for request/response serialization
    /services       # Business services (stock ledger, dashboard metrics, forecast engine, fuzzy assistant)
    /core           # DB connections, JWT utilities, Redis client, configurations
    main.py         # Application root with CORS, startup, rate limits, global exception logging
  Dockerfile
  requirements.txt
  .env.example
  seed.py                   # Rebuilds tables and seeds Postgres + Redis with 120 items and ~11,000 entries
  test_signup_security.py   # Proves the signup privilege-escalation fix works
  test_otp_signup.py        # Proves the 6-digit signup OTP verification flow works
/frontend                   # React + TypeScript + Vite + Tailwind client dashboard (served via Nginx)
docker-compose.yml          # Orchestrates PostgreSQL + Redis + Backend + Frontend containers
README.md                   # This document
```

---

## Quick Start via Docker Compose (Recommended)

To launch the complete application stack (PostgreSQL + Redis Cache + API Backend + Frontend Client) in one command:

1. Copy the environment template file to `.env` in the root directory:
   ```bash
   cp .env.example .env   # Or create it manually
   ```
2. Configure your Gmail App Password and API keys in the root `.env` file:
   ```env
   # Add your Claude API key to test the conversational report assistant
   ANTHROPIC_API_KEY=your_anthropic_api_key_here

   # Set your Gmail App Password to enable real verification OTP email deliveries
   SMTP_PASSWORD=your_16_character_gmail_app_password
   ```
3. Build and start the containers:
   ```bash
   docker-compose up --build -d
   ```
4. Run the database seed script to populate PostgreSQL and Redis:
   ```bash
   docker-compose exec backend python seed.py
   ```
5. Verify the security fixes:
   ```bash
   docker-compose exec backend python test_signup_security.py
   docker-compose exec backend python test_otp_signup.py
   ```
6. Access the applications:
   - **Frontend Client**: `http://localhost:8080` (Sticky sidebar layout)
   - **FastAPI OpenAPI Auto Docs**: `http://localhost:8000/docs`

---

## Database Seeding & Login

The seed script drops existing tables, creates them cleanly, inserts category records, generates **120 unique items** (~35% furniture, ~65% grocery), generates **90 days of sales & restock transaction history (~11,000 entries)**, populates initial forecasts, and flushes the Redis cache.

Login to the frontend using the generated accounts (both are pre-verified by default):
- **Admin**: `admin@dmart.com` / `admin123` — Full metrics, forecasting, AI assistant, audit logs, creation permissions. Lands on `/dashboard`.
- **Staff**: `staff@dmart.com` / `staff123` — Inventory operations, stock in/out, own activity log. Lands on `/operations`.

---

## Role-Based Views & Features

### Admin Dashboard (`/dashboard`)
- Total stock value, item counts, category breakdowns, and top movers charts.
- **Active Unresolved Alerts Panel**: Lists low-stock and near-expiry grocery batches. Admins can click "Resolve" to clear alerts, which writes an entry to the Audit Log.
- **CSV Downloads**: "Download Summary CSV" button exports report sheets directly.
- **Activity Log Page**: View paginated administrative action history.

### Staff Operations (`/operations`)
- Searchable/filterable item list with stock health indicators.
- Quick Stock In/Out buttons with modal transaction forms.
- **My Recent Activity Panel**: Scoped to show the current user's own ledger entries only.
- **Cannot access**: Dashboard, Forecasts, Alerts list, Audit Logs, or AI Assistant.

---

## Local Development Setup

If running parts of the application outside of Docker:

### Running the Backend

1. Navigate to `/backend` and create a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and set your local PostgreSQL database and Redis URL connection strings:
   ```bash
   cp .env.example .env
   ```
4. Run uvicorn:
   ```bash
   uvicorn app.main:app --reload
   ```

### Running the Frontend

1. Navigate to `/frontend` and install packages:
   ```bash
   cd frontend
   npm install
   ```
2. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```

---

## Tech Stack & Data Storage

The system utilizes exactly two data stores. No third data store (such as SQLite) is used:
1. **PostgreSQL**: System of record for all relational tables (`users`, `categories`, `items`, `stock_ledger`, `sales`, `sale_items`, `forecasts`, `alerts`, and `audit_log`). Rejects non-PostgreSQL connection strings at startup.
2. **Redis**: Cache layer for storing computed `available_stock` values. Invalidated automatically on every `stock_ledger` write to maintain cache coherence.

---

## Key Design Principles & Security

### 1. Signup Privilege Escalation & OTP Verification (Critical)
Public signup (`POST /auth/signup`) ignores client-supplied roles and always creates a `staff` account. To activate the account, the user must input a 6-digit numeric OTP code sent to their email (expires in 15 minutes). Verification is completed via `POST /auth/verify-otp`. Unverified users are blocked from logging in.

### 2. Password Reset Recovery & Auto-Verification
Operators can request a recovery link at `POST /auth/forgot-password` (expires in 1 hour). The endpoint implements anti-enumeration protection (always returns the same success text whether or not the email exists). Completing a password reset automatically verifies the user account (`is_verified = True`), enabling immediate login access.

### 3. Dual-Source Authentication for CSV Downloads
FastAPI's `get_current_user` dependency accepts tokens from both `Authorization: Bearer <token>` HTTP headers and `?token=...` URL query parameters. This ensures that browser file downloads and direct report links (`/export/dashboard` and `/export/forecasts`) authenticate reliably without header stripping issues.

### 4. Derived Available Stock (Immutable Ledger)
The `items` table does NOT contain a `current_stock` column. Available stock is calculated dynamically using `SUM(change_qty) FROM stock_ledger`. All operations are `INSERT` commands; `UPDATE` operations on the ledger are prohibited.

### 5. Fuzzy-Matched AI Report Assistant (Safe-Query Pattern)
Instead of allowing arbitrary SQL generation, the assistant uses intent matching to bind users' requests to 7 fixed, parameterized template queries. The matching layer supports domain-specific typo correction (e.g. "stok"→"stock") and `difflib.SequenceMatcher` fuzzy scoring.

### 6. Sticky Navigation Sidebar Layout
The navigation sidebar is styled using `h-screen sticky top-0 flex flex-col`. The user identity card and the "TERMINATE SESSION" button remain permanently fixed at the bottom of the column, adapting to small viewport heights and screen scaling.

### 7. End-to-End Video Walkthrough
An automated browser subagent test suite captures complete video walkthroughs of all Admin and Staff workflows. Recordings are saved to:
- **`C:\Users\ASUS\Downloads\full_dmart_app_test.mp4`** (H.264 MP4 video)
- **`C:\Users\ASUS\Downloads\full_dmart_app_test.webp`** (WebP animation)
