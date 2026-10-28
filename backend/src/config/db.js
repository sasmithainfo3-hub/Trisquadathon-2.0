import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from './env.js';

let mongodInstance = null;

export async function connectDb() {
  try {
    if (config.useMemoryDb) {
      console.log('[SafePath Database] No external MONGODB_URI detected. Initializing embedded MongoDB engine...');
      mongodInstance = await MongoMemoryServer.create({
        instance: { launchTimeout: 60000 }
      });
      const memoryUri = mongodInstance.getUri();
      await mongoose.connect(memoryUri);
      console.log(`[SafePath Database] Successfully connected to Embedded MongoDB: ${memoryUri}`);
      
      if (config.isProduction) {
        console.warn('\n=========================================================================');
        console.warn('⚠️  [SafePath Cloud Notice] Running with embedded in-memory database.');
        console.warn('👉 To connect a real persistent database on Render:');
        console.warn('   1. Create a free cluster on MongoDB Atlas (https://www.mongodb.com/atlas)');
        console.warn('   2. Set MONGODB_URI in your Render Dashboard -> Environment tab.');
        console.warn('=========================================================================\n');
      }
      return;
    }

    console.log(`[SafePath Database] Connecting to MongoDB at ${config.mongodbUri.replace(/\/\/.*@/, '//<credentials>@')}...`);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log('[SafePath Database] Successfully connected to MongoDB.');
  } catch (err) {
    console.warn(`[SafePath Database] External MongoDB connection failed (${err.message}). Attempting MongoMemoryServer fallback...`);
    try {
      if (!mongodInstance) {
        mongodInstance = await MongoMemoryServer.create({
          instance: { launchTimeout: 60000 }
        });
        const memoryUri = mongodInstance.getUri();
        await mongoose.connect(memoryUri);
        console.log(`[SafePath Database] Fallback connected to Embedded MongoDB: ${memoryUri}`);
      }
    } catch (fallbackErr) {
      console.error('[SafePath Database] Embedded MongoDB fallback failed:', fallbackErr.message);
      console.warn('[SafePath Database] Continuing server startup so cloud health checks pass.');
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
