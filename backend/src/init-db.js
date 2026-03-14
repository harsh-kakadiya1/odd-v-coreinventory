const dotenv = require('dotenv');

dotenv.config();

const { connectToDatabase, ensureDatabaseSetup, getCollection, getNextSequence } = require('./db');

async function initDb() {
  try {
    await connectToDatabase();
    await ensureDatabaseSetup();

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

    console.log('MongoDB database initialized.');
  } catch (error) {
    console.error('Failed to initialize MongoDB database:', error.message);
    process.exitCode = 1;
  }
}

initDb();
