import fs from "fs";
import path from "path";
import dns from "dns";
import mongoose from "mongoose";
import { getServerEnv, isConfiguredValue } from "@/lib/env";
import { enableLocalMongooseFallback } from "@/lib/db/local-driver";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  mode: "atlas" | "local" | "local_fallback" | "disconnected";
  seededAdmin: boolean;
  syncedLocalData?: boolean;
  lastUri?: string;
  lastAttemptAt?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseGlobalCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseGlobalCache ?? {
  conn: null,
  promise: null,
  mode: "disconnected",
  seededAdmin: false,
  syncedLocalData: false,
};

if (!global.mongooseGlobalCache) {
  global.mongooseGlobalCache = cached;
}

const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const OBJECT_ID_KEYS = new Set([
  "_id",
  "userId",
  "agentId",
  "policyId",
  "transactionId",
  "approvalId",
  "conversationId",
]);

function reviveBsonTypes(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => reviveBsonTypes(item));
  }
  if (typeof obj === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (
        OBJECT_ID_KEYS.has(k) &&
        typeof v === "string" &&
        /^[0-9a-fA-F]{24}$/.test(v)
      ) {
        out[k] = new mongoose.Types.ObjectId(v);
      } else if (typeof v === "string" && DATE_ISO_REGEX.test(v)) {
        const parsedDate = new Date(v);
        out[k] = Number.isNaN(parsedDate.getTime()) ? v : parsedDate;
      } else {
        out[k] = reviveBsonTypes(v);
      }
    }
    return out;
  }
  return obj;
}

export async function syncLocalStoreToMongoDB(conn: typeof mongoose) {
  if (
    cached.syncedLocalData ||
    process.env.NODE_ENV === "test" ||
    cached.mode === "local_fallback" ||
    conn.connection.readyState !== 1
  ) {
    return;
  }
  cached.syncedLocalData = true;

  try {
    const localFile = path.join(process.cwd(), ".next-local-db.json");
    if (!fs.existsSync(localFile)) return;

    const raw = fs.readFileSync(localFile, "utf8");
    const parsed = JSON.parse(raw);
    const collections: Record<string, Record<string, any>[]> =
      parsed?.collections || {};

    const db = conn.connection.db;
    if (!db) return;

    for (const [collectionName, docs] of Object.entries(collections)) {
      if (!Array.isArray(docs) || docs.length === 0) continue;
      const col = db.collection(collectionName);

      for (const rawDoc of docs) {
        if (!rawDoc || !rawDoc._id) continue;
        const doc = reviveBsonTypes(rawDoc);

        // For users collection, match by email or _id so we never hit duplicate email errors
        if (collectionName === "users" && doc.email) {
          const existingByEmail = await col.findOne({ email: doc.email });
          if (existingByEmail) {
            const { _id, ...updateFields } = doc;
            await col.updateOne(
              { _id: existingByEmail._id },
              { $setOnInsert: updateFields }
            );
            continue;
          }
        }

        // For policies collection, match by userId or _id
        if (collectionName === "policies" && doc.userId) {
          const existingByUser = await col.findOne({ userId: doc.userId });
          if (existingByUser) {
            continue;
          }
        }

        await col.updateOne(
          { _id: doc._id },
          { $setOnInsert: doc },
          { upsert: true }
        );
      }
    }
  } catch (err) {
    console.warn(
      "[AgentGuard DB]: Optional local-to-Atlas sync warning:",
      err instanceof Error ? err.message : err
    );
  }
}

