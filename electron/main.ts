import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeDatabase } from './db';

// @ts-ignore
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: any = null;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'), // compiled preload
    },
  });

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    
    // Disable DevTools in production for security
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
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
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    event.returnValue = row ? JSON.parse(row.value) : null;
  } catch (err) {
    console.error('store-get error:', err);
    event.returnValue = null;
  }
});

ipcMain.on('store-set', (event, key: string, value: any) => {
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

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { success: false, error: 'Invalid base64 format' };
    }

    const ext = matches[1].split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `img_${Date.now()}.${ext}`;
    const filePath = path.join(imagesDir, fileName);

    fs.writeFileSync(filePath, buffer);
    return { success: true, path: `local-img://${fileName}` }; // Custom protocol or just return path
  } catch (error: any) {
    console.error('Error saving image:', error);
    return { success: false, error: error.message };
  }
});
