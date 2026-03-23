"use strict";
const electron = require("electron");
const path = require("path");
const url = require("url");
const fs = require("fs");
const Database = require("better-sqlite3");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
function initializeDatabase() {
  const isDev = process.env.NODE_ENV !== "production";
  const userDataPath = electron.app.getPath("userData");
  const dbPath = path.join(userDataPath, isDev ? "retail_dev.sqlite" : "retail_prod.sqlite");
  console.log(`Initializing SQLite database at: ${dbPath}`);
  const db2 = new Database(dbPath, {
    verbose: isDev ? console.log : void 0
  });
  db2.pragma("journal_mode = WAL");
  db2.pragma("foreign_keys = ON");
  db2.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      fullName TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions TEXT, -- JSON
      active INTEGER DEFAULT 1,
      passwordHash TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      inventoryType TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT,
      barcode TEXT,
      deviceType TEXT,
      category TEXT,
      condition TEXT,
      storage TEXT,
      ram TEXT,
      color TEXT,
      quantity INTEGER DEFAULT 0,
      oldCostPrice REAL DEFAULT 0,
      newCostPrice REAL DEFAULT 0,
      salePrice REAL DEFAULT 0,
      supplier TEXT,
      source TEXT, -- 'mobile', 'computer', 'used', etc.
      notes TEXT,
      image TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      deletedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS product_batches (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      inventoryType TEXT,
      productName TEXT,
      costPrice REAL NOT NULL,
      salePrice REAL NOT NULL,
      quantity INTEGER NOT NULL,
      remainingQty INTEGER NOT NULL,
      purchaseDate TEXT NOT NULL,
      supplier TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      totalCost REAL NOT NULL,
      grossProfit REAL NOT NULL,
      marginPct REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      employee TEXT NOT NULL,
      voidedAt TEXT,
      voidReason TEXT,
      voidedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      productId TEXT NOT NULL,
      name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL,
      lineDiscount REAL DEFAULT 0,
      batches TEXT, -- JSON array of batch deductions
      FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      balance REAL DEFAULT 0,
      lastUpdated TEXT
    );
    
    CREATE TABLE IF NOT EXISTS installments (
      id TEXT PRIMARY KEY,
      contractNumber TEXT UNIQUE NOT NULL,
      customerId TEXT,
      customerName TEXT NOT NULL,
      customerPhone TEXT,
      customerAddress TEXT,
      customerNationalId TEXT,
      guarantorName TEXT,
      guarantorPhone TEXT,
      guarantorAddress TEXT,
      productId TEXT,
      productName TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      downPayment REAL NOT NULL,
      remainingAmount REAL NOT NULL,
      months INTEGER NOT NULL,
      monthlyPayment REAL NOT NULL,
      firstInstallmentDate TEXT,
      startDate TEXT NOT NULL,
      status TEXT NOT NULL, -- 'active', 'completed', 'defaulted'
      notes TEXT,
      settledEarly INTEGER DEFAULT 0,
      settlementDiscount REAL DEFAULT 0,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS installment_schedules (
      id TEXT PRIMARY KEY,
      contractId TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      amount REAL NOT NULL,
      paidAmount REAL DEFAULT 0,
      penalty REAL DEFAULT 0,
      paid INTEGER DEFAULT 0,
      paymentDate TEXT,
      FOREIGN KEY (contractId) REFERENCES installments(id) ON DELETE CASCADE
    );

    -- ==========================================
    -- NEW RELATIONAL TABLES (ELOS MIGRATION)
    -- ==========================================

    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      isDefault INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS accessories (
      id TEXT PRIMARY KEY,
      warehouseId TEXT,
      inventoryType TEXT NOT NULL, -- 'mobile_accessory', 'computer_spare_part', etc.
      name TEXT NOT NULL,
      category TEXT,
      subcategory TEXT,
      model TEXT,
      barcode TEXT,
      quantity INTEGER DEFAULT 0,
      costPrice REAL DEFAULT 0,
      salePrice REAL DEFAULT 0,
      minStock INTEGER DEFAULT 0,
      condition TEXT DEFAULT 'new',
      supplier TEXT,
      color TEXT,
      notes TEXT,
      image TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      partnershipType TEXT NOT NULL, -- 'investor', 'franchise', etc.
      sharePercent REAL DEFAULT 0,
      profitShareDevices REAL DEFAULT 0,
      profitShareAccessories REAL DEFAULT 0,
      capitalAmount REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS partner_transactions (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      type TEXT NOT NULL, -- 'investment', 'withdrawal', 'profit_distribution'
      amount REAL NOT NULL,
      description TEXT,
      createdAt TEXT,
      FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS safe_transactions (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL, -- link to wallet UUID
      type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'transfer_in', 'transfer_out'
      subType TEXT, -- 'opening_balance', 'partner_investment', 'expense', 'sale', 'purchase'
      amount REAL NOT NULL,
      category TEXT,
      description TEXT,
      paymentMethod TEXT,
      affectsCapital INTEGER DEFAULT 0,
      affectsProfit INTEGER DEFAULT 0,
      createdBy TEXT,
      relatedId TEXT, -- invoiceId, expenseId, etc.
      createdAt TEXT
    );
  `);
  return db2;
}
function runDataMigration(db2) {
  console.log("Running data migration check...");
  try {
    const partnersCount = db2.prepare("SELECT COUNT(*) as count FROM partners").get();
    if (partnersCount.count === 0) {
      const oldPartnersRow = db2.prepare("SELECT value FROM settings WHERE key = 'gx_partners'").get();
      if (oldPartnersRow) {
        const partnersList = JSON.parse(oldPartnersRow.value);
        console.log(`Migrating ${partnersList.length} partners...`);
        const insertPartner = db2.prepare(`
                    INSERT INTO partners (id, name, phone, address, partnershipType, sharePercent, capitalAmount, active, notes, createdAt, updatedAt) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
        db2.transaction(() => {
          for (const p of partnersList) {
            insertPartner.run(
              p.id,
              p.name,
              p.phone || null,
              p.address || null,
              p.partnershipType || "other",
              p.sharePercent || 0,
              p.capitalAmount || 0,
              p.active ? 1 : 0,
              p.notes || null,
              p.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
              p.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
            );
          }
        })();
        console.log("Partners migration complete.");
      }
    }
    const accessoriesCount = db2.prepare("SELECT COUNT(*) as count FROM accessories").get();
    if (accessoriesCount.count === 0) {
      const keysToMigrate = [
        { key: "gx_mobile_accessories", type: "mobile_accessory" },
        { key: "gx_mobile_spare_parts", type: "mobile_spare_part" },
        { key: "gx_computer_accessories_sa", type: "computer_accessory" },
        { key: "gx_computer_spare_parts", type: "computer_spare_part" },
        { key: "gx_device_accessories_sa", type: "device_accessory" },
        { key: "gx_device_spare_parts", type: "device_spare_part" }
      ];
      const insertAccessory = db2.prepare(`
                INSERT INTO accessories (id, inventoryType, name, category, subcategory, model, barcode, quantity, costPrice, salePrice, minStock, condition, supplier, color, notes, image, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
      db2.transaction(() => {
        for (const km of keysToMigrate) {
          const row = db2.prepare("SELECT value FROM settings WHERE key = ?").get(km.key);
          if (row && row.value) {
            const items = JSON.parse(row.value);
            for (const item of items) {
              insertAccessory.run(
                item.id,
                km.type,
                item.name,
                item.category || null,
                item.subcategory || null,
                item.model || null,
                item.barcode || item.serialNumber || null,
                item.quantity || 0,
                item.costPrice || item.newCostPrice || 0,
                item.salePrice || 0,
                item.minStock || 0,
                item.condition || "new",
                item.supplier || null,
                item.color || null,
                item.notes || item.description || null,
                item.image || null,
                item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
                item.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
              );
            }
            console.log(`Migrated ${items.length} items from ${km.key}`);
          }
        }
      })();
    }
    console.log("Data migration checks finished.");
  } catch (err) {
    console.error("Migration Error:", err);
  }
}
function setupIpcHandlers(db2) {
  electron.ipcMain.handle("db:partners:get", () => {
    return db2.prepare("SELECT * FROM partners ORDER BY createdAt DESC").all();
  });
  electron.ipcMain.handle("db:partners:add", (_, partner) => {
    const stmt = db2.prepare(`
      INSERT INTO partners (id, name, phone, address, partnershipType, sharePercent, profitShareDevices, profitShareAccessories, capitalAmount, active, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const id = partner.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    stmt.run(
      id,
      partner.name,
      partner.phone,
      partner.address,
      partner.partnershipType,
      partner.sharePercent || 0,
      partner.profitShareDevices || 0,
      partner.profitShareAccessories || 0,
      partner.capitalAmount || 0,
      partner.active ? 1 : 0,
      partner.notes,
      partner.createdAt || now,
      now
    );
    return db2.prepare("SELECT * FROM partners WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:partners:update", (_, id, data) => {
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (key !== "id" && key !== "createdAt") {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return true;
    sets.push(`updatedAt = ?`);
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    const stmt = db2.prepare(`UPDATE partners SET ${sets.join(", ")} WHERE id = ?`);
    stmt.run(...values);
    return db2.prepare("SELECT * FROM partners WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:partners:delete", (_, id) => {
    return db2.prepare("DELETE FROM partners WHERE id = ?").run(id).changes > 0;
  });
  electron.ipcMain.handle("db:partner_transactions:get", (_, partnerId) => {
    return db2.prepare("SELECT * FROM partner_transactions WHERE partnerId = ? ORDER BY createdAt DESC").all(partnerId);
  });
  electron.ipcMain.handle("db:partner_transactions:add", (_, trx) => {
    const id = trx.id || crypto.randomUUID();
    const now = trx.createdAt || (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO partner_transactions (id, partnerId, type, amount, description, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, trx.partnerId, trx.type, trx.amount, trx.description, now);
    return db2.prepare("SELECT * FROM partner_transactions WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:warehouses:get", () => {
    return db2.prepare("SELECT * FROM warehouses ORDER BY name ASC").all();
  });
  electron.ipcMain.handle("db:warehouses:add", (_, warehouse) => {
    const stmt = db2.prepare(`
      INSERT INTO warehouses (id, name, location, isDefault, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const id = warehouse.id || crypto.randomUUID();
    stmt.run(id, warehouse.name, warehouse.location, warehouse.isDefault ? 1 : 0, warehouse.notes);
    return db2.prepare("SELECT * FROM warehouses WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:warehouses:update", (_, id, data) => {
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (key !== "id") {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return true;
    values.push(id);
    db2.prepare(`UPDATE warehouses SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM warehouses WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:warehouses:delete", (_, id) => {
    return db2.prepare("DELETE FROM warehouses WHERE id = ?").run(id).changes > 0;
  });
  electron.ipcMain.handle("db:safe_transactions:get", () => {
    return db2.prepare("SELECT * FROM safe_transactions ORDER BY createdAt DESC").all();
  });
  electron.ipcMain.handle("db:safe_transactions:add", (_, trx) => {
    const id = trx.id || crypto.randomUUID();
    const now = trx.createdAt || (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO safe_transactions (id, walletId, type, subType, amount, category, description, paymentMethod, affectsCapital, affectsProfit, createdBy, relatedId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      trx.walletId,
      trx.type,
      trx.subType,
      trx.amount,
      trx.category,
      trx.description,
      trx.paymentMethod,
      trx.affectsCapital ? 1 : 0,
      trx.affectsProfit ? 1 : 0,
      trx.createdBy,
      trx.relatedId,
      now
    );
    return db2.prepare("SELECT * FROM safe_transactions WHERE id = ?").get(id);
  });
}
const __filename$1 = url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href);
const __dirname$1 = path.dirname(__filename$1);
let db = null;
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname$1, "../public/logo.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname$1, "preload.cjs")
      // compiled preload
    }
  });
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow == null ? void 0 : mainWindow.webContents.closeDevTools();
    });
  }
  mainWindow.setMenuBarVisibility(false);
}
electron.ipcMain.on("store-get", (event, key) => {
  if (!db) {
    event.returnValue = null;
    return;
  }
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    event.returnValue = row ? JSON.parse(row.value) : null;
  } catch (err) {
    console.error("store-get error:", err);
    event.returnValue = null;
  }
});
electron.ipcMain.on("store-set", (event, key, value) => {
  if (!db) {
    event.returnValue = false;
    return;
  }
  try {
    db.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
    event.returnValue = true;
  } catch (err) {
    console.error("store-set error:", err);
    event.returnValue = false;
  }
});
electron.ipcMain.on("store-delete", (event, key) => {
  if (!db) {
    event.returnValue = false;
    return;
  }
  try {
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
    event.returnValue = true;
  } catch (err) {
    console.error("store-delete error:", err);
    event.returnValue = false;
  }
});
electron.app.whenReady().then(() => {
  db = initializeDatabase();
  runDataMigration(db);
  setupIpcHandlers(db);
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.ipcMain.handle("ping", () => "pong");
electron.ipcMain.handle("save-image", async (event, base64Data) => {
  try {
    const userDataPath = electron.app.getPath("userData");
    const imagesDir = path.join(userDataPath, "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    const matches = base64Data.match(/^data:([A-Za-z+/.-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { success: false, error: "Invalid base64 format" };
    }
    const ext = matches[1].split("/")[1] || "png";
    const buffer = Buffer.from(matches[2], "base64");
    const fileName = `img_${Date.now()}.${ext}`;
    const filePath = path.join(imagesDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: `local-img://${fileName}` };
  } catch (error) {
    console.error("Error saving image:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
});
