const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const databaseName = process.env.MONGODB_DB_NAME || 'coreinventory';

let client;
let db;

function normalizeLoginIdCandidate(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 12);
}

async function ensureUserLoginIds() {
  const users = getCollection('users');
  const existingUsers = await users
    .find({}, { projection: { _id: 1, id: 1, email: 1, login_id: 1 } })
    .toArray();

  const usedLoginIds = new Set(
    existingUsers
      .map((user) => normalizeLoginIdCandidate(user.login_id))
      .filter((loginId) => Boolean(loginId))
  );

  for (const user of existingUsers) {
    const current = normalizeLoginIdCandidate(user.login_id);
    if (current) {
      continue;
    }

    const emailPrefix = String(user.email || '').split('@')[0];
    const userIdPart = String(user.id || '').replace(/[^0-9]/g, '');
    let base = normalizeLoginIdCandidate(emailPrefix) || normalizeLoginIdCandidate(`user${userIdPart}`) || 'user000';
    if (base.length < 6) {
      base = `${base}${userIdPart || '000000'}`.slice(0, 12);
    }

    let candidate = base.slice(0, 12);
    let attempt = 1;
    while (usedLoginIds.has(candidate) || candidate.length < 6) {
      const suffix = String(attempt);
      const prefixLength = Math.max(6 - suffix.length, 1);
      candidate = `${base.slice(0, Math.max(12 - suffix.length, prefixLength))}${suffix}`.slice(0, 12);
      attempt += 1;
    }

    usedLoginIds.add(candidate);
    await users.updateOne({ _id: user._id }, { $set: { login_id: candidate } });
  }
}

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
  await ensureUserLoginIds();

  await Promise.all([
    getCollection('users').createIndex({ login_id: 1 }, { unique: true }),
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
