# CoreInventory - Inventory Management System

CoreInventory is a modular Inventory Management System with:

- React frontend
- Node.js + Express backend
- PostgreSQL database

## Features Implemented

- Authentication:
  - Signup / Login
  - OTP based password reset (development OTP preview)
- Dashboard KPIs:
  - Total products in stock
  - Low stock / out of stock
  - Pending receipts
  - Pending deliveries
  - Internal transfers scheduled
- Product Management:
  - Create product with SKU, category, UoM, reorder level, optional opening stock
  - Category management
  - Stock availability by location endpoint
- Operations:
  - Receipts
  - Delivery orders
  - Internal transfers
  - Inventory adjustments
  - Status flow (Draft, Waiting, Ready, Done, Canceled)
  - Validate operation updates stock balances and writes stock ledger entries
- Move History:
  - Stock ledger with filters
- Settings:
  - Warehouse and location configuration
- Profile + Logout

## Project Structure

- `frontend/` - React app
- `backend/` - Express API and SQL schema
- `docker-compose.yml` - PostgreSQL container

## Run Locally

### 1) Start PostgreSQL

Use Docker:

```bash
docker compose up -d
```

### 2) Initialize database schema

```bash
cd backend
npm run db:init
```

### 3) Start backend API

```bash
cd backend
npm run dev
```

Backend runs on `http://localhost:4000`.

### 4) Start frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies API requests to backend.

## Main API Routes

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/request-reset`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `GET /api/dashboard/kpis`
- `GET/POST /api/categories`
- `GET/POST /api/warehouses`
- `GET/POST /api/locations`
- `GET/POST /api/products`
- `PUT /api/products/:id`
- `GET /api/products/:id/availability`
- `GET/POST /api/operations`
- `POST /api/operations/:id/status`
- `POST /api/operations/:id/validate`
- `GET /api/ledger`

## Notes

- OTP is returned in API response for development convenience.
- For production, wire OTP to email/SMS and secure secrets.
