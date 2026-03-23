/**
 * ELOS Password Reset Tool
 * v1.0.0
 *
 * Usage: node reset-password.js
 *        or run ELOS-Reset-Password.exe
 */

const crypto = require('crypto');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Support running as pkg-compiled exe
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  const nativeAddonPath = path.join(path.dirname(process.execPath), 'better_sqlite3.node');
  if (fs.existsSync(nativeAddonPath)) {
    process.dlopen(module, nativeAddonPath);
    Database = require('better-sqlite3');
  } else {
    console.error('  Error: better_sqlite3.node not found next to exe');
    console.error('  Expected at:', nativeAddonPath);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Password Hashing (same method used in the application)
// ═══════════════════════════════════════════════════════════════════
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// ═══════════════════════════════════════════════════════════════════
// Database Discovery
// ═══════════════════════════════════════════════════════════════════
function findDatabase() {
  const exeDir = path.dirname(process.execPath);
  const possiblePaths = [
    'C:\\ELOS-Data\\elos.db',
    'D:\\ELOS-Data\\elos.db',
    'E:\\ELOS-Data\\elos.db',
    path.join(process.env.APPDATA || '', 'elos-accounting', 'elos.db'),
    path.join(exeDir, 'elos.db'),
    path.join(__dirname, 'elos.db')
  ];

  // Search Desktop and its subfolders
  const userProfile = process.env.USERPROFILE || '';
  if (userProfile) {
    const desktopPaths = [
      path.join(userProfile, 'Desktop'),
      path.join(userProfile, 'OneDrive', 'Desktop'),
      path.join(userProfile, 'OneDrive\\Desktop'),
    ];
    for (const desktop of desktopPaths) {
      if (fs.existsSync(desktop)) {
        try {
          const dirs = fs.readdirSync(desktop, { withFileTypes: true });
          for (const dir of dirs) {
            if (dir.isDirectory()) {
              const dbInDir = path.join(desktop, dir.name, 'elos.db');
              possiblePaths.push(dbInDir);
            }
          }
          possiblePaths.push(path.join(desktop, 'elos.db'));
        } catch (e) { /* ignore */ }
      }
    }
  }

  for (const dbPath of possiblePaths) {
    try {
      if (fs.existsSync(dbPath)) {
        return dbPath;
      }
    } catch (e) { /* ignore */ }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// CLI Interface
// ═══════════════════════════════════════════════════════════════════
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function printHeader() {
  console.clear();
  console.log('');
  console.log('+===============================================================+');
  console.log('|                                                               |');
  console.log('|    ███████╗██╗      ██████╗ ███████╗                          |');
  console.log('|    ██╔════╝██║     ██╔═══██╗██╔════╝                          |');
  console.log('|    █████╗  ██║     ██║   ██║███████╗                          |');
  console.log('|    ██╔══╝  ██║     ██║   ██║╚════██║                          |');
  console.log('|    ███████╗███████╗╚██████╔╝███████║                          |');
  console.log('|    ╚══════╝╚══════╝ ╚═════╝ ╚══════╝                          |');
  console.log('|                                                               |');
  console.log('|    Password Reset Tool                                        |');
  console.log('|    v1.0.0                                                     |');
  console.log('|                                                               |');
  console.log('+===============================================================+');
  console.log('');
}

function printUsers(users) {
  console.log('');
  console.log('Registered Users:');
  console.log('');
  console.log('+------+--------------------+--------------------+----------+----------+');
  console.log('|  #   | Username           | Display Name       | Role     | Status   |');
  console.log('+------+--------------------+--------------------+----------+----------+');

  users.forEach((user, index) => {
    const num = String(index + 1).padStart(4);
    const username = user.username.padEnd(18);
    const displayName = (user.display_name || '-').padEnd(18);
    const role = user.role.padEnd(8);
    const status = user.is_active ? 'Active  ' : 'Inactive';
    console.log(`| ${num} | ${username} | ${displayName} | ${role} | ${status} |`);
  });

  console.log('+------+--------------------+--------------------+----------+----------+');
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════
// Main Program
// ═══════════════════════════════════════════════════════════════════
async function main() {
  printHeader();

  // Search for database
  console.log('[*] Searching for database...');
  const dbPath = findDatabase();

  let finalDbPath = dbPath;
  if (!finalDbPath) {
    console.log('');
    console.log('[!] Database not found automatically.');
    console.log('');
    const manualPath = await ask('Enter path to elos.db: ');
    const trimmed = manualPath.trim().replace(/"/g, '');
    if (!trimmed || !fs.existsSync(trimmed)) {
      console.log('');
      console.log('[ERROR] File not found:', trimmed);
      console.log('');
      rl.close();
      return;
    }
    finalDbPath = trimmed;
  }

  console.log(`[OK] Database found: ${finalDbPath}`);

  // Open database
  let db;
  try {
    db = new Database(finalDbPath);
  } catch (error) {
    console.log('[ERROR] Failed to open database:', error.message);
    rl.close();
    return;
  }

  // Fetch users
  const users = db.prepare('SELECT id, username, display_name, role, is_active FROM users ORDER BY id').all();

  if (users.length === 0) {
    console.log('[ERROR] No users found in database!');
    db.close();
    rl.close();
    return;
  }

  printUsers(users);

  // Select user
  const choice = await ask('Enter user number to reset password (or 0 to exit): ');

  const userIndex = parseInt(choice) - 1;

  if (choice === '0' || isNaN(userIndex) || userIndex < 0 || userIndex >= users.length) {
    console.log('');
    console.log('Cancelled. Goodbye!');
    db.close();
    rl.close();
    return;
  }

  const selectedUser = users[userIndex];
  console.log('');
  console.log(`[OK] Selected user: ${selectedUser.username}`);

  // Check account status
  let activateAccount = false;
  if (!selectedUser.is_active) {
    console.log('');
    console.log('[WARNING] This account is INACTIVE!');
    const activateChoice = await ask('Do you want to activate this account? (y/n): ');
    activateAccount = activateChoice.toLowerCase() === 'y' || activateChoice.toLowerCase() === 'yes';
  }

  console.log('');

  // Enter new password
  const newPassword = await ask('Enter new password: ');

  if (!newPassword || newPassword.length < 4) {
    console.log('');
    console.log('[ERROR] Password too short (minimum 4 characters)');
    db.close();
    rl.close();
    return;
  }

  const confirmPassword = await ask('Confirm new password: ');

  if (newPassword !== confirmPassword) {
    console.log('');
    console.log('[ERROR] Passwords do not match!');
    db.close();
    rl.close();
    return;
  }

  // Update password
  try {
    const hashedPassword = hashPassword(newPassword);

    db.prepare(`
      UPDATE users
      SET password_hash = ?,
          failed_attempts = 0,
          locked_until = NULL,
          ${activateAccount ? 'is_active = 1,' : ''}
          updated_at = datetime('now')
      WHERE id = ?
    `).run(hashedPassword, selectedUser.id);

    console.log('');
    console.log('+===============================================================+');
    console.log('|                                                               |');
    console.log('|   [OK] Password changed successfully!                         |');
    console.log('|                                                               |');
    console.log(`|   User: ${selectedUser.username.padEnd(52)}|`);
    if (activateAccount) {
    console.log('|   Status: Account ACTIVATED                                   |');
    }
    console.log('|                                                               |');
    console.log('|   The user can now log in with the new password.              |');
    console.log('|                                                               |');
    console.log('+===============================================================+');
    console.log('');

  } catch (error) {
    console.log('');
    console.log('[ERROR] Failed to update password:', error.message);
  }

  db.close();
  rl.close();
}

// Run
main().catch(error => {
  console.error('Error:', error);
  rl.close();
});
