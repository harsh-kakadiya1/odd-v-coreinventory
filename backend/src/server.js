const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

dotenv.config();

const {
  connectToDatabase,
  ensureDatabaseSetup,
  getCollection,
  getDb,
  getNextSequence,
} = require('./db');

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
  const warehouseCollection = getCollection('warehouses');
  const locationCollection = getCollection('locations');

  let warehouse = await warehouseCollection.findOne({ name: 'Main Warehouse' });
  if (!warehouse) {
    warehouse = {
      id: await getNextSequence('warehouses'),
      name: 'Main Warehouse',
      created_at: new Date(),
    };
    await warehouseCollection.insertOne(warehouse);
  }

  const stockLocation = await locationCollection.findOne({ warehouse_id: warehouse.id, name: 'Stock' });
  if (!stockLocation) {
    await locationCollection.insertOne({
      id: await getNextSequence('locations'),
      warehouse_id: warehouse.id,
      name: 'Stock',
      created_at: new Date(),
    });
  }
}

async function getStockAtLocation(productId, locationId) {
  const entry = await getCollection('stock_balances').findOne({
    product_id: Number(productId),
    location_id: Number(locationId),
  });
  return entry ? Number(entry.quantity) : 0;
}

async function updateStock(productId, locationId, delta) {
  if (!locationId) {
    return;
  }

  await getCollection('stock_balances').updateOne(
    { product_id: Number(productId), location_id: Number(locationId) },
    {
      $inc: { quantity: Number(delta) },
      $set: { updated_at: new Date() },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true }
  );
}

function stripMongoMeta(doc) {
  if (!doc) {
    return doc;
  }

  const { _id, ...rest } = doc;
  return rest;
}

function unwrapFindOneAndUpdateResult(result) {
  return result && result.value ? result.value : result;
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
    await getDb().command({ ping: 1 });
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
    const normalizedEmail = email.toLowerCase();
    const users = getCollection('users');

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: await getNextSequence('users'),
      full_name: fullName,
      email: normalizedEmail,
      password_hash: passwordHash,
      role: role || 'inventory_manager',
      created_at: new Date(),
    };

    await users.insertOne(newUser);

    const responseUser = {
      id: newUser.id,
      full_name: newUser.full_name,
      email: newUser.email,
      role: newUser.role,
    };

    const token = createToken(responseUser);
    return res.status(201).json({ token, user: responseUser });
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
    const user = await getCollection('users').findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

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
    const user = await getCollection('users').findOne({ email: parsed.data.email.toLowerCase() });
    if (!user) {
      return res.json({ message: 'If the account exists, OTP has been generated.' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);
    await getCollection('password_reset_otps').insertOne({
      id: await getNextSequence('password_reset_otps'),
      user_id: user.id,
      otp_code: otp,
      expires_at: expiresAt,
      used: false,
      created_at: new Date(),
    });

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
    const user = await getCollection('users').findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const otpRecord = await getCollection('password_reset_otps').findOne(
      {
        user_id: user.id,
        otp_code: otp,
        used: false,
        expires_at: { $gt: new Date() },
      },
      { sort: { created_at: -1 } }
    );

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await getCollection('users').updateOne({ id: user.id }, { $set: { password_hash: passwordHash } });
    await getCollection('password_reset_otps').updateOne({ id: otpRecord.id }, { $set: { used: true } });

    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset password', detail: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await getCollection('users').findOne(
      { id: Number(req.user.id) },
      { projection: { _id: 0, id: 1, full_name: 1, email: 1, role: 1, created_at: 1 } }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch profile', detail: error.message });
  }
});

