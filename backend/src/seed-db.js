const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const {
  closeDatabaseConnection,
  connectToDatabase,
  ensureDatabaseSetup,
  getCollection,
  getNextSequence,
} = require('./db');

const SEEDED_ACCOUNTS = [
  {
    id: 1001,
    full_name: 'System Admin',
    email: 'admin@coreinventory.local',
    password: 'Admin@123',
    role: 'inventory_manager',
  },
  {
    id: 1002,
    full_name: 'Inventory Manager',
    email: 'manager@coreinventory.local',
    password: 'Manager@123',
    role: 'inventory_manager',
  },
  {
    id: 1003,
    full_name: 'Warehouse Staff',
    email: 'staff@coreinventory.local',
    password: 'Staff@123',
    role: 'warehouse_staff',
  },
  {
    id: 1004,
    full_name: 'Test User',
    email: 'test.user@example.com',
    password: 'secret123',
    role: 'inventory_manager',
  },
];

const SEEDED_CATEGORIES = ['Electronics', 'Raw Materials', 'Packaging', 'Spare Parts'];

const SEEDED_PRODUCTS = [
  {
    name: 'Barcode Scanner',
    sku: 'ELEC-SCAN-01',
    categoryName: 'Electronics',
    unit_of_measure: 'Unit',
    reorder_level: 10,
    per_unit_cost: 3000,
  },
  {
    name: 'Thermal Printer',
    sku: 'ELEC-PRN-01',
    categoryName: 'Electronics',
    unit_of_measure: 'Unit',
    reorder_level: 8,
    per_unit_cost: 5400,
  },
  {
    name: 'Corrugated Box - Medium',
    sku: 'PACK-BOX-M',
    categoryName: 'Packaging',
    unit_of_measure: 'Piece',
    reorder_level: 50,
    per_unit_cost: 85,
  },
  {
    name: 'Packing Tape Roll',
    sku: 'PACK-TAPE-01',
    categoryName: 'Packaging',
    unit_of_measure: 'Roll',
    reorder_level: 40,
    per_unit_cost: 120,
  },
  {
    name: 'Hydraulic Pump',
    sku: 'SPARE-HYD-01',
    categoryName: 'Spare Parts',
    unit_of_measure: 'Unit',
    reorder_level: 4,
    per_unit_cost: 12400,
  },
];

const ID_MANAGED_COLLECTIONS = [
  'users',
  'categories',
  'warehouses',
  'locations',
  'products',
  'operations',
  'operation_lines',
  'stock_ledger',
  'password_reset_otps',
];

async function bumpCounterAtLeast(sequenceName, minValue) {
  await getCollection('counters').updateOne(
    { _id: sequenceName },
    { $max: { value: minValue } },
    { upsert: true }
  );
}

async function upsertByUniqueKey(collectionName, query, docOnInsert, updateFields = {}) {
  const collection = getCollection(collectionName);
  const existing = await collection.findOne(query);

  if (existing) {
    if (Object.keys(updateFields).length) {
      await collection.updateOne({ _id: existing._id }, { $set: updateFields });
      return { ...existing, ...updateFields };
    }
    return existing;
  }

  await collection.insertOne(docOnInsert);
  return docOnInsert;
}

async function repairMissingIds() {
  for (const collectionName of ID_MANAGED_COLLECTIONS) {
    const collection = getCollection(collectionName);
    const brokenDocs = await collection
      .find({ $or: [{ id: { $exists: false } }, { id: null }] }, { projection: { _id: 1 } })
      .toArray();

    for (const doc of brokenDocs) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { id: await getNextSequence(collectionName) } }
      );
    }
  }
}

async function seedUsers() {
  const usersCollection = getCollection('users');
  const users = [];

  for (const account of SEEDED_ACCOUNTS) {
    const password_hash = await bcrypt.hash(account.password, 10);
    const user = await upsertByUniqueKey(
      'users',
      { email: account.email.toLowerCase() },
      {
        id: account.id,
        full_name: account.full_name,
        email: account.email.toLowerCase(),
        password_hash,
        role: account.role,
        created_at: new Date(),
      },
      {
        full_name: account.full_name,
        password_hash,
        role: account.role,
      }
    );

    users.push(user);
  }

  const maxUserId = users.reduce((max, user) => Math.max(max, Number(user.id || 0)), 0);
  await bumpCounterAtLeast('users', maxUserId);
  await usersCollection.createIndex({ id: 1 }, { unique: true });

  return users;
}

