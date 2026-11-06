if (typeof window !== 'undefined') {
  throw new Error('Security Error: Database clients cannot be loaded in the browser');
}

import { MongoClient, Db, Collection } from 'mongodb';
import type { Document } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_management';
const defaultDbName = process.env.MONGODB_DB || 'hostel_management';

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
};

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

/**
 * Returns the cached MongoClient promise singleton.
 * Automatically clears cached promise if connection fails, enabling seamless retry on next call.
 */
export async function getMongoClient(): Promise<MongoClient> {
  const currentUri = process.env.MONGODB_URI || uri;

  if (process.env.NODE_ENV === 'development') {
    if (!global.__mongoClientPromise) {
      const client = new MongoClient(currentUri, options);
      global.__mongoClientPromise = client.connect().catch((err) => {
        global.__mongoClientPromise = undefined;
        throw err;
      });
    }
    return global.__mongoClientPromise;
  }

  if (!clientPromise) {
    const client = new MongoClient(currentUri, options);
    clientPromise = client.connect().catch((err) => {
      clientPromise = undefined;
      throw err;
    });
  }
  return clientPromise;
}

/**
 * Returns the target MongoDB database instance.
 * Defaults to 'hostel_management'.
 */
export async function getMongoDatabase(dbName?: string): Promise<Db> {
  const connectedClient = await getMongoClient();
  return connectedClient.db(dbName || defaultDbName);
}

/**
 * Returns the typed activity_logs collection.
 */
export async function getActivityLogsCollection<T extends Document = Document>(
  dbName?: string
): Promise<Collection<T>> {
  const db = await getMongoDatabase(dbName);
  return db.collection<T>('activity_logs');
}

/**
 * Tests connection to MongoDB and returns ping latency / database name.
 */
export async function verifyMongoConnection(): Promise<{
  ok: boolean;
  database?: string;
  pingMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const db = await getMongoDatabase();
    await db.command({ ping: 1 });
    const pingMs = Date.now() - start;
    return { ok: true, database: db.databaseName, pingMs };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('MongoDB Connection Error:', message);
    return { ok: false, error: message };
  }
}