app.get('/api/dashboard/kpis', authMiddleware, async (req, res) => {
  try {
    const [products, stockBalances, operations] = await Promise.all([
      getCollection('products').find({}, { projection: { _id: 0 } }).toArray(),
      getCollection('stock_balances').find({}, { projection: { _id: 0 } }).toArray(),
      getCollection('operations').find({}, { projection: { _id: 0 } }).toArray(),
    ]);

    const stockByProduct = new Map();
    for (const stock of stockBalances) {
      const key = Number(stock.product_id);
      const current = stockByProduct.get(key) || 0;
      stockByProduct.set(key, current + Number(stock.quantity || 0));
    }

    let totalProductsInStock = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;

    for (const product of products) {
      const totalQty = Number(stockByProduct.get(product.id) || 0);
      if (totalQty > 0) {
        totalProductsInStock += 1;
      }
      if (totalQty > 0 && totalQty <= Number(product.reorder_level || 0)) {
        lowStockItems += 1;
      }
      if (totalQty <= 0) {
        outOfStockItems += 1;
      }
    }

    const pendingStates = new Set(['draft', 'waiting', 'ready']);
    const pendingReceipts = operations.filter(
      (op) => op.operation_type === 'receipt' && pendingStates.has(op.status)
    ).length;
    const pendingDeliveries = operations.filter(
      (op) => op.operation_type === 'delivery' && pendingStates.has(op.status)
    ).length;
    const internalTransfersScheduled = operations.filter(
      (op) => op.operation_type === 'internal' && pendingStates.has(op.status)
    ).length;

    const recentOperations = [...operations]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((op) => ({
        id: op.id,
        operation_type: op.operation_type,
        status: op.status,
        reference: op.reference_code || `OP-${op.id}`,
        created_at: op.created_at,
      }));

    return res.json({
      total_products_in_stock: totalProductsInStock,
      low_stock_items: lowStockItems,
      out_of_stock_items: outOfStockItems,
      pending_receipts: pendingReceipts,
      pending_deliveries: pendingDeliveries,
      internal_transfers_scheduled: internalTransfersScheduled,
      recentOperations,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load dashboard', detail: error.message });
  }
});

app.get('/api/categories', authMiddleware, async (_req, res) => {
  try {
    const categories = await getCollection('categories')
      .find({}, { projection: { _id: 0, id: 1, name: 1 } })
      .sort({ name: 1 })
      .toArray();
    return res.json(categories);
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
    const name = parsed.data.name.trim();
    const categories = getCollection('categories');
    let category = await categories.findOne({ name }, { projection: { _id: 0, id: 1, name: 1 } });

    if (!category) {
      category = {
        id: await getNextSequence('categories'),
        name,
        created_at: new Date(),
      };
      await categories.insertOne(category);
    }

    return res.status(201).json({ id: category.id, name: category.name });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create category', detail: error.message });
  }
});

app.get('/api/warehouses', authMiddleware, async (_req, res) => {
  try {
    const warehouses = await getCollection('warehouses')
      .find({}, { projection: { _id: 0, id: 1, name: 1, created_at: 1 } })
      .sort({ created_at: 1 })
      .toArray();

    return res.json(warehouses.map((row) => ({ id: row.id, name: row.name })));
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
    const name = parsed.data.name.trim();
    const warehouses = getCollection('warehouses');
    let warehouse = await warehouses.findOne({ name }, { projection: { _id: 0, id: 1, name: 1 } });

    if (!warehouse) {
      warehouse = {
        id: await getNextSequence('warehouses'),
        name,
        created_at: new Date(),
      };
      await warehouses.insertOne(warehouse);
    }

    return res.status(201).json({ id: warehouse.id, name: warehouse.name });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create warehouse', detail: error.message });
  }
});

app.get('/api/locations', authMiddleware, async (_req, res) => {
  try {
    const [locations, warehouses] = await Promise.all([
      getCollection('locations').find({}, { projection: { _id: 0 } }).toArray(),
      getCollection('warehouses').find({}, { projection: { _id: 0 } }).toArray(),
    ]);

    const warehouseNameById = new Map(warehouses.map((w) => [w.id, w.name]));
    const rows = locations
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        warehouse_id: loc.warehouse_id,
        warehouse_name: warehouseNameById.get(loc.warehouse_id) || null,
      }))
      .sort((a, b) => {
        const w = (a.warehouse_name || '').localeCompare(b.warehouse_name || '');
        if (w !== 0) {
          return w;
        }
        return a.name.localeCompare(b.name);
      });

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch locations', detail: error.message });
  }
});

