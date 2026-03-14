CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'inventory_manager',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, name)
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'Unit',
  reorder_level NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_balances (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity NUMERIC(14, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, location_id)
);

CREATE TABLE IF NOT EXISTS operations (
  id SERIAL PRIMARY KEY,
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('receipt', 'delivery', 'internal', 'adjustment')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'canceled')),
  reference_code VARCHAR(80),
  supplier_name VARCHAR(160),
  customer_name VARCHAR(160),
  from_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operation_lines (
  id SERIAL PRIMARY KEY,
  operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(14, 2) NOT NULL CHECK (quantity <> 0)
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id SERIAL PRIMARY KEY,
  operation_id INTEGER REFERENCES operations(id) ON DELETE SET NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  move_type VARCHAR(20) NOT NULL CHECK (move_type IN ('receipt', 'delivery', 'internal', 'adjustment')),
  from_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  quantity NUMERIC(14, 2) NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
