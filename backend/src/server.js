const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

dotenv.config();

const { pool, query } = require('./db');

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || 'change-me';
const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);

app.use(cors());
app.use(express.json());

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.full_name },
    jwtSecret,
    { expiresIn: '24h' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

async function ensureDefaults() {
  const warehouse = await query(
    `INSERT INTO warehouses (name)
     VALUES ('Main Warehouse')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );

  await query(
    `INSERT INTO locations (warehouse_id, name)
     VALUES ($1, 'Stock')
     ON CONFLICT (warehouse_id, name) DO UPDATE SET name = EXCLUDED.name`,
    [warehouse.rows[0].id]
  );
}

async function getStockAtLocation(client, productId, locationId) {
  const result = await client.query(
    `SELECT quantity
     FROM stock_balances
     WHERE product_id = $1 AND location_id = $2`,
    [productId, locationId]
  );

  return result.rows.length ? Number(result.rows[0].quantity) : 0;
}

async function updateStock(client, productId, locationId, delta) {
  if (!locationId) {
    return;
  }

  await client.query(
    `INSERT INTO stock_balances (product_id, location_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (product_id, location_id)
     DO UPDATE SET
       quantity = stock_balances.quantity + EXCLUDED.quantity,
       updated_at = NOW()`,
    [productId, locationId, delta]
  );
}

function createFilters(req) {
  const filters = [];
  const values = [];

  if (req.query.documentType) {
    values.push(req.query.documentType);
    filters.push(`o.operation_type = $${values.length}`);
  }
  if (req.query.status) {
    values.push(req.query.status);
    filters.push(`o.status = $${values.length}`);
  }
  if (req.query.warehouseId) {
    values.push(Number(req.query.warehouseId));
    filters.push(`(wl_from.warehouse_id = $${values.length} OR wl_to.warehouse_id = $${values.length})`);
  }
  if (req.query.locationId) {
    values.push(Number(req.query.locationId));
    filters.push(`(o.from_location_id = $${values.length} OR o.to_location_id = $${values.length})`);
  }
  if (req.query.categoryId) {
    values.push(Number(req.query.categoryId));
    filters.push(
      `EXISTS (
         SELECT 1
         FROM operation_lines ol
         JOIN products p ON p.id = ol.product_id
         WHERE ol.operation_id = o.id AND p.category_id = $${values.length}
      )`
    );
  }

  return {
    whereClause: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    values,
  };
}

const signupSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['inventory_manager', 'warehouse_staff']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    return res.json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const { fullName, email, password, role } = parsed.data;

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role`,
      [fullName, email.toLowerCase(), passwordHash, role || 'inventory_manager']
    );

    const token = createToken(result.rows[0]);
    return res.status(201).json({ token, user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to sign up', detail: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const { email, password } = parsed.data;

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = createToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to log in', detail: error.message });
  }
});

app.post('/api/auth/request-reset', async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid email' });
  }

  try {
    const userResult = await query('SELECT id, email FROM users WHERE email = $1', [parsed.data.email.toLowerCase()]);
    if (!userResult.rows.length) {
      return res.json({ message: 'If the account exists, OTP has been generated.' });
    }

    const user = userResult.rows[0];
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await query(
      `INSERT INTO password_reset_otps (user_id, otp_code, expires_at)
       VALUES ($1, $2, NOW() + ($3::text || ' minutes')::INTERVAL)`,
      [user.id, otp, otpExpiryMinutes]
    );

    return res.json({
      message: 'OTP generated. In production, send this via email/SMS.',
      otp,
      expiresInMinutes: otpExpiryMinutes,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate OTP', detail: error.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z.string().min(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const { email, otp, newPassword } = parsed.data;

  try {
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!userResult.rows.length) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const userId = userResult.rows[0].id;
    const otpResult = await query(
      `SELECT id
       FROM password_reset_otps
       WHERE user_id = $1
         AND otp_code = $2
         AND used = FALSE
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, otp]
    );

    if (!otpResult.rows.length) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await query('UPDATE password_reset_otps SET used = TRUE WHERE id = $1', [otpResult.rows[0].id]);

    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset password', detail: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT id, full_name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch profile', detail: error.message });
  }
});

app.get('/api/dashboard/kpis', authMiddleware, async (req, res) => {
  try {
    const stockResult = await query(
      `SELECT
         COUNT(DISTINCT CASE WHEN total_qty > 0 THEN p.id END) AS total_products_in_stock,
         COUNT(CASE WHEN total_qty <= p.reorder_level AND total_qty > 0 THEN 1 END) AS low_stock_items,
         COUNT(CASE WHEN total_qty <= 0 THEN 1 END) AS out_of_stock_items
       FROM products p
       LEFT JOIN (
         SELECT product_id, SUM(quantity) AS total_qty
         FROM stock_balances
         GROUP BY product_id
       ) sb ON sb.product_id = p.id`
    );

    const opResult = await query(
      `SELECT
         COUNT(CASE WHEN operation_type = 'receipt' AND status IN ('draft', 'waiting', 'ready') THEN 1 END) AS pending_receipts,
         COUNT(CASE WHEN operation_type = 'delivery' AND status IN ('draft', 'waiting', 'ready') THEN 1 END) AS pending_deliveries,
         COUNT(CASE WHEN operation_type = 'internal' AND status IN ('draft', 'waiting', 'ready') THEN 1 END) AS internal_transfers_scheduled
       FROM operations`
    );

    const recentOperations = await query(
      `SELECT
         o.id,
         o.operation_type,
         o.status,
         COALESCE(o.reference_code, CONCAT('OP-', o.id)) AS reference,
         o.created_at
       FROM operations o
       ORDER BY o.created_at DESC
       LIMIT 10`
    );

    return res.json({
      ...stockResult.rows[0],
      ...opResult.rows[0],
      recentOperations: recentOperations.rows,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load dashboard', detail: error.message });
  }
});

app.get('/api/categories', authMiddleware, async (_req, res) => {
  try {
    const result = await query('SELECT id, name FROM categories ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch categories', detail: error.message });
  }
});

app.post('/api/categories', authMiddleware, async (req, res) => {
  const schema = z.object({ name: z.string().min(2) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid category name' });
  }

  try {
    const result = await query(
      `INSERT INTO categories (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [parsed.data.name.trim()]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create category', detail: error.message });
  }
});

app.get('/api/warehouses', authMiddleware, async (_req, res) => {
  try {
    const result = await query('SELECT id, name FROM warehouses ORDER BY created_at ASC');
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch warehouses', detail: error.message });
  }
});

app.post('/api/warehouses', authMiddleware, async (req, res) => {
  const schema = z.object({ name: z.string().min(2) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid warehouse name' });
  }

  try {
    const result = await query(
      `INSERT INTO warehouses (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [parsed.data.name.trim()]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create warehouse', detail: error.message });
  }
});

app.get('/api/locations', authMiddleware, async (_req, res) => {
  try {
    const result = await query(
      `SELECT l.id, l.name, l.warehouse_id, w.name AS warehouse_name
       FROM locations l
       JOIN warehouses w ON w.id = l.warehouse_id
       ORDER BY w.name, l.name`
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch locations', detail: error.message });
  }
});

app.post('/api/locations', authMiddleware, async (req, res) => {
  const schema = z.object({
    warehouseId: z.number().int().positive(),
    name: z.string().min(2),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid location data' });
  }

  try {
    const result = await query(
      `INSERT INTO locations (warehouse_id, name)
       VALUES ($1, $2)
       ON CONFLICT (warehouse_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, warehouse_id, name`,
      [parsed.data.warehouseId, parsed.data.name.trim()]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create location', detail: error.message });
  }
});

app.get('/api/products', authMiddleware, async (req, res) => {
  const values = [];
  const filters = [];

  if (req.query.search) {
    values.push(`%${req.query.search}%`);
    filters.push(`(p.name ILIKE $${values.length} OR p.sku ILIKE $${values.length})`);
  }
  if (req.query.categoryId) {
    values.push(Number(req.query.categoryId));
    filters.push(`p.category_id = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const result = await query(
      `SELECT
         p.id,
         p.name,
         p.sku,
         p.category_id,
         c.name AS category_name,
         p.unit_of_measure,
         p.reorder_level,
         COALESCE(SUM(sb.quantity), 0) AS total_stock
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN stock_balances sb ON sb.product_id = p.id
       ${whereClause}
       GROUP BY p.id, c.name
       ORDER BY p.created_at DESC`,
      values
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch products', detail: error.message });
  }
});

app.get('/api/products/:id/availability', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT
         l.id AS location_id,
         l.name AS location_name,
         w.id AS warehouse_id,
         w.name AS warehouse_name,
         COALESCE(sb.quantity, 0) AS quantity
       FROM locations l
       JOIN warehouses w ON w.id = l.warehouse_id
       LEFT JOIN stock_balances sb ON sb.location_id = l.id AND sb.product_id = $1
       ORDER BY w.name, l.name`,
      [Number(req.params.id)]
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch product availability', detail: error.message });
  }
});

app.post('/api/products', authMiddleware, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    sku: z.string().min(2),
    categoryId: z.number().int().positive().optional().nullable(),
    unitOfMeasure: z.string().min(1),
    reorderLevel: z.number().min(0).optional(),
    initialStock: z.number().optional(),
    initialLocationId: z.number().int().positive().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid product payload', errors: parsed.error.issues });
  }

  const data = parsed.data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      `INSERT INTO products (name, sku, category_id, unit_of_measure, reorder_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, sku, category_id, unit_of_measure, reorder_level`,
      [
        data.name.trim(),
        data.sku.trim().toUpperCase(),
        data.categoryId || null,
        data.unitOfMeasure.trim(),
        data.reorderLevel || 0,
      ]
    );

    const product = productResult.rows[0];

    if (data.initialStock && data.initialStock !== 0 && data.initialLocationId) {
      await updateStock(client, product.id, data.initialLocationId, data.initialStock);

      await client.query(
        `INSERT INTO stock_ledger (operation_id, product_id, move_type, to_location_id, quantity, notes, created_by)
         VALUES (NULL, $1, 'adjustment', $2, $3, $4, $5)`,
        [product.id, data.initialLocationId, data.initialStock, 'Initial stock', req.user.id]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json(product);
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Failed to create product', detail: error.message });
  } finally {
    client.release();
  }
});

app.put('/api/products/:id', authMiddleware, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    sku: z.string().min(2),
    categoryId: z.number().int().positive().optional().nullable(),
    unitOfMeasure: z.string().min(1),
    reorderLevel: z.number().min(0),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid product payload', errors: parsed.error.issues });
  }

  try {
    const result = await query(
      `UPDATE products
       SET name = $1,
           sku = $2,
           category_id = $3,
           unit_of_measure = $4,
           reorder_level = $5
       WHERE id = $6
       RETURNING id, name, sku, category_id, unit_of_measure, reorder_level`,
      [
        parsed.data.name.trim(),
        parsed.data.sku.trim().toUpperCase(),
        parsed.data.categoryId || null,
        parsed.data.unitOfMeasure.trim(),
        parsed.data.reorderLevel,
        Number(req.params.id),
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update product', detail: error.message });
  }
});

app.get('/api/operations', authMiddleware, async (req, res) => {
  try {
    const { whereClause, values } = createFilters(req);

    const result = await query(
      `SELECT
         o.id,
         o.operation_type,
         o.status,
         o.reference_code,
         o.supplier_name,
         o.customer_name,
         o.from_location_id,
         o.to_location_id,
         o.scheduled_at,
         o.validated_at,
         o.created_at,
         lf.name AS from_location_name,
         lt.name AS to_location_name,
         COUNT(ol.id) AS line_count,
         COALESCE(SUM(ol.quantity), 0) AS total_quantity
       FROM operations o
       LEFT JOIN operation_lines ol ON ol.operation_id = o.id
       LEFT JOIN locations lf ON lf.id = o.from_location_id
       LEFT JOIN locations lt ON lt.id = o.to_location_id
       LEFT JOIN locations wl_from ON wl_from.id = o.from_location_id
       LEFT JOIN locations wl_to ON wl_to.id = o.to_location_id
       ${whereClause}
       GROUP BY o.id, lf.name, lt.name
       ORDER BY o.created_at DESC`,
      values
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch operations', detail: error.message });
  }
});

app.post('/api/operations', authMiddleware, async (req, res) => {
  const lineSchema = z.object({
    productId: z.number().int().positive(),
    quantity: z.number(),
  });

  const schema = z.object({
    operationType: z.enum(['receipt', 'delivery', 'internal', 'adjustment']),
    status: z.enum(['draft', 'waiting', 'ready']).optional(),
    referenceCode: z.string().optional().nullable(),
    supplierName: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    fromLocationId: z.number().int().positive().optional().nullable(),
    toLocationId: z.number().int().positive().optional().nullable(),
    scheduledAt: z.string().optional().nullable(),
    lines: z.array(lineSchema).min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid operation payload', errors: parsed.error.issues });
  }

  const data = parsed.data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const opResult = await client.query(
      `INSERT INTO operations (
         operation_type,
         status,
         reference_code,
         supplier_name,
         customer_name,
         from_location_id,
         to_location_id,
         scheduled_at,
         created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.operationType,
        data.status || 'draft',
        data.referenceCode || null,
        data.supplierName || null,
        data.customerName || null,
        data.fromLocationId || null,
        data.toLocationId || null,
        data.scheduledAt || null,
        req.user.id,
      ]
    );

    const operation = opResult.rows[0];

    for (const line of data.lines) {
      await client.query(
        `INSERT INTO operation_lines (operation_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [operation.id, line.productId, line.quantity]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json(operation);
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Failed to create operation', detail: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/operations/:id/status', authMiddleware, async (req, res) => {
  const schema = z.object({ status: z.enum(['draft', 'waiting', 'ready', 'done', 'canceled']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const result = await query(
      `UPDATE operations
       SET status = $1
       WHERE id = $2
       RETURNING id, status`,
      [parsed.data.status, Number(req.params.id)]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Operation not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update status', detail: error.message });
  }
});

app.post('/api/operations/:id/validate', authMiddleware, async (req, res) => {
  const operationId = Number(req.params.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const opResult = await client.query('SELECT * FROM operations WHERE id = $1 FOR UPDATE', [operationId]);
    if (!opResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Operation not found' });
    }

    const operation = opResult.rows[0];
    if (operation.status === 'done') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Operation already validated' });
    }
    if (operation.status === 'canceled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Canceled operation cannot be validated' });
    }

    const linesResult = await client.query('SELECT product_id, quantity FROM operation_lines WHERE operation_id = $1', [operationId]);
    if (!linesResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Operation has no lines' });
    }

    for (const line of linesResult.rows) {
      const productId = Number(line.product_id);
      const quantity = Number(line.quantity);
      const fromLocation = operation.from_location_id;
      const toLocation = operation.to_location_id;

      if (operation.operation_type === 'receipt') {
        if (!toLocation) {
          throw new Error('Receipt requires a destination location');
        }

        await updateStock(client, productId, toLocation, quantity);
        await client.query(
          `INSERT INTO stock_ledger (operation_id, product_id, move_type, to_location_id, quantity, notes, created_by)
           VALUES ($1, $2, 'receipt', $3, $4, $5, $6)`,
          [operationId, productId, toLocation, quantity, 'Receipt validated', req.user.id]
        );
      }

      if (operation.operation_type === 'delivery') {
        if (!fromLocation) {
          throw new Error('Delivery requires a source location');
        }

        const available = await getStockAtLocation(client, productId, fromLocation);
        if (available < quantity) {
          throw new Error(`Insufficient stock for product ${productId}`);
        }

        await updateStock(client, productId, fromLocation, -quantity);
        await client.query(
          `INSERT INTO stock_ledger (operation_id, product_id, move_type, from_location_id, quantity, notes, created_by)
           VALUES ($1, $2, 'delivery', $3, $4, $5, $6)`,
          [operationId, productId, fromLocation, -quantity, 'Delivery validated', req.user.id]
        );
      }

      if (operation.operation_type === 'internal') {
        if (!fromLocation || !toLocation) {
          throw new Error('Internal transfer requires source and destination locations');
        }

        const available = await getStockAtLocation(client, productId, fromLocation);
        if (available < quantity) {
          throw new Error(`Insufficient stock for product ${productId}`);
        }

        await updateStock(client, productId, fromLocation, -quantity);
        await updateStock(client, productId, toLocation, quantity);
        await client.query(
          `INSERT INTO stock_ledger (operation_id, product_id, move_type, from_location_id, to_location_id, quantity, notes, created_by)
           VALUES ($1, $2, 'internal', $3, $4, $5, $6, $7)`,
          [operationId, productId, fromLocation, toLocation, quantity, 'Internal transfer validated', req.user.id]
        );
      }

      if (operation.operation_type === 'adjustment') {
        if (!toLocation) {
          throw new Error('Adjustment requires a location');
        }

        const available = await getStockAtLocation(client, productId, toLocation);
        if (quantity < 0 && available < Math.abs(quantity)) {
          throw new Error(`Adjustment cannot reduce below zero for product ${productId}`);
        }

        await updateStock(client, productId, toLocation, quantity);
        await client.query(
          `INSERT INTO stock_ledger (operation_id, product_id, move_type, to_location_id, quantity, notes, created_by)
           VALUES ($1, $2, 'adjustment', $3, $4, $5, $6)`,
          [operationId, productId, toLocation, quantity, 'Stock adjustment validated', req.user.id]
        );
      }
    }

    await client.query('UPDATE operations SET status = $1, validated_at = NOW() WHERE id = $2', ['done', operationId]);

    await client.query('COMMIT');
    return res.json({ message: 'Operation validated and stock updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/ledger', authMiddleware, async (req, res) => {
  try {
    const values = [];
    const filters = [];

    if (req.query.documentType) {
      values.push(req.query.documentType);
      filters.push(`sl.move_type = $${values.length}`);
    }
    if (req.query.locationId) {
      values.push(Number(req.query.locationId));
      filters.push(`(sl.from_location_id = $${values.length} OR sl.to_location_id = $${values.length})`);
    }
    if (req.query.categoryId) {
      values.push(Number(req.query.categoryId));
      filters.push(`p.category_id = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         sl.id,
         sl.operation_id,
         sl.move_type,
         sl.quantity,
         sl.notes,
         sl.created_at,
         p.id AS product_id,
         p.name AS product_name,
         p.sku,
         c.name AS category_name,
         lf.name AS from_location_name,
         lt.name AS to_location_name
       FROM stock_ledger sl
       JOIN products p ON p.id = sl.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN locations lf ON lf.id = sl.from_location_id
       LEFT JOIN locations lt ON lt.id = sl.to_location_id
       ${whereClause}
       ORDER BY sl.created_at DESC
       LIMIT 500`,
      values
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch stock ledger', detail: error.message });
  }
});

app.use((err, _req, res, _next) => {
  return res.status(500).json({ message: 'Unexpected server error', detail: err.message });
});

app.listen(port, async () => {
  try {
    await ensureDefaults();
    console.log(`CoreInventory API running on http://localhost:${port}`);
  } catch (error) {
    console.error('Failed to initialize defaults:', error.message);
  }
});
