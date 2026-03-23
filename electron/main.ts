import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeDatabase } from './db';
import { runDataMigration } from './migration';
import { setupIpcHandlers } from './ipcHandlers';
import { setupRepairHandlers } from './repairHandlers';

// Register the local-img:// protocol BEFORE app ready
// This lets Electron serve images saved by the save-image IPC handler
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-img', privileges: { secure: true, standard: true, bypassCSP: true } }
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: ReturnType<typeof initializeDatabase> | null = null;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    
    // Open DevTools even in production for debugging as requested by user
    mainWindow.webContents.openDevTools();

    // DevTools blocking removed for debugging phase
    /*
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
    */
  }

  // Hide menu bar to prevent tampering
  mainWindow.setMenuBarVisibility(false);
}

// ----------------------------------------------------
// IPC Database Handlers
// ----------------------------------------------------

// Fallback Key-Value store using settings table
ipcMain.on('store-get', (event, key: string) => {
  if (!db) { event.returnValue = null; return; }
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    event.returnValue = row ? JSON.parse(row.value) : null;
  } catch (err) {
    console.error('store-get error:', err);
    event.returnValue = null;
  }
});

ipcMain.on('store-set', (event, key: string, value: unknown) => {
  if (!db) { event.returnValue = false; return; }
  try {
    db.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
    event.returnValue = true;
  } catch (err) {
    console.error('store-set error:', err);
    event.returnValue = false;
  }
});

ipcMain.on('store-delete', (event, key: string) => {
  if (!db) { event.returnValue = false; return; }
  try {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    event.returnValue = true;
  } catch (err) {
    console.error('store-delete error:', err);
    event.returnValue = false;
  }
});

app.whenReady().then(() => {
  db = initializeDatabase();
  runDataMigration(db);
  setupIpcHandlers(db);
  setupRepairHandlers(db);

  // Register local-img:// to serve images saved by the save-image IPC handler
  const userDataPath = app.getPath('userData');
  const imagesDir = path.join(userDataPath, 'images');
  protocol.handle('local-img', (request) => {
    const fileName = request.url.slice('local-img://'.length).split('?')[0];
    const filePath = path.join(imagesDir, decodeURIComponent(fileName));
    return net.fetch(`file://${filePath}`);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler example
ipcMain.handle('ping', () => 'pong');

// Save image handler
ipcMain.handle('save-image', async (event, base64Data: string) => {
  try {
    const userDataPath = app.getPath('userData');
    const imagesDir = path.join(userDataPath, 'images');
    
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const matches = base64Data.match(/^data:([A-Za-z+/.-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { success: false, error: 'Invalid base64 format' };
    }
    const ext = matches[1].split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `img_${Date.now()}.${ext}`;
    const filePath = path.join(imagesDir, fileName);

    fs.writeFileSync(filePath, buffer);
    return { success: true, path: `local-img://${fileName}` };
  } catch (error: unknown) {
    console.error('Error saving image:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Backup & Restore — SQLite database file
// ─────────────────────────────────────────────────────────────────────────────

ipcMain.handle('db:backup', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const isDev = process.env.NODE_ENV !== 'production';
    const dbFile = path.join(userDataPath, isDev ? 'retail_dev.sqlite' : 'retail_prod.sqlite');

    const { canceled, filePath: savePath } = await dialog.showSaveDialog({
      title: 'حفظ نسخة احتياطية من قاعدة البيانات',
      defaultPath: path.join(app.getPath('downloads'), `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`),
      filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }],
    });

    if (canceled || !savePath) return { success: false, reason: 'canceled' };

    fs.copyFileSync(dbFile, savePath);
    return { success: true, path: savePath };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
});

ipcMain.handle('db:restore', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'استعادة قاعدة البيانات من نسخة احتياطية',
      filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths.length) return { success: false, reason: 'canceled' };

    const userDataPath = app.getPath('userData');
    const isDev = process.env.NODE_ENV !== 'production';
    const dbFile = path.join(userDataPath, isDev ? 'retail_dev.sqlite' : 'retail_prod.sqlite');
    const backupPath = dbFile + '.bak';

    // Keep a safety backup of current DB first
    if (fs.existsSync(dbFile)) {
      fs.copyFileSync(dbFile, backupPath);
    }

    fs.copyFileSync(filePaths[0], dbFile);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
});

ipcMain.handle('db:getUserDataPath', () => app.getPath('userData'));
