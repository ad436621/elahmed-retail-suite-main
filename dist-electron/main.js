"use strict";const T=require("electron"),o=require("path"),R=require("url"),i=require("fs"),p=require("better-sqlite3");var L=typeof document<"u"?document.currentScript:null;function X(){const t=process.env.NODE_ENV!=="production",r=T.app.getPath("userData"),e=o.join(r,t?"retail_dev.sqlite":"retail_prod.sqlite");console.log(`Initializing SQLite database at: ${e}`);const E=new p(e,{verbose:t?console.log:void 0});return E.pragma("journal_mode = WAL"),E.pragma("foreign_keys = ON"),E.exec(`
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
  `),E}const m=R.fileURLToPath(typeof document>"u"?require("url").pathToFileURL(__filename).href:L&&L.tagName.toUpperCase()==="SCRIPT"&&L.src||new URL("main.js",document.baseURI).href),c=o.dirname(m);let n=null,a=null;function l(){a=new T.BrowserWindow({width:1280,height:800,icon:o.join(c,"../public/logo.png"),webPreferences:{nodeIntegration:!1,contextIsolation:!0,preload:o.join(c,"preload.cjs")}}),process.env.NODE_ENV!=="production"&&process.env.VITE_DEV_SERVER_URL?(a.loadURL(process.env.VITE_DEV_SERVER_URL),a.webContents.openDevTools()):(a.loadFile(o.join(c,"../dist/index.html")),a.webContents.on("devtools-opened",()=>{a==null||a.webContents.closeDevTools()})),a.setMenuBarVisibility(!1)}T.ipcMain.on("store-get",(t,r)=>{if(!n){t.returnValue=null;return}try{const e=n.prepare("SELECT value FROM settings WHERE key = ?").get(r);t.returnValue=e?JSON.parse(e.value):null}catch(e){console.error("store-get error:",e),t.returnValue=null}});T.ipcMain.on("store-set",(t,r,e)=>{if(!n){t.returnValue=!1;return}try{n.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(r,JSON.stringify(e)),t.returnValue=!0}catch(E){console.error("store-set error:",E),t.returnValue=!1}});T.ipcMain.on("store-delete",(t,r)=>{if(!n){t.returnValue=!1;return}try{n.prepare("DELETE FROM settings WHERE key = ?").run(r),t.returnValue=!0}catch(e){console.error("store-delete error:",e),t.returnValue=!1}});T.app.whenReady().then(()=>{n=X(),l(),T.app.on("activate",()=>{T.BrowserWindow.getAllWindows().length===0&&l()})});T.app.on("window-all-closed",()=>{process.platform!=="darwin"&&T.app.quit()});T.ipcMain.handle("ping",()=>"pong");T.ipcMain.handle("save-image",async(t,r)=>{try{const e=T.app.getPath("userData"),E=o.join(e,"images");i.existsSync(E)||i.mkdirSync(E,{recursive:!0});const s=r.match(/^data:([A-Za-z+/.-]+);base64,(.+)$/);if(!s||s.length!==3)return{success:!1,error:"Invalid base64 format"};const u=s[1].split("/")[1]||"png",d=Buffer.from(s[2],"base64"),N=`img_${Date.now()}.${u}`,A=o.join(E,N);return i.writeFileSync(A,d),{success:!0,path:`local-img://${N}`}}catch(e){return console.error("Error saving image:",e),{success:!1,error:e instanceof Error?e.message:"Unknown error"}}});
