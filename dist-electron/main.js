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
  `);
  return db2;
}
const __dirname$1 = path.dirname(url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href));
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
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
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
    return { success: false, error: error.message };
  }
});