async function seedWarehousesAndLocations() {
  const mainWarehouse = await upsertByUniqueKey(
    'warehouses',
    { name: 'Main Warehouse' },
    {
      id: await getNextSequence('warehouses'),
      name: 'Main Warehouse',
      short_code: 'WH1',
      address: 'Sector 21, Main Industrial Area',
      created_at: new Date(),
    },
    {
      short_code: 'WH1',
      address: 'Sector 21, Main Industrial Area',
    }
  );

  const secondaryWarehouse = await upsertByUniqueKey(
    'warehouses',
    { name: 'Secondary Warehouse' },
    {
      id: await getNextSequence('warehouses'),
      name: 'Secondary Warehouse',
      short_code: 'WH2',
      address: 'Dock Zone, West Side Complex',
      created_at: new Date(),
    },
    {
      short_code: 'WH2',
      address: 'Dock Zone, West Side Complex',
    }
  );

  const stockLocation = await upsertByUniqueKey(
    'locations',
    { warehouse_id: mainWarehouse.id, name: 'Stock' },
    {
      id: await getNextSequence('locations'),
      warehouse_id: mainWarehouse.id,
      name: 'Stock',
      short_code: 'STK1',
      created_at: new Date(),
    },
    {
      short_code: 'STK1',
    }
  );

  const receivingLocation = await upsertByUniqueKey(
    'locations',
    { warehouse_id: mainWarehouse.id, name: 'Receiving' },
    {
      id: await getNextSequence('locations'),
      warehouse_id: mainWarehouse.id,
      name: 'Receiving',
      short_code: 'RCV1',
      created_at: new Date(),
    },
    {
      short_code: 'RCV1',
    }
  );

  const shippingLocation = await upsertByUniqueKey(
    'locations',
    { warehouse_id: mainWarehouse.id, name: 'Shipping' },
    {
      id: await getNextSequence('locations'),
      warehouse_id: mainWarehouse.id,
      name: 'Shipping',
      short_code: 'SHP1',
      created_at: new Date(),
    },
    {
      short_code: 'SHP1',
    }
  );

  const reserveLocation = await upsertByUniqueKey(
    'locations',
    { warehouse_id: secondaryWarehouse.id, name: 'Reserve' },
    {
      id: await getNextSequence('locations'),
      warehouse_id: secondaryWarehouse.id,
      name: 'Reserve',
      short_code: 'RSV2',
      created_at: new Date(),
    },
    {
      short_code: 'RSV2',
    }
  );

  return {
    mainWarehouse,
    secondaryWarehouse,
    stockLocation,
    receivingLocation,
    shippingLocation,
    reserveLocation,
  };
}

async function seedCategories() {
  const categoryByName = new Map();

  for (const categoryName of SEEDED_CATEGORIES) {
    const category = await upsertByUniqueKey(
      'categories',
      { name: categoryName },
      { id: await getNextSequence('categories'), name: categoryName, created_at: new Date() }
    );
    categoryByName.set(categoryName, category);
  }

  return categoryByName;
}

async function seedProducts(categoryByName) {
  const productsBySku = new Map();

  for (const productSeed of SEEDED_PRODUCTS) {
    const category = categoryByName.get(productSeed.categoryName);
    const product = await upsertByUniqueKey(
      'products',
      { sku: productSeed.sku },
      {
        id: await getNextSequence('products'),
        name: productSeed.name,
        sku: productSeed.sku,
        category_id: category ? category.id : null,
        unit_of_measure: productSeed.unit_of_measure,
        reorder_level: productSeed.reorder_level,
        per_unit_cost: productSeed.per_unit_cost,
        created_at: new Date(),
      },
      {
        name: productSeed.name,
        category_id: category ? category.id : null,
        unit_of_measure: productSeed.unit_of_measure,
        reorder_level: productSeed.reorder_level,
        per_unit_cost: productSeed.per_unit_cost,
      }
    );

    productsBySku.set(productSeed.sku, product);
  }

  return productsBySku;
}

async function setStock(productId, locationId, quantity) {
  await getCollection('stock_balances').updateOne(
    { product_id: productId, location_id: locationId },
    {
      $set: {
        quantity,
        updated_at: new Date(),
      },
      $setOnInsert: {
        created_at: new Date(),
      },
    },
    { upsert: true }
  );
}

async function ensureOperationWithLines(operationDoc, lineDocs) {
  const operationsCollection = getCollection('operations');
  const operationLinesCollection = getCollection('operation_lines');

  const existingOperation = await operationsCollection.findOne({ reference_code: operationDoc.reference_code });
  if (existingOperation) {
    return existingOperation;
  }

  const operation = {
    ...operationDoc,
    id: await getNextSequence('operations'),
    created_at: new Date(),
  };
  await operationsCollection.insertOne(operation);

  for (const line of lineDocs) {
    await operationLinesCollection.insertOne({
      id: await getNextSequence('operation_lines'),
      operation_id: operation.id,
      product_id: line.product_id,
      quantity: line.quantity,
    });
  }

  return operation;
}

async function addLedgerEntryIfMissing(referenceCode, ledgerDoc) {
  const operation = await getCollection('operations').findOne({ reference_code: referenceCode });
  if (!operation) {
    return;
  }

  const existing = await getCollection('stock_ledger').findOne({
    operation_id: operation.id,
    move_type: ledgerDoc.move_type,
    product_id: ledgerDoc.product_id,
    notes: ledgerDoc.notes,
  });

  if (existing) {
    return;
  }

  await getCollection('stock_ledger').insertOne({
    id: await getNextSequence('stock_ledger'),
    operation_id: operation.id,
    product_id: ledgerDoc.product_id,
    move_type: ledgerDoc.move_type,
    from_location_id: ledgerDoc.from_location_id || null,
    to_location_id: ledgerDoc.to_location_id || null,
    quantity: ledgerDoc.quantity,
    notes: ledgerDoc.notes,
    created_by: ledgerDoc.created_by,
    created_at: new Date(),
  });
}