app.post('/api/locations', authMiddleware, async (req, res) => {
  const schema = z.object({
    warehouseId: z.coerce.number().int().positive(),
    name: z.string().min(2),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid location data' });
  }

  try {
    const name = parsed.data.name.trim();
    const warehouseId = Number(parsed.data.warehouseId);
    const locations = getCollection('locations');

    let location = await locations.findOne({ warehouse_id: warehouseId, name }, { projection: { _id: 0 } });

    if (!location) {
      location = {
        id: await getNextSequence('locations'),
        warehouse_id: warehouseId,
        name,
        created_at: new Date(),
      };
      await locations.insertOne(location);
    }

    return res.status(201).json({
      id: location.id,
      warehouse_id: location.warehouse_id,
      name: location.name,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create location', detail: error.message });
  }
});

app.get('/api/products', authMiddleware, async (req, res) => {
  try {
    let products = await getCollection('products').find({}, { projection: { _id: 0 } }).toArray();
    const [categories, stockBalances] = await Promise.all([
      getCollection('categories').find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
      getCollection('stock_balances').find({}, { projection: { _id: 0 } }).toArray(),
    ]);

    if (req.query.search) {
      const search = String(req.query.search).toLowerCase();
      products = products.filter(
        (p) => String(p.name || '').toLowerCase().includes(search) || String(p.sku || '').toLowerCase().includes(search)
      );
    }

    if (req.query.categoryId) {
      const categoryId = Number(req.query.categoryId);
      products = products.filter((p) => Number(p.category_id) === categoryId);
    }

    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const stockByProduct = new Map();

    for (const stock of stockBalances) {
      const key = Number(stock.product_id);
      const current = stockByProduct.get(key) || 0;
      stockByProduct.set(key, current + Number(stock.quantity || 0));
    }

    const rows = products
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        category_id: product.category_id || null,
        category_name: product.category_id ? categoryById.get(product.category_id) || null : null,
        unit_of_measure: product.unit_of_measure,
        reorder_level: Number(product.reorder_level || 0),
        total_stock: Number(stockByProduct.get(product.id) || 0),
      }));

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch products', detail: error.message });
  }
});

app.get('/api/products/:id/availability', authMiddleware, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const [locations, warehouses, stockBalances] = await Promise.all([
      getCollection('locations').find({}, { projection: { _id: 0 } }).toArray(),
      getCollection('warehouses').find({}, { projection: { _id: 0 } }).toArray(),
      getCollection('stock_balances').find({ product_id: productId }, { projection: { _id: 0 } }).toArray(),
    ]);

    const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
    const stockByLocation = new Map(stockBalances.map((s) => [s.location_id, Number(s.quantity || 0)]));

    const rows = locations
      .map((loc) => {
        const warehouse = warehouseById.get(loc.warehouse_id);
        return {
          location_id: loc.id,
          location_name: loc.name,
          warehouse_id: warehouse ? warehouse.id : null,
          warehouse_name: warehouse ? warehouse.name : null,
          quantity: Number(stockByLocation.get(loc.id) || 0),
        };
      })
      .sort((a, b) => {
        const w = String(a.warehouse_name || '').localeCompare(String(b.warehouse_name || ''));
        if (w !== 0) {
          return w;
        }
        return String(a.location_name || '').localeCompare(String(b.location_name || ''));
      });

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch product availability', detail: error.message });
  }
});

app.post('/api/products', authMiddleware, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    sku: z.string().min(2),
    categoryId: z.coerce.number().int().positive().optional().nullable(),
    unitOfMeasure: z.string().min(1),
    reorderLevel: z.coerce.number().min(0).optional(),
    initialStock: z.coerce.number().optional(),
    initialLocationId: z.coerce.number().int().positive().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid product payload', errors: parsed.error.issues });
  }

  const data = parsed.data;

  try {
    const normalizedSku = data.sku.trim().toUpperCase();
    const products = getCollection('products');
    const existing = await products.findOne({ sku: normalizedSku });
    if (existing) {
      return res.status(409).json({ message: 'SKU already exists' });
    }

    const product = {
      id: await getNextSequence('products'),
      name: data.name.trim(),
      sku: normalizedSku,
      category_id: data.categoryId || null,
      unit_of_measure: data.unitOfMeasure.trim(),
      reorder_level: Number(data.reorderLevel || 0),
      created_at: new Date(),
    };

    await products.insertOne(product);

    if (data.initialStock && data.initialStock !== 0 && data.initialLocationId) {
      await updateStock(product.id, data.initialLocationId, data.initialStock);

      await getCollection('stock_ledger').insertOne({
        id: await getNextSequence('stock_ledger'),
        operation_id: null,
        product_id: product.id,
        move_type: 'adjustment',
        from_location_id: null,
        to_location_id: data.initialLocationId,
        quantity: Number(data.initialStock),
        notes: 'Initial stock',
        created_by: Number(req.user.id),
        created_at: new Date(),
      });
    }

    return res.status(201).json({
      id: product.id,
      name: product.name,
      sku: product.sku,
      category_id: product.category_id,
      unit_of_measure: product.unit_of_measure,
      reorder_level: product.reorder_level,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create product', detail: error.message });
  }
});

