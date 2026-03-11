/**
 * MongoDB connection and database initialization
 * Manages the connection to MongoDB Atlas and creates necessary indices
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@dhakastockexchangeapi.thiqdiu.mongodb.net/?retryWrites=true&w=majority&appName=dhakaStockExchangeApi`;

const client = new MongoClient(uri);
let db;

/**
 * Connects to MongoDB and initializes the database
 * Creates unique index on (date, code) tuple to prevent duplicate archive data
 * @returns {Promise<Object>} MongoDB database instance
 */
async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("dse");

    // Create unique index on date + code to avoid duplicates in history collection
    const col = db.collection('history');
    await col.createIndex({ date: 1, code: 1 }, { unique: true });
  }
  return db;
}

module.exports = { connectDB };
