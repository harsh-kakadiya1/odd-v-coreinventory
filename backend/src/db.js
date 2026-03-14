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

  const counter = result && result.value ? result.value : result;
  return counter.value;
}

async function ensureDatabaseSetup() {
  await connectToDatabase();

  await Promise.all([
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
  connectToDatabase,
  ensureDatabaseSetup,
  getCollection,
  getDb,
  getNextSequence,
};
