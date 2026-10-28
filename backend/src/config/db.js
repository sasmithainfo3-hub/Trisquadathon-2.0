import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from './env.js';

let mongodInstance = null;

export async function connectDb() {
  try {
    if (config.useMemoryDb) {
      console.log('[SafePath Database] Initializing embedded in-memory MongoDB instance for local development/testing...');
      mongodInstance = await MongoMemoryServer.create({
        instance: { launchTimeout: 60000 }
      });
      const memoryUri = mongodInstance.getUri();
      await mongoose.connect(memoryUri);
      console.log(`[SafePath Database] Connected to In-Memory MongoDB: ${memoryUri}`);
      return;
    }

    console.log(`[SafePath Database] Connecting to MongoDB at ${config.mongodbUri}...`);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[SafePath Database] Successfully connected to MongoDB.');
  } catch (err) {
    if (config.nodeEnv !== 'production' && !mongodInstance) {
      console.warn(`[SafePath Database] External MongoDB connection failed (${err.message}). Falling back to MongoMemoryServer...`);
      mongodInstance = await MongoMemoryServer.create();
      const memoryUri = mongodInstance.getUri();
      await mongoose.connect(memoryUri);
      console.log(`[SafePath Database] Fallback connected to In-Memory MongoDB: ${memoryUri}`);
    } else {
      console.error('[SafePath Database] Fatal MongoDB connection error:', err);
      throw err;
    }
  }
}

export async function disconnectDb() {
  try {
    await mongoose.disconnect();
    if (mongodInstance) {
      await mongodInstance.stop();
      mongodInstance = null;
    }
    console.log('[SafePath Database] Disconnected from MongoDB.');
  } catch (err) {
    console.error('[SafePath Database] Error during disconnect:', err);
  }
}