app.put('/api/products/:id', authMiddleware, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    sku: z.string().min(2),
    categoryId: z.coerce.number().int().positive().optional().nullable(),
    unitOfMeasure: z.string().min(1),
    reorderLevel: z.coerce.number().min(0),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid product payload', errors: parsed.error.issues });
  }

  try {
    const productId = Number(req.params.id);
    const sku = parsed.data.sku.trim().toUpperCase();

    const products = getCollection('products');
    const existingWithSku = await products.findOne({ sku, id: { $ne: productId } });
    if (existingWithSku) {
      return res.status(409).json({ message: 'SKU already exists' });
    }

    const updateResult = await products.findOneAndUpdate(
      { id: productId },
      {
        $set: {
          name: parsed.data.name.trim(),
          sku,
          category_id: parsed.data.categoryId || null,
          unit_of_measure: parsed.data.unitOfMeasure.trim(),
          reorder_level: Number(parsed.data.reorderLevel),
        },
      },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
    const updatedProduct = unwrapFindOneAndUpdateResult(updateResult);

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const row = updatedProduct;
    return res.json({
      id: row.id,
      name: row.name,
      sku: row.sku,
      category_id: row.category_id,
      unit_of_measure: row.unit_of_measure,
      reorder_level: row.reorder_level,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update product', detail: error.message });
  }
});

app.get('/api/operations', authMiddleware, async (req, res) => {
  try {
    let operations = await getCollection('operations').find({}, { projection: { _id: 0 } }).toArray();
    const [lines, locations, products] = await Promise.all([
      getCollection('operation_lines').find({}, { projection: { _id: 0 } }).toArray(),
      getCollection('locations').find({}, { projection: { _id: 0 } }).toArray(),
      getCollection('products').find({}, { projection: { _id: 0, id: 1, category_id: 1 } }).toArray(),
    ]);

    const locationById = new Map(locations.map((loc) => [loc.id, loc]));
    const productById = new Map(products.map((p) => [p.id, p]));

    const linesByOperation = new Map();
    for (const line of lines) {
      const key = line.operation_id;
      if (!linesByOperation.has(key)) {
        linesByOperation.set(key, []);
      }
      linesByOperation.get(key).push(line);
    }

    if (req.query.documentType) {
      operations = operations.filter((op) => op.operation_type === req.query.documentType);
    }

    if (req.query.status) {
      operations = operations.filter((op) => op.status === req.query.status);
    }

    if (req.query.warehouseId) {
      const warehouseId = Number(req.query.warehouseId);
      operations = operations.filter((op) => {
        const from = locationById.get(op.from_location_id);
        const to = locationById.get(op.to_location_id);
        return (from && from.warehouse_id === warehouseId) || (to && to.warehouse_id === warehouseId);
      });
    }

    if (req.query.locationId) {
      const locationId = Number(req.query.locationId);
      operations = operations.filter(
        (op) => Number(op.from_location_id) === locationId || Number(op.to_location_id) === locationId
      );
    }

    if (req.query.categoryId) {
      const categoryId = Number(req.query.categoryId);
      operations = operations.filter((op) => {
        const opLines = linesByOperation.get(op.id) || [];
        return opLines.some((line) => {
          const product = productById.get(line.product_id);
          return product && Number(product.category_id) === categoryId;
        });
      });
    }

    const rows = operations
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((op) => {
        const opLines = linesByOperation.get(op.id) || [];
        const totalQuantity = opLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
        const fromLoc = locationById.get(op.from_location_id);
        const toLoc = locationById.get(op.to_location_id);

        return {
          id: op.id,
          operation_type: op.operation_type,
          status: op.status,
          reference_code: op.reference_code || null,
          supplier_name: op.supplier_name || null,
          customer_name: op.customer_name || null,
          from_location_id: op.from_location_id || null,
          to_location_id: op.to_location_id || null,
          scheduled_at: op.scheduled_at || null,
          validated_at: op.validated_at || null,
          created_at: op.created_at,
          from_location_name: fromLoc ? fromLoc.name : null,
          to_location_name: toLoc ? toLoc.name : null,
          line_count: opLines.length,
          total_quantity: totalQuantity,
        };
      });

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch operations', detail: error.message });
  }
});

app.post('/api/operations', authMiddleware, async (req, res) => {
  const lineSchema = z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number(),
  });

  const schema = z.object({
    operationType: z.enum(['receipt', 'delivery', 'internal', 'adjustment']),
    status: z.enum(['draft', 'waiting', 'ready']).optional(),
    referenceCode: z.string().optional().nullable(),
    supplierName: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    fromLocationId: z.coerce.number().int().positive().optional().nullable(),
    toLocationId: z.coerce.number().int().positive().optional().nullable(),
    scheduledAt: z.string().optional().nullable(),
    lines: z.array(lineSchema).min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid operation payload', errors: parsed.error.issues });
  }

  const data = parsed.data;

  try {
    const operation = {
      id: await getNextSequence('operations'),
      operation_type: data.operationType,
      status: data.status || 'draft',
      reference_code: data.referenceCode || null,
      supplier_name: data.supplierName || null,
      customer_name: data.customerName || null,
      from_location_id: data.fromLocationId || null,
      to_location_id: data.toLocationId || null,
      scheduled_at: data.scheduledAt ? new Date(data.scheduledAt) : null,
      created_by: Number(req.user.id),
      validated_at: null,
      created_at: new Date(),
    };

    await getCollection('operations').insertOne(operation);

    for (const line of data.lines) {
      await getCollection('operation_lines').insertOne({
        id: await getNextSequence('operation_lines'),
        operation_id: operation.id,
        product_id: Number(line.productId),
        quantity: Number(line.quantity),
      });
    }

    return res.status(201).json(stripMongoMeta(operation));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create operation', detail: error.message });
  }
});

