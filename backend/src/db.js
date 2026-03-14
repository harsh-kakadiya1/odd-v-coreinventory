const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const databaseName = process.env.MONGODB_DB_NAME || 'coreinventory';

let client;
let db;

async function connectToDatabase() {
  if (db) {
    return db;
  }

  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(databaseName);
  return db;
}

async function closeDatabaseConnection() {
  if (client) {
    await client.close();
  }

  client = undefined;
  db = undefined;
}

function getDb() {
  if (!db) {
    throw new Error('MongoDB is not connected yet. Call connectToDatabase first.');
  }
  return db;
}

function getCollection(name) {
  return getDb().collection(name);
}

async function getNextSequence(sequenceName) {
  const result = await getCollection('counters').findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  // MongoDB driver versions differ: some return the document directly, others return { value: doc }.
  if (result && typeof result.value === 'number' && typeof result._id !== 'undefined') {
    return result.value;
  }

  if (result && result.value && typeof result.value.value === 'number') {
    return result.value.value;
  }

  throw new Error(`Unable to resolve next sequence value for ${sequenceName}`);
}

async function ensureDatabaseSetup() {
  await connectToDatabase();
  // Remove any legacy unique `login_id` index which can cause duplicate-null errors
  try {
    const usersColl = getCollection('users');
    const existing = await usersColl.indexes();
    if (existing.some((ix) => ix.name === 'login_id_1')) {
      try {
        console.log('Dropping legacy index login_id_1 on users collection');
        await usersColl.dropIndex('login_id_1');
      } catch (err) {
        console.warn('Could not drop login_id_1 index:', err.message || err);
      }
    }
  } catch (err) {
    console.warn('Failed to inspect/drop legacy indexes on users collection:', err.message || err);
  }

  await Promise.all([
    // create a partial unique index on `login_id` so documents without a string
    // `login_id` (null/missing) don't block index creation due to duplicate nulls
    getCollection('users').createIndex(
      { login_id: 1 },
      { unique: true, partialFilterExpression: { login_id: { $type: 'string' } } }
    ),
    getCollection('users').createIndex({ email: 1 }, { unique: true }),
    getCollection('categories').createIndex({ name: 1 }, { unique: true }),
    getCollection('warehouses').createIndex({ name: 1 }, { unique: true }),
    getCollection('locations').createIndex({ warehouse_id: 1, name: 1 }, { unique: true }),
    getCollection('products').createIndex({ sku: 1 }, { unique: true }),
    getCollection('stock_balances').createIndex({ product_id: 1, location_id: 1 }, { unique: true }),
    getCollection('operation_lines').createIndex({ operation_id: 1 }),
    getCollection('stock_ledger').createIndex({ created_at: -1 }),
    getCollection('operations').createIndex({ created_at: -1 }),
    getCollection('password_reset_otps').createIndex({ user_id: 1, created_at: -1 }),
  ]);
}

module.exports = {
  closeDatabaseConnection,
  connectToDatabase,
  ensureDatabaseSetup,
  getCollection,
  getDb,
  getNextSequence,
};