async function seedOperationsAndLedger(users, locations, productsBySku) {
  const adminUser = users[0];

  const receipt = await ensureOperationWithLines(
    {
      operation_type: 'receipt',
      status: 'done',
      reference_code: 'SEED-REC-001',
      supplier_name: 'Demo Supplier Pvt Ltd',
      customer_name: null,
      from_location_id: null,
      to_location_id: locations.stockLocation.id,
      scheduled_at: new Date(),
      validated_at: new Date(),
      created_by: adminUser.id,
    },
    [
      { product_id: productsBySku.get('ELEC-SCAN-01').id, quantity: 30 },
      { product_id: productsBySku.get('ELEC-PRN-01').id, quantity: 20 },
      { product_id: productsBySku.get('PACK-BOX-M').id, quantity: 120 },
    ]
  );

  await addLedgerEntryIfMissing('SEED-REC-001', {
    move_type: 'receipt',
    product_id: productsBySku.get('ELEC-SCAN-01').id,
    to_location_id: locations.stockLocation.id,
    quantity: 30,
    notes: 'Seed receipt validated',
    created_by: adminUser.id,
  });

  await addLedgerEntryIfMissing('SEED-REC-001', {
    move_type: 'receipt',
    product_id: productsBySku.get('ELEC-PRN-01').id,
    to_location_id: locations.stockLocation.id,
    quantity: 20,
    notes: 'Seed receipt validated',
    created_by: adminUser.id,
  });

  await ensureOperationWithLines(
    {
      operation_type: 'delivery',
      status: 'ready',
      reference_code: 'SEED-DEL-001',
      supplier_name: null,
      customer_name: 'Retail Client A',
      from_location_id: locations.stockLocation.id,
      to_location_id: null,
      scheduled_at: new Date(),
      validated_at: null,
      created_by: adminUser.id,
    },
    [{ product_id: productsBySku.get('ELEC-SCAN-01').id, quantity: 5 }]
  );

  await ensureOperationWithLines(
    {
      operation_type: 'internal',
      status: 'waiting',
      reference_code: 'SEED-INT-001',
      supplier_name: null,
      customer_name: null,
      from_location_id: locations.stockLocation.id,
      to_location_id: locations.reserveLocation.id,
      scheduled_at: new Date(),
      validated_at: null,
      created_by: adminUser.id,
    },
    [{ product_id: productsBySku.get('PACK-BOX-M').id, quantity: 25 }]
  );

  await ensureOperationWithLines(
    {
      operation_type: 'adjustment',
      status: 'done',
      reference_code: 'SEED-ADJ-001',
      supplier_name: null,
      customer_name: null,
      from_location_id: null,
      to_location_id: locations.shippingLocation.id,
      scheduled_at: new Date(),
      validated_at: new Date(),
      created_by: adminUser.id,
    },
    [{ product_id: productsBySku.get('SPARE-HYD-01').id, quantity: 2 }]
  );

  await addLedgerEntryIfMissing('SEED-ADJ-001', {
    move_type: 'adjustment',
    product_id: productsBySku.get('SPARE-HYD-01').id,
    to_location_id: locations.shippingLocation.id,
    quantity: 2,
    notes: 'Seed stock adjustment validated',
    created_by: adminUser.id,
  });

  await setStock(productsBySku.get('ELEC-SCAN-01').id, locations.stockLocation.id, 30);
  await setStock(productsBySku.get('ELEC-PRN-01').id, locations.stockLocation.id, 20);
  await setStock(productsBySku.get('PACK-BOX-M').id, locations.stockLocation.id, 120);
  await setStock(productsBySku.get('PACK-TAPE-01').id, locations.receivingLocation.id, 75);
  await setStock(productsBySku.get('SPARE-HYD-01').id, locations.shippingLocation.id, 2);

  return receipt;
}

function printSeedSummary(users) {
  const rows = users.map((user) => {
    const source = SEEDED_ACCOUNTS.find((account) => account.email.toLowerCase() === user.email.toLowerCase());
    return {
      id: user.id,
      email: user.email,
      password: source ? source.password : 'n/a',
      role: user.role,
    };
  });

  console.log('\nSeeded Accounts (ID / Email / Password / Role):');
  console.table(rows);
}

async function seedDb() {
  try {
    await connectToDatabase();
    await ensureDatabaseSetup();
    await repairMissingIds();

    const users = await seedUsers();
    const locations = await seedWarehousesAndLocations();
    const categories = await seedCategories();
    const productsBySku = await seedProducts(categories);
    await seedOperationsAndLedger(users, locations, productsBySku);

    printSeedSummary(users);
    console.log('Seed data completed successfully.');
  } catch (error) {
    console.error('Failed to seed database:', error.message);
    process.exitCode = 1;
  } finally {
    await closeDatabaseConnection();
  }
}

seedDb();
