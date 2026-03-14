# CoreInventory - Inventory Management System

CoreInventory is a modular Inventory Management System with:

- React frontend
- Node.js + Express backend
- MongoDB database

## Features Implemented

- Authentication:
  - Signup / Login
  - OTP based password reset via email (Nodemailer + SMTP)
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
- `backend/` - Express API and MongoDB setup script
- `docker-compose.yml` - MongoDB container

## Run Locally

### 1) Start MongoDB

Use Docker:

```bash
docker compose up -d
```

### 2) Initialize database indexes and defaults

```bash
cd backend
npm run db:init
```

### 3) Seed demo data (users, products, operations)

```bash
cd backend
npm run db:seed
```

Seed script file: `backend/src/seed-db.js`.
It includes all demo account IDs and passwords in `SEEDED_ACCOUNTS` and prints them in terminal after seeding.

### 4) Start backend API

```bash
cd backend
npm run dev
```

Backend runs on `http://localhost:4000`.

### SMTP setup for OTP email

Create `backend/.env` with:

```bash
PORT=4000
JWT_SECRET=replace-with-strong-secret
OTP_EXPIRY_MINUTES=10

SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
MAIL_FROM="CoreInventory <no-reply@yourdomain.com>"
```

If SMTP credentials are missing or invalid, OTP email delivery will fail and `/api/auth/request-reset` will return an error.

### 5) Start frontend

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

- OTP is not returned in API response.
- Password policy for signup/reset: minimum 9 characters with uppercase, lowercase, number, and special character.
