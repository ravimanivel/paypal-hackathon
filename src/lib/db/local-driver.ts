import fs from "fs";
import path from "path";
import mongoose from "mongoose";

/**
 * Lightweight local BSON/JSON document engine for Mongoose collections.
 * Activates ONLY when MONGODB_URI is not configured or unreachable (e.g., sandbox/offline tests),
 * allowing all Mongoose Models, Schemas, validations, .lean(), .select(), .sort(), and atomic
 * findOneAndUpdate ($expr, $inc, $set) operations to execute natively.
 */

type DocRecord = Record<string, any>;

interface LocalStoreData {
  collections: Record<string, DocRecord[]>;
}

const DATA_FILE = path.join(process.cwd(), ".next-local-db.json");

let storeCache: LocalStoreData | null = null;
let isPatched = false;

function loadStore(): LocalStoreData {
  if (storeCache) return storeCache;
  try {
    if (fs.existsSync(DATA_FILE) && process.env.NODE_ENV !== "test") {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      storeCache = JSON.parse(raw);
      return storeCache!;
    }
  } catch {
    // Ignore read error
  }
  storeCache = { collections: {} };
  return storeCache;
}

function saveStore() {
  if (!storeCache || process.env.NODE_ENV === "test") return;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(storeCache, null, 2), "utf8");
  } catch {
    // Ignore write error in read-only environments
  }
}

export function clearLocalStore() {
  storeCache = { collections: {} };
}

function getCollectionDocs(name: string): DocRecord[] {
  const store = loadStore();
  if (!store.collections[name]) {
    store.collections[name] = [];
  }
  return store.collections[name];
}

function normalizeVal(val: any): any {
  if (val instanceof mongoose.Types.ObjectId) {
    return val.toString();
  }
  if (val && typeof val === "object" && val._bsontype === "ObjectId") {
    return val.toString();
  }
  if (val instanceof Date) {
    return val.getTime();
  }
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    const t = Date.parse(val);
    if (!Number.isNaN(t)) return t;
  }
  return val;
}