app.post('/api/operations/:id/status', authMiddleware, async (req, res) => {
  const schema = z.object({ status: z.enum(['draft', 'waiting', 'ready', 'done', 'canceled']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const operationId = Number(req.params.id);
    const result = await getCollection('operations').findOneAndUpdate(
      { id: operationId },
      { $set: { status: parsed.data.status } },
      { returnDocument: 'after', projection: { _id: 0, id: 1, status: 1 } }
    );
    const updatedOperation = unwrapFindOneAndUpdateResult(result);

    if (!updatedOperation) {
      return res.status(404).json({ message: 'Operation not found' });
    }

    return res.json(updatedOperation);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update status', detail: error.message });
  }
});

app.post('/api/operations/:id/validate', authMiddleware, async (req, res) => {
  const operationId = Number(req.params.id);

  try {
    const operations = getCollection('operations');
    const operation = await operations.findOne({ id: operationId });
    if (!operation) {
      return res.status(404).json({ message: 'Operation not found' });
    }

    if (operation.status === 'done') {
      return res.status(400).json({ message: 'Operation already validated' });
    }
    if (operation.status === 'canceled') {
      return res.status(400).json({ message: 'Canceled operation cannot be validated' });
    }

    const lines = await getCollection('operation_lines')
      .find({ operation_id: operationId }, { projection: { _id: 0, product_id: 1, quantity: 1 } })
      .toArray();

    if (!lines.length) {
      return res.status(400).json({ message: 'Operation has no lines' });
    }

    for (const line of lines) {
      const productId = Number(line.product_id);
      const quantity = Number(line.quantity);
      const fromLocation = operation.from_location_id;
      const toLocation = operation.to_location_id;

      if (operation.operation_type === 'receipt') {
        if (!toLocation) {
          throw new Error('Receipt requires a destination location');
        }

        await updateStock(productId, toLocation, quantity);
        await getCollection('stock_ledger').insertOne({
          id: await getNextSequence('stock_ledger'),
          operation_id: operationId,
          product_id: productId,
          move_type: 'receipt',
          from_location_id: null,
          to_location_id: toLocation,
          quantity,
          notes: 'Receipt validated',
          created_by: Number(req.user.id),
          created_at: new Date(),
        });
      }

      if (operation.operation_type === 'delivery') {
        if (!fromLocation) {
          throw new Error('Delivery requires a source location');
        }

        const available = await getStockAtLocation(productId, fromLocation);
        if (available < quantity) {
          throw new Error(`Insufficient stock for product ${productId}`);
        }

        await updateStock(productId, fromLocation, -quantity);
        await getCollection('stock_ledger').insertOne({
          id: await getNextSequence('stock_ledger'),
          operation_id: operationId,
          product_id: productId,
          move_type: 'delivery',
          from_location_id: fromLocation,
          to_location_id: null,
          quantity: -quantity,
          notes: 'Delivery validated',
          created_by: Number(req.user.id),
          created_at: new Date(),
        });
      }

      if (operation.operation_type === 'internal') {
        if (!fromLocation || !toLocation) {
          throw new Error('Internal transfer requires source and destination locations');
        }

        const available = await getStockAtLocation(productId, fromLocation);
        if (available < quantity) {
          throw new Error(`Insufficient stock for product ${productId}`);
        }

        await updateStock(productId, fromLocation, -quantity);
        await updateStock(productId, toLocation, quantity);
        await getCollection('stock_ledger').insertOne({
          id: await getNextSequence('stock_ledger'),
          operation_id: operationId,
          product_id: productId,
          move_type: 'internal',
          from_location_id: fromLocation,
          to_location_id: toLocation,
          quantity,
          notes: 'Internal transfer validated',
          created_by: Number(req.user.id),
          created_at: new Date(),
        });
      }

      if (operation.operation_type === 'adjustment') {
        if (!toLocation) {
          throw new Error('Adjustment requires a location');
        }

        const available = await getStockAtLocation(productId, toLocation);
        if (quantity < 0 && available < Math.abs(quantity)) {
          throw new Error(`Adjustment cannot reduce below zero for product ${productId}`);
        }

        await updateStock(productId, toLocation, quantity);
        await getCollection('stock_ledger').insertOne({
          id: await getNextSequence('stock_ledger'),
          operation_id: operationId,
          product_id: productId,
          move_type: 'adjustment',
          from_location_id: null,
          to_location_id: toLocation,
          quantity,
          notes: 'Stock adjustment validated',
          created_by: Number(req.user.id),
          created_at: new Date(),
        });
      }
    }

    await operations.updateOne(
      { id: operationId },
      { $set: { status: 'done', validated_at: new Date() } }
    );

    return res.json({ message: 'Operation validated and stock updated' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get('/api/ledger', authMiddleware, async (req, res) => {
  try {
    let ledger = await getCollection('stock_ledger')
      .find({}, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .limit(500)
      .toArray();

    const [products, categories, locations] = await Promise.all([
      getCollection('products').find({}, { projection: { _id: 0, id: 1, name: 1, sku: 1, category_id: 1 } }).toArray(),
      getCollection('categories').find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
      getCollection('locations').find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const locationById = new Map(locations.map((l) => [l.id, l.name]));

    if (req.query.documentType) {
      ledger = ledger.filter((row) => row.move_type === req.query.documentType);
    }

    if (req.query.locationId) {
      const locationId = Number(req.query.locationId);
      ledger = ledger.filter(
        (row) => Number(row.from_location_id) === locationId || Number(row.to_location_id) === locationId
      );
    }

    if (req.query.categoryId) {
      const categoryId = Number(req.query.categoryId);
      ledger = ledger.filter((row) => {
        const product = productById.get(row.product_id);
        return product && Number(product.category_id) === categoryId;
      });
    }

    const rows = ledger.map((row) => {
      const product = productById.get(row.product_id);
      return {
        id: row.id,
        operation_id: row.operation_id,
        move_type: row.move_type,
        quantity: Number(row.quantity || 0),
        notes: row.notes || null,
        created_at: row.created_at,
        product_id: product ? product.id : null,
        product_name: product ? product.name : null,
        sku: product ? product.sku : null,
        category_name: product && product.category_id ? categoryById.get(product.category_id) || null : null,
        from_location_name: row.from_location_id ? locationById.get(row.from_location_id) || null : null,
        to_location_name: row.to_location_id ? locationById.get(row.to_location_id) || null : null,
      };
    });

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch stock ledger', detail: error.message });
  }
});

app.use((err, _req, res, _next) => {
  return res.status(500).json({ message: 'Unexpected server error', detail: err.message });
});

app.listen(port, async () => {
  try {
    await connectToDatabase();
    await ensureDatabaseSetup();
    await ensureDefaults();
    console.log(`CoreInventory API running on http://localhost:${port}`);
  } catch (error) {
    console.error('Failed to initialize defaults:', error.message);
  }
});
