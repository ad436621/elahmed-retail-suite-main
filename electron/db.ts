import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export function initializeDatabase() {
  const isDev = process.env.NODE_ENV !== 'production';
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, isDev ? 'retail_dev.sqlite' : 'retail_prod.sqlite');
  
  console.log(`Initializing SQLite database at: ${dbPath}`);
  
  const db = new Database(dbPath, { 
    verbose: isDev ? console.log : undefined 
  });

  // Enable WAL mode for better concurrency and performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize Schemas
  db.exec(`
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

  return db;
}