function getByPath(obj: any, pathStr: string): any {
  const parts = pathStr.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setByPath(obj: any, pathStr: string, value: any) {
  const parts = pathStr.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") {
      cur[p] = {};
    }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function evalExpr(expr: any, doc: DocRecord): any {
  if (typeof expr === "string" && expr.startsWith("$")) {
    return getByPath(doc, expr.slice(1));
  }
  if (typeof expr !== "object" || expr === null) {
    return expr;
  }
  if (Array.isArray(expr)) {
    return expr.map((e) => evalExpr(e, doc));
  }
  if ("$and" in expr) {
    return (expr.$and as any[]).every((sub) => Boolean(evalExpr(sub, doc)));
  }
  if ("$or" in expr) {
    return (expr.$or as any[]).some((sub) => Boolean(evalExpr(sub, doc)));
  }
  if ("$lte" in expr) {
    const [a, b] = expr.$lte;
    return Number(evalExpr(a, doc) ?? 0) <= Number(evalExpr(b, doc) ?? 0);
  }
  if ("$lt" in expr) {
    const [a, b] = expr.$lt;
    return Number(evalExpr(a, doc) ?? 0) < Number(evalExpr(b, doc) ?? 0);
  }
  if ("$gte" in expr) {
    const [a, b] = expr.$gte;
    return Number(evalExpr(a, doc) ?? 0) >= Number(evalExpr(b, doc) ?? 0);
  }
  if ("$add" in expr) {
    return (expr.$add as any[]).reduce(
      (acc, item) => acc + Number(evalExpr(item, doc) ?? 0),
      0
    );
  }
  return true;
}

function matchesFilter(doc: DocRecord, filter: Record<string, any> = {}): boolean {
  for (const [key, cond] of Object.entries(filter)) {
    if (key === "$or" && Array.isArray(cond)) {
      if (!cond.some((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    if (key === "$and" && Array.isArray(cond)) {
      if (!cond.every((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    if (key === "$expr") {
      if (!evalExpr(cond, doc)) return false;
      continue;
    }

    const docVal = getByPath(doc, key);

    if (
      cond !== null &&
      typeof cond === "object" &&
      !(cond instanceof mongoose.Types.ObjectId) &&
      !(cond instanceof Date) &&
      !(cond instanceof RegExp) &&
      !cond._bsontype
    ) {
      for (const [op, opVal] of Object.entries(cond)) {
        if (op === "$in" && Array.isArray(opVal)) {
          const normDoc = normalizeVal(docVal);
          if (!opVal.some((v) => normalizeVal(v) === normDoc)) return false;
        } else if (op === "$nin" && Array.isArray(opVal)) {
          const normDoc = normalizeVal(docVal);
          if (opVal.some((v) => normalizeVal(v) === normDoc)) return false;
        } else if (op === "$gte") {
          if (normalizeVal(docVal) < normalizeVal(opVal)) return false;
        } else if (op === "$gt") {
          if (normalizeVal(docVal) <= normalizeVal(opVal)) return false;
        } else if (op === "$lte") {
          if (normalizeVal(docVal) > normalizeVal(opVal)) return false;
        } else if (op === "$lt") {
          if (normalizeVal(docVal) >= normalizeVal(opVal)) return false;
        } else if (op === "$ne") {
          if (normalizeVal(docVal) === normalizeVal(opVal)) return false;
        } else if (op === "$regex") {
          const flags = cond.$options || "";
          const regex =
            opVal instanceof RegExp ? opVal : new RegExp(String(opVal), flags);
          if (!regex.test(String(docVal ?? ""))) return false;
        }
      }
    } else if (cond instanceof RegExp) {
      if (!cond.test(String(docVal ?? ""))) return false;
    } else {
      if (normalizeVal(docVal) !== normalizeVal(cond)) return false;
    }
  }
  return true;
}

function applyUpdate(doc: DocRecord, update: Record<string, any>) {
  const hasOperators = Object.keys(update).some((k) => k.startsWith("$"));
  if (!hasOperators) {
    for (const [k, v] of Object.entries(update)) {
      if (k !== "_id") setByPath(doc, k, v);
    }
  } else {
    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        setByPath(doc, k, v);
      }
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        const cur = Number(getByPath(doc, k) ?? 0);
        setByPath(doc, k, cur + Number(v));
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        const cur = getByPath(doc, k);
        if (Array.isArray(cur)) {
          cur.push(v);
        } else {
          setByPath(doc, k, [v]);
        }
      }
    }
  }
  doc.updatedAt = new Date();
}

function cloneDoc(doc: DocRecord): DocRecord {
  const copy = JSON.parse(JSON.stringify(doc));
  if (copy._id && typeof copy._id === "string" && mongoose.Types.ObjectId.isValid(copy._id)) {
    copy._id = new mongoose.Types.ObjectId(copy._id);
  }
  if (copy.userId && typeof copy.userId === "string" && mongoose.Types.ObjectId.isValid(copy.userId)) {
    copy.userId = new mongoose.Types.ObjectId(copy.userId);
  }
  if (copy.agentId && typeof copy.agentId === "string" && mongoose.Types.ObjectId.isValid(copy.agentId)) {
    copy.agentId = new mongoose.Types.ObjectId(copy.agentId);
  }
  if (copy.transactionId && typeof copy.transactionId === "string" && mongoose.Types.ObjectId.isValid(copy.transactionId)) {
    copy.transactionId = new mongoose.Types.ObjectId(copy.transactionId);
  }
  for (const dateField of ["createdAt", "updatedAt", "expiresAt", "usedAt", "lastLoginAt", "lastActiveAt", "resetTokenExpiresAt"]) {
    if (copy[dateField] && typeof copy[dateField] === "string") {
      copy[dateField] = new Date(copy[dateField]);
    }
  }
  return copy;
}

function applyProjection(doc: DocRecord, projection?: any, schemaPaths?: any): DocRecord {
  const cloned = cloneDoc(doc);
  if (!projection || typeof projection !== "object" || Object.keys(projection).length === 0) {
    // Respect select: false fields on schema unless explicitly selected
    if (schemaPaths) {
      for (const [pathName, schemaType] of Object.entries<any>(schemaPaths)) {
        if (schemaType?.options?.select === false) {
          delete cloned[pathName];
        }
      }
    }
    return cloned;
  }

  const keys = Object.keys(projection);
  const isInclusion = keys.some((k) => projection[k] === 1 || projection[k] === true);
  const hasPlus = keys.some((k) => k.startsWith("+"));

  if (hasPlus && schemaPaths) {
    for (const [pathName, schemaType] of Object.entries<any>(schemaPaths)) {
      if (schemaType?.options?.select === false && !projection[`+${pathName}`] && !projection[pathName]) {
        delete cloned[pathName];
      }
    }
    return cloned;
  }

  if (isInclusion) {
    const out: DocRecord = { _id: cloned._id };
    for (const k of keys) {
      if (projection[k]) {
        const cleanKey = k.startsWith("+") ? k.slice(1) : k;
        out[cleanKey] = getByPath(cloned, cleanKey);
      }
    }
    return out;
  } else {
    for (const k of keys) {
      if (projection[k] === 0 || projection[k] === false) {
        delete cloned[k];
      }
    }
    return cloned;
  }
}

export function enableLocalMongooseFallback() {
  if (isPatched) return;
  isPatched = true;

  mongoose.set("bufferCommands", false);

  // Patch Mongoose Query execution and Model static persistence methods when in local fallback mode
  const origExec = mongoose.Query.prototype.exec;

  mongoose.Query.prototype.exec = async function (this: any) {
    if ((global as any).mongooseGlobalCache?.mode !== "local_fallback") {
      return origExec.apply(this, arguments as any);
    }

    const model: mongoose.Model<any> = this.model;
    const collectionName = model.collection.collectionName || model.modelName.toLowerCase() + "s";
    const docs = getCollectionDocs(collectionName);
    const filter = this.getFilter ? this.getFilter() : this._conditions || {};
    const options = this.getOptions ? this.getOptions() : this.options || {};
    const update = this.getUpdate ? this.getUpdate() : this._update || {};
    const op = this.op;
    const fields = this._fields;
    const isLean = Boolean(this._mongooseOptions?.lean);
    const schemaPaths = model.schema?.paths;

    const toResultDoc = (raw: DocRecord | null) => {
      if (!raw) return null;
      const projected = applyProjection(raw, fields, schemaPaths);
      if (isLean) return projected;
      const fullClone = cloneDoc(raw);
      const instance = new model(fullClone);
      instance.isNew = false;
      for (const k of Object.keys(fullClone)) {
        (instance as any)[k] = fullClone[k];
      }
      return instance;
    };

    if (op === "find") {
      let matched = docs.filter((d) => matchesFilter(d, filter));
      if (options.sort) {
        const sortEntries = Object.entries(options.sort);
        matched.sort((a, b) => {
          for (const [k, dir] of sortEntries) {
            const va = normalizeVal(getByPath(a, k));
            const vb = normalizeVal(getByPath(b, k));
            if (va < vb) return dir === -1 || dir === "desc" ? 1 : -1;
            if (va > vb) return dir === -1 || dir === "desc" ? -1 : 1;
          }
          return 0;
        });
      }
      if (typeof options.skip === "number" && options.skip > 0) {
        matched = matched.slice(options.skip);
      }
      if (typeof options.limit === "number" && options.limit > 0) {
        matched = matched.slice(0, options.limit);
      }
      return matched.map((d) => toResultDoc(d));
    }

    if (op === "findOne") {
      const found = docs.find((d) => matchesFilter(d, filter)) || null;
      return toResultDoc(found);
    }

    if (op === "countDocuments" || op === "estimatedDocumentCount") {
      return docs.filter((d) => matchesFilter(d, filter)).length;
    }

    if (op === "findOneAndUpdate") {
      const found = docs.find((d) => matchesFilter(d, filter));
      if (!found) {
        if (options.upsert) {
          const newDoc: DocRecord = {
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          applyUpdate(newDoc, filter);
          applyUpdate(newDoc, update);
          docs.push(newDoc);
          saveStore();
          return toResultDoc(newDoc);
        }
        return null;
      }
      applyUpdate(found, update);
      saveStore();
      return toResultDoc(found);
    }

    if (op === "updateOne" || op === "updateMany") {
      const matched = docs.filter((d) => matchesFilter(d, filter));
      const targets = op === "updateOne" ? matched.slice(0, 1) : matched;
      for (const t of targets) {
        applyUpdate(t, update);
      }
      saveStore();
      return { acknowledged: true, modifiedCount: targets.length, matchedCount: targets.length };
    }

    if (op === "deleteOne" || op === "deleteMany" || op === "findOneAndDelete") {
      const idx = docs.findIndex((d) => matchesFilter(d, filter));
      if (op === "findOneAndDelete") {
        if (idx === -1) return null;
        const [removed] = docs.splice(idx, 1);
        saveStore();
        return toResultDoc(removed);
      }
      if (op === "deleteOne") {
        if (idx !== -1) docs.splice(idx, 1);
        saveStore();
        return { acknowledged: true, deletedCount: idx !== -1 ? 1 : 0 };
      }
      const before = docs.length;
      const remaining = docs.filter((d) => !matchesFilter(d, filter));
      docs.length = 0;
      docs.push(...remaining);
      saveStore();
      return { acknowledged: true, deletedCount: before - docs.length };
    }

    return origExec.apply(this, arguments as any);
  };

  const origSave = mongoose.Model.prototype.save;
  const origInternalSave = (mongoose.Model.prototype as any).$__save;

  const customSaveImpl = async function (this: any, options?: any, callback?: any) {
    if ((global as any).mongooseGlobalCache?.mode !== "local_fallback") {
      return origInternalSave
        ? origInternalSave.apply(this, arguments as any)
        : origSave.apply(this, arguments as any);
    }

    const model = this.constructor as mongoose.Model<any>;
    const collectionName =
      model.collection?.collectionName || model.modelName.toLowerCase() + "s";
    const docs = getCollectionDocs(collectionName);

    const existingIdx = this._id
      ? docs.findIndex((d) => normalizeVal(d._id) === normalizeVal(this._id))
      : -1;

    // Preserve unselected `select: false` fields (such as passwordHash) from the stored document before validating
    if (existingIdx !== -1) {
      const existingDoc = docs[existingIdx];
      for (const [k, v] of Object.entries(existingDoc)) {
        if (this.get(k) === undefined && v !== undefined) {
          this.set(k, v);
        }
      }
    }

    await this.validate();

    const rawObj = this.toObject({ depopulate: true, getters: false });
    if (existingIdx !== -1) {
      const existingDoc = docs[existingIdx];
      for (const [k, v] of Object.entries(existingDoc)) {
        if (rawObj[k] === undefined && v !== undefined) {
          rawObj[k] = v;
        }
      }
    }
    if (!rawObj._id) {
      rawObj._id = new mongoose.Types.ObjectId();
      this._id = rawObj._id;
    }
    const now = new Date();
    if (!rawObj.createdAt) {
      rawObj.createdAt = now;
      this.createdAt = now;
    }
    rawObj.updatedAt = now;
    this.updatedAt = now;

    // Enforce unique indexes on schema paths
    const schemaPaths = model.schema?.paths || {};

    for (const [pathName, schemaType] of Object.entries<any>(schemaPaths)) {
      if (schemaType?.options?.unique && rawObj[pathName] != null) {
        const dup = docs.find(
          (d, idx) =>
            idx !== existingIdx &&
            normalizeVal(getByPath(d, pathName)) ===
              normalizeVal(getByPath(rawObj, pathName))
        );
        if (dup) {
          const err: any = new Error(
            `E11000 duplicate key error collection: paypal-hackathon.${collectionName} index: ${pathName}_1 dup key: { ${pathName}: "${rawObj[pathName]}" }`
          );
          err.code = 11000;
          if (typeof callback === "function") return callback(err);
          throw err;
        }
      }
    }

    if (existingIdx !== -1) {
      docs[existingIdx] = rawObj;
    } else {
      docs.push(rawObj);
    }
    this.isNew = false;
    saveStore();
    if (typeof callback === "function") callback(null, this);
    return this;
  };

  const origHandleSave = (mongoose.Model.prototype as any).$__handleSave;
  (mongoose.Model.prototype as any).$__handleSave = function (
    this: any,
    options: any,
    callback: any
  ) {
    if ((global as any).mongooseGlobalCache?.mode !== "local_fallback") {
      return origHandleSave.apply(this, arguments as any);
    }
    customSaveImpl
      .call(this, options)
      .then((res) => callback(null, res))
      .catch((err) => callback(err));
  };
}