export function ensureMongooseHealthy() {
  try {
    if (Array.isArray(mongoose.connections)) {
      // Remove any corrupted/undefined entries in mongoose.connections
      for (let i = mongoose.connections.length - 1; i >= 0; i--) {
        if (!mongoose.connections[i]) {
          mongoose.connections.splice(i, 1);
        }
      }
      for (const conn of mongoose.connections) {
        if (conn && Object.prototype.hasOwnProperty.call(conn, "readyState")) {
          delete (conn as any).readyState;
        }
      }
    }

    if (!mongoose.connection) {
      const conn = mongoose.createConnection();
      if (conn && Object.prototype.hasOwnProperty.call(conn, "readyState")) {
        delete (conn as any).readyState;
      }
      (conn as any).models = mongoose.models;
    } else if (
      Object.prototype.hasOwnProperty.call(mongoose.connection, "readyState")
    ) {
      delete (mongoose.connection as any).readyState;
    }

    if (
      mongoose.connection &&
      !(mongoose.connection as any).db &&
      (mongoose.connection as any)._readyState === 1
    ) {
      (mongoose.connection as any)._readyState = 0;
    }
    if (mongoose.connection && mongoose.models) {
      for (const model of Object.values(mongoose.models)) {
        if (model && (model as any).db !== mongoose.connection) {
          try {
            if (typeof (model as any).$__updateConnection === "function") {
              (model as any).$__updateConnection(mongoose.connection);
            } else {
              (model as any).db = mongoose.connection;
              (model as any).prototype.db = mongoose.connection;
            }
          } catch {
            // Ignore model rebind warning
          }
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

export function registerModel<T>(
  name: string,
  schema: mongoose.Schema<T>
): mongoose.Model<T> {
  ensureMongooseHealthy();
  if (mongoose.models && mongoose.models[name]) {
    const existing = mongoose.models[name] as mongoose.Model<T>;
    if (!existing.collection && mongoose.connection) {
      try {
        (existing as any).$__updateConnection(mongoose.connection);
      } catch {
        // Ignore if not needed
      }
    }
    return existing;
  }
  const conn = mongoose.connection;
  if (conn && conn.models && conn.models[name]) {
    mongoose.models[name] = conn.models[name];
    return conn.models[name] as mongoose.Model<T>;
  }
  return mongoose.model<T>(name, schema);
}

// Immediately heal any stale HMR state when this module is evaluated
ensureMongooseHealthy();

export async function connectDB(): Promise<typeof mongoose> {
  ensureMongooseHealthy();
  const env = getServerEnv();
  const configuredUri =
    process.env.NODE_ENV !== "test" && isConfiguredValue(env.MONGODB_URI)
      ? env.MONGODB_URI!
      : null;

  // If previously in local_fallback but MONGODB_URI was newly added or changed (or cooldown elapsed), upgrade connection to Atlas
  if (
    cached.mode === "local_fallback" &&
    configuredUri &&
    (cached.lastUri !== configuredUri ||
      Date.now() - (cached.lastAttemptAt || 0) > 30000)
  ) {
    cached.conn = null;
    cached.promise = null;
    cached.mode = "disconnected";
  }

  if (
    cached.conn &&
    (mongoose.connection.readyState === 1 || cached.mode === "local_fallback")
  ) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      if (configuredUri) {
        cached.lastUri = configuredUri;
        cached.lastAttemptAt = Date.now();
        try {
          if (configuredUri.startsWith("mongodb+srv://")) {
            try {
              const currentServers = dns.getServers();
              const publicDns = ["8.8.8.8", "1.1.1.1", "8.8.4.4"];
              dns.setServers(Array.from(new Set([...publicDns, ...currentServers])));
            } catch {
              // Ignore DNS configuration errors
            }
          }
          const conn = await mongoose.connect(configuredUri, {
            dbName: "paypal-hackathon",
            bufferCommands: false,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000,
          });
          cached.mode = configuredUri.includes("mongodb+srv")
            ? "atlas"
            : "local";
          await syncLocalStoreToMongoDB(conn);
          return conn;
        } catch (err) {
          console.warn(
            "[AgentGuard DB]: Could not reach configured MONGODB_URI, falling back to local Mongoose document engine:",
            err instanceof Error ? err.message : "Connection failed"
          );
        }
      }

      // Activate local Mongoose fallback engine so the application & tests work seamlessly
      enableLocalMongooseFallback();
      cached.mode = "local_fallback";
      return mongoose;
    })();
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
}

export function getDbConnectionStatus() {
  return {
    connected:
      mongoose.connection.readyState === 1 || cached.mode === "local_fallback",
    readyState:
      cached.mode === "local_fallback" ? 1 : mongoose.connection.readyState,
    dbName:
      mongoose.connection.db?.databaseName || "paypal-hackathon",
    mode: cached.mode,
  };
}
