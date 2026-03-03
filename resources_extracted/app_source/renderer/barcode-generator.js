// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ ELOS BARCODE GENERATOR V18.0 - UI Wrapper for BarcodeService
// ═══════════════════════════════════════════════════════════════════════════════
//
// 📋 PURPOSE:
// This file provides the UI layer for barcode printing (preview modal, settings).
// All barcode rendering and format decisions are DELEGATED to BarcodeService.
//
// 🔧 ARCHITECTURE:
// - BarcodeService (barcode-service.js) = Single source of truth for rendering
// - BarcodeGenerator (this file) = UI components (modal, settings, short code generation)
//
// ⚠️ IMPORTANT:
// Do NOT add barcode rendering logic here. All SVG generation, format decisions,
// and thermal-safe settings are handled by BarcodeService.
//
// ═══════════════════════════════════════════════════════════════════════════════

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: console.log, warn: console.warn, error: console.error, debug: () => {}, info: console.info };
var Logger = window.Logger;

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 BARCODE RANGES (for short code generation)
// ═══════════════════════════════════════════════════════════════════════════════
const BARCODE_RANGES = {
  device: { min: 10000, max: 19999, digits: 5 },
  device_legacy: { min: 1000, max: 4999, digits: 4 },
  accessory: { min: 50000, max: 89999, digits: 5 },
  accessory_legacy: { min: 100000, max: 999999, digits: 6 }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get shop name from settings.
 * Delegates to BarcodeService when available.
 */
function getShopName() {
  if (typeof BarcodeService !== 'undefined' && BarcodeService.getShopName) {
    return BarcodeService.getShopName();
  }
  try {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    return settings.companyName || 'ELOS';
  } catch (e) {
    return 'ELOS';
  }
}

/**
 * Format price for display.
 * Delegates to BarcodeService when available.
 */
function formatPrice(price) {
  if (typeof BarcodeService !== 'undefined' && BarcodeService.formatPrice) {
    return BarcodeService.formatPrice(price);
  }
  const num = Number(price || 0);
  return num.toLocaleString('en-US') + ' L.E';
}

/**
 * Extract short code from item.
 * Delegates to BarcodeService.getPrintableCode().
 */
function extractShortCode(item, type = null) {
  if (!item) return '';

  // Delegate to BarcodeService
  if (typeof BarcodeService !== 'undefined' && BarcodeService.getPrintableCode) {
    return BarcodeService.getPrintableCode(item, { type: type || 'device' });
  }

  // Fallback: simple extraction (only if BarcodeService not loaded)
  return item.short_code || item.barcode || item.code || '';
}

/**
 * Determine barcode type from code value.
 * Delegates to BarcodeService.getBarcodeType().
 */
function getBarcodeType(code) {
  if (typeof BarcodeService !== 'undefined' && BarcodeService.getBarcodeType) {
    return BarcodeService.getBarcodeType(code);
  }
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 EAN-13 HELPER FUNCTIONS (Legacy compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

const EAN13_PREFIXES = {
  device: '2',
  accessory: '3',
  repair: '4'
};

function calculateEAN13CheckDigit(code12) {
  if (typeof BarcodeService !== 'undefined' && BarcodeService.calculateEAN13CheckDigit) {
    return BarcodeService.calculateEAN13CheckDigit(code12);
  }

  const digits = code12.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

function generateEAN13Code(type, sequentialNumber) {
  const prefix = EAN13_PREFIXES[type] || '2';
  const numStr = String(sequentialNumber).padStart(11, '0');
  const code12 = prefix + numStr;
  return code12 + calculateEAN13CheckDigit(code12);
}

function parseEAN13Code(code) {
  if (!code || code.length !== 13) return null;
  const prefix = code[0];
  const type = Object.keys(EAN13_PREFIXES).find(k => EAN13_PREFIXES[k] === prefix) || 'unknown';
  return { type, number: parseInt(code.substring(1, 12), 10), prefix };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 BARCODE SVG GENERATION (Delegates to BarcodeService)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate barcode SVG.
 * DELEGATES to BarcodeService.renderBarcodeSVG() for thermal-safe output.
 */
function generateBarcodeSVG(text, width, height) {
  // ALWAYS delegate to BarcodeService for thermal-safe rendering
  if (typeof BarcodeService !== 'undefined' && BarcodeService.renderBarcodeSVG) {
    // Determine appropriate profile based on height
    const labelProfile = (height && height <= 30) ? 'SPLIT' : 'FULL';
    return BarcodeService.renderBarcodeSVG(text, { labelProfile });
  }

  // Fallback: Only if BarcodeService not loaded (should not happen in production)
  Logger.error('[BARCODE-GENERATOR] BarcodeService not available! Using fallback.');
  return _fallbackGenerateBarcodeSVG(text, width, height);
}

/**
 * Fallback SVG generation (only if BarcodeService fails to load).
 * @private
 */
function _fallbackGenerateBarcodeSVG(text, width, height) {
  const cleanText = String(text).replace(/[^0-9]/g, '').trim();
  if (!cleanText || cleanText.length === 0) {
    return '';
  }

  // Check JsBarcode availability
  if (typeof JsBarcode === 'undefined') {
    Logger.error('[BARCODE-GENERATOR] JsBarcode not loaded!');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40" viewBox="0 0 200 40">
      <rect x="0" y="0" width="200" height="40" fill="#ffffff"/>
      <text x="100" y="20" text-anchor="middle" fill="#ff0000" font-size="12">JsBarcode NOT LOADED</text>
    </svg>`;
  }

  const svgNS = "http://www.w3.org/2000/svg";
  const tempSvg = document.createElementNS(svgNS, "svg");

  try {
    JsBarcode(tempSvg, cleanText, {
      format: "CODE128",
      width: 2.4,
      height: height || 36,
      displayValue: true,
      fontSize: 11,
      textMargin: 2,
      margin: 12,
      background: "#ffffff",
      lineColor: "#000000",
      textPosition: "bottom",
      textAlign: "center",
      flat: true
    });

    return tempSvg.outerHTML;
  } catch (error) {
    Logger.error('[BARCODE-GENERATOR] Fallback JsBarcode error:', error);
    return '';
  }
}

// Alias for backward compatibility
function generateCode128SVG(text, width, height) {
  return generateBarcodeSVG(text, width, height);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 LABEL GENERATION (Delegates to BarcodeService)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a single (full) label for a device.
 * DELEGATES to BarcodeService.renderLabelHTML().
 */
function generateSingleLabel(item, options = {}) {
  if (typeof BarcodeService !== 'undefined' && BarcodeService.renderLabelHTML) {
    return BarcodeService.renderLabelHTML(item, {
      labelProfile: 'FULL',
      showPrice: options.showPrice !== false,
      showShopName: true,
      type: 'device'
    });
  }

  // Fallback: log error and return empty div
  Logger.error('[BARCODE-GENERATOR] BarcodeService not available for generateSingleLabel!');
  const div = document.createElement('div');
  div.textContent = 'BarcodeService not loaded';
  return div;
}

/**
 * Generate a split label (2 barcodes per label).
 * DELEGATES to BarcodeService.renderLabelHTML().
 */
function generateSplitLabel(item, options = {}) {
  if (typeof BarcodeService !== 'undefined' && BarcodeService.renderLabelHTML) {
    return BarcodeService.renderLabelHTML(item, {
      labelProfile: 'SPLIT',
      showPrice: options.showPrice !== false,
      showShopName: false,
      type: options.type || 'device'
    });
  }

  Logger.error('[BARCODE-GENERATOR] BarcodeService not available for generateSplitLabel!');
  const div = document.createElement('div');
  div.textContent = 'BarcodeService not loaded';
  return div;
}

/**
 * Generate a single label for an accessory.
 * DELEGATES to BarcodeService.renderLabelHTML().
 */
function generateAccessorySingleLabel(item, options = {}) {
  if (typeof BarcodeService !== 'undefined' && BarcodeService.renderLabelHTML) {
    return BarcodeService.renderLabelHTML(item, {
      labelProfile: 'FULL',
      showPrice: options.showPrice !== false,
      showShopName: true,
      type: 'accessory'
    });
  }

  Logger.error('[BARCODE-GENERATOR] BarcodeService not available for generateAccessorySingleLabel!');
  const div = document.createElement('div');
  div.textContent = 'BarcodeService not loaded';
  return div;
}

/**
 * Generate a split label for an accessory.
 * DELEGATES to BarcodeService.renderLabelHTML().
 */
function generateAccessorySplitLabel(item, options = {}) {
  if (typeof BarcodeService !== 'undefined' && BarcodeService.renderLabelHTML) {
    return BarcodeService.renderLabelHTML(item, {
      labelProfile: 'SPLIT',
      showPrice: options.showPrice !== false,
      showShopName: false,
      type: 'accessory'
    });
  }

  Logger.error('[BARCODE-GENERATOR] BarcodeService not available for generateAccessorySplitLabel!');
  const div = document.createElement('div');
  div.textContent = 'BarcodeService not loaded';
  return div;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎁 WRAPPER FUNCTIONS FOR DEVICE/ACCESSORY LABELS
// ═══════════════════════════════════════════════════════════════════════════════

function generateDeviceBarcodeLabel(device, options = {}) {
  const { labelType = 'single', showPrice = true } = options;

  if (labelType === 'split') {
    return generateSplitLabel(device, { showPrice, type: 'device' });
  }
  return generateSingleLabel(device, { showPrice });
}

function generateAccessoryBarcodeLabel(accessory, options = {}) {
  const { labelType = 'single', showPrice = true } = options;

  if (labelType === 'split') {
    return generateAccessorySplitLabel(accessory, { showPrice });
  }
  return generateAccessorySingleLabel(accessory, { showPrice });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 SHORT CODE GENERATION & DATABASE SAVING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate and save a new short code for an item.
 * This handles database operations for assigning short codes to items.
 */
async function generateAndSaveShortCode(item, type = 'device') {
  if (!item || !item.id) {
    Logger.warn('[BARCODE] Cannot generate short_code: item or item.id is missing');
    return null;
  }

  // Check if item already has a valid short_code
  const existingCode = extractShortCode(item, type);
  if (existingCode && existingCode.length >= 4) {
    Logger.log(`[BARCODE] Item ${item.id} already has short_code: ${existingCode}`);
    return existingCode;
  }

  let newShortCode = null;

  try {
    if (type === 'device') {
      // Device short code generation (10000-19999 or legacy 1000-4999)
      const response = await fetch('elos-db://devices?action=list');
      if (!response.ok) {
        Logger.error('[BARCODE] Failed to fetch devices');
        return null;
      }

      const devices = await response.json();
      const usedCodes = new Set();

      devices.forEach(device => {
        if (device.short_code) {
          const num = parseInt(String(device.short_code).replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num)) {
            usedCodes.add(num);
          }
        }
      });

      // Find first available code (prefer new range 10000-19999)
      for (let code = 10000; code <= 19999; code++) {
        if (!usedCodes.has(code)) {
          newShortCode = String(code).padStart(5, '0');
          break;
        }
      }

      if (!newShortCode) {
        Logger.error('[BARCODE] Device code range exhausted (10000-19999)');
        return null;
      }

      // Save to database
      const saveResponse = await fetch(`elos-db://devices/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_code: newShortCode })
      });

      if (saveResponse.ok) {
        Logger.log(`[BARCODE] Saved new short_code ${newShortCode} to device ${item.id}`);
        item.short_code = newShortCode;
        return newShortCode;
      } else {
        Logger.error('[BARCODE] Failed to save device short_code');
        return null;
      }

    } else if (type === 'accessory') {
      // Accessory short code generation (50000-89999)
      const response = await fetch('elos-db://accessories?action=list');
      if (!response.ok) {
        Logger.error('[BARCODE] Failed to fetch accessories');
        return null;
      }

      const accessories = await response.json();
      const usedCodes = new Set();

      accessories.forEach(acc => {
        if (acc.short_code) {
          const num = parseInt(String(acc.short_code).replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num)) {
            usedCodes.add(num);
          }
        }
      });

      // Find first available code (50000-89999)
      for (let code = 50000; code <= 89999; code++) {
        if (!usedCodes.has(code)) {
          newShortCode = String(code).padStart(5, '0');
          break;
        }
      }

      if (!newShortCode) {
        Logger.error('[BARCODE] Accessory code range exhausted (50000-89999)');
        return null;
      }

      // Save to database
      const saveResponse = await fetch(`elos-db://accessories/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_code: newShortCode })
      });

      if (saveResponse.ok) {
        Logger.log(`[BARCODE] Saved new short_code ${newShortCode} to accessory ${item.id}`);
        item.short_code = newShortCode;
        return newShortCode;
      } else {
        Logger.error('[BARCODE] Failed to save accessory short_code');
        return null;
      }
    }
  } catch (error) {
    Logger.error('[BARCODE] Error in generateAndSaveShortCode:', error);
    return null;
  }

  return newShortCode;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🖨️ PRINT FUNCTIONS (Delegate to BarcodeService)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Print barcode labels for items.
 * DELEGATES to BarcodeService.printLabels().
 */
async function printBarcodeLabels(items, options = {}) {
  const {
    type = 'device',
    labelType = 'single',
    copies = 1,
    showPrice = true,
    skipShortCodeGeneration = false
  } = options;

  Logger.log('[BARCODE] printBarcodeLabels called:', {
    itemCount: Array.isArray(items) ? items.length : 1,
    type,
    labelType,
    copies
  });

  // Ensure items is an array
  const itemsArray = Array.isArray(items) ? items : [items];

  // Generate short codes if needed
  if (!skipShortCodeGeneration) {
    Logger.log('[BARCODE] Generating short codes before printing...');
    for (const item of itemsArray) {
      await generateAndSaveShortCode(item, type);
    }
  }

  // Delegate to BarcodeService
  if (typeof BarcodeService !== 'undefined' && BarcodeService.printLabels) {
    return BarcodeService.printLabels(itemsArray, {
      type,
      labelType,
      copies,
      showPrice,
      showShopName: true
    });
  }

  // Fallback if BarcodeService not available
  Logger.error('[BARCODE] BarcodeService.printLabels not available!');
}

function printDeviceBarcode(device, options = {}) {
  return printBarcodeLabels([device], { ...options, type: 'device' });
}

function printAccessoryBarcode(accessory, options = {}) {
  return printBarcodeLabels([accessory], { ...options, type: 'accessory' });
}

async function printMultipleBarcodes(items, options = {}) {
  return printBarcodeLabels(items, options);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 PREVIEW MODAL (UI Component)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Show the barcode preview modal.
 * This is the main UI entry point for barcode printing.
 */
function showBarcodePreviewModal(item, type = 'device') {
  Logger.log('[BARCODE] showBarcodePreviewModal called for:', item.id || item.name, 'type:', type);
  Logger.log('[BARCODE] Item data:', {
    id: item.id,
    short_code: item.short_code,
    barcode: item.barcode,
    code: item.code,
    model: item.model || item.name
  });

  // Remove any existing modal
  const existingModal = document.getElementById('barcodePreviewModal');
  if (existingModal) {
    Logger.log('[BARCODE] Removing existing modal');
    existingModal.remove();
  }

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'barcodePreviewModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.9); display: flex;
    align-items: center; justify-content: center; z-index: 10000;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: #1a1f2e; border-radius: 16px; padding: 0;
    max-width: 520px; width: 95%; direction: rtl;
    max-height: 90vh; display: flex; flex-direction: column;
  `;

  // Get code for preview
  const code = extractShortCode(item, type);

  // Get diagnostics for debug overlay
  let diagInfo = '';
  if (typeof BarcodeService !== 'undefined' && BarcodeService.getDiagnostics) {
    const diag = BarcodeService.getDiagnostics(code, 'FULL');
    diagInfo = `${diag.format} | ${diag.profile.moduleWidthPx}px module | ${diag.profile.marginPx}px margin`;
  }

  content.innerHTML = `
    <style>
      #copyCount::-webkit-outer-spin-button,
      #copyCount::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      #copyCount {
        -moz-appearance: textfield;
      }
      /* Custom scrollbar for modal body */
      #barcodeModalBody::-webkit-scrollbar {
        width: 8px;
      }
      #barcodeModalBody::-webkit-scrollbar-track {
        background: #1a1f2e;
        border-radius: 4px;
      }
      #barcodeModalBody::-webkit-scrollbar-thumb {
        background: #3b82f6;
        border-radius: 4px;
      }
      #barcodeModalBody::-webkit-scrollbar-thumb:hover {
        background: #2563eb;
      }
    </style>

    <!-- Modal Header - ثابت في الأعلى -->
    <div style="display:flex; justify-content:space-between; align-items:center; padding:20px 24px; border-bottom:1px solid #333; flex-shrink:0;">
      <h3 style="margin:0; color:#fff; font-size:18px;">🏷️ طباعة باركود</h3>
      <button id="closeModal" style="background:#f44; border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:16px;">&times;</button>
    </div>

    <!-- Modal Body - قابل للسكرول -->
    <div id="barcodeModalBody" style="flex:1; overflow-y:auto; padding:20px 24px; min-height:0;">
      <div id="previewArea" style="background:#fff; border-radius:10px; padding:30px 40px; display:flex; justify-content:center; align-items:center; margin-bottom:20px; min-height:140px; position:relative;"></div>

      <!-- Debug info (click to toggle) -->
      <div id="debugInfo" style="background:#000; color:#0f0; font-family:monospace; font-size:10px; padding:8px; border-radius:6px; margin-bottom:12px; display:none; cursor:pointer;">
        <strong>BarcodeService Debug:</strong><br>
        Code: ${code || 'N/A'}<br>
        ${diagInfo}
      </div>

      <div style="background:#111; padding:15px; border-radius:10px; margin-bottom:12px;">
        <div style="color:#888; font-size:12px; margin-bottom:10px;">نوع الملصق:</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <label id="opt-single" style="color:#fff; display:flex; flex-direction:column; align-items:center; gap:5px; padding:12px; background:#222; border-radius:8px; cursor:pointer; border:2px solid #3b82f6;">
            <input type="radio" name="labelType" value="single" checked style="display:none;">
            <span style="font-size:18px;">📄</span>
            <span style="font-weight:bold; font-size:13px;">عادي</span>
          </label>
          <label id="opt-split" style="color:#fff; display:flex; flex-direction:column; align-items:center; gap:5px; padding:12px; background:#222; border-radius:8px; cursor:pointer; border:2px solid transparent;">
            <input type="radio" name="labelType" value="split" style="display:none;">
            <span style="font-size:18px;">📋</span>
            <span style="font-weight:bold; font-size:13px;">مقسوم (2×)</span>
          </label>
        </div>
      </div>

      <div style="background:#111; padding:12px 15px; border-radius:10px; margin-bottom:12px;">
        <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
          <span style="color:#fff; font-size:14px;">💰 إظهار السعر</span>
          <input type="checkbox" id="showPriceCheck" checked style="width:20px; height:20px; accent-color:#22c55e;">
        </label>
      </div>

      <div style="background:#111; padding:12px 15px; border-radius:10px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span style="color:#fff; font-size:14px;">📦 عدد النسخ</span>
          <div style="display:flex; align-items:center; gap:10px;">
            <button id="copyMinus" style="width:32px; height:32px; border:none; border-radius:6px; background:#333; color:#fff; font-size:18px; cursor:pointer;">−</button>
            <input type="text" id="copyCount" value="1" style="width:50px; height:32px; text-align:center; border:1px solid #444; border-radius:6px; background:#222; color:#fff; font-size:14px; -moz-appearance:textfield;" inputmode="numeric" pattern="[0-9]*">
            <button id="copyPlus" style="width:32px; height:32px; border:none; border-radius:6px; background:#333; color:#fff; font-size:18px; cursor:pointer;">+</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Footer - ثابت في الأسفل -->
    <div style="display:flex; gap:12px; justify-content:center; padding:16px 24px; border-top:1px solid #333; flex-shrink:0; background:#1a1f2e;">
      <button id="printBtn" style="flex:1; padding:14px 30px; background:linear-gradient(135deg, #3b82f6, #2563eb); color:white; border:none; border-radius:10px; font-size:16px; font-weight:bold; cursor:pointer; font-family:'Cairo', sans-serif;">
        🖨️ طباعة
      </button>
      <button id="cancelBtn" style="padding:14px 30px; background:#374151; color:white; border:none; border-radius:10px; font-size:16px; cursor:pointer; font-family:'Cairo', sans-serif;">
        إلغاء
      </button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Get references to elements
  const previewArea = document.getElementById('previewArea');
  const debugInfo = document.getElementById('debugInfo');
  const optSingle = document.getElementById('opt-single');
  const optSplit = document.getElementById('opt-split');
  const showPriceCheck = document.getElementById('showPriceCheck');
  const copyCount = document.getElementById('copyCount');
  const copyMinus = document.getElementById('copyMinus');
  const copyPlus = document.getElementById('copyPlus');

  // Load saved settings
  try {
    const savedSettings = JSON.parse(localStorage.getItem('barcodeSettings') || '{}');
    if (savedSettings.labelType === 'split') {
      optSplit.querySelector('input').checked = true;
      optSingle.style.borderColor = 'transparent';
      optSplit.style.borderColor = '#3b82f6';
    }
    if (savedSettings.showPrice === false) {
      showPriceCheck.checked = false;
    }
    if (savedSettings.copies) {
      copyCount.value = savedSettings.copies;
    }
  } catch (e) {
    Logger.warn('[BARCODE] Could not load saved settings:', e);
  }

  // Update preview function
  const updatePreview = () => {
    const labelType = optSplit.querySelector('input').checked ? 'split' : 'single';
    const showPrice = showPriceCheck.checked;

    // Generate label using BarcodeService
    let label;
    if (typeof BarcodeService !== 'undefined' && BarcodeService.renderLabelHTML) {
      label = BarcodeService.renderLabelHTML(item, {
        labelProfile: labelType === 'split' ? 'SPLIT' : 'FULL',
        showPrice,
        showShopName: true,
        type
      });
    } else {
      // Fallback
      label = type === 'device'
        ? generateDeviceBarcodeLabel(item, { labelType, showPrice })
        : generateAccessoryBarcodeLabel(item, { labelType, showPrice });
    }

    previewArea.innerHTML = '';
    if (typeof label === 'string') {
      previewArea.innerHTML = label;
    } else {
      previewArea.appendChild(label);
    }

    // Save settings
    try {
      localStorage.setItem('barcodeSettings', JSON.stringify({
        labelType,
        showPrice,
        copies: parseInt(copyCount.value) || 1
      }));
    } catch (e) {
      Logger.warn('[BARCODE] Could not save settings:', e);
    }
  };

  // Initial preview
  updatePreview();

  // Event listeners
  optSingle.onclick = () => {
    optSingle.querySelector('input').checked = true;
    optSplit.querySelector('input').checked = false;
    optSingle.style.borderColor = '#3b82f6';
    optSplit.style.borderColor = 'transparent';
    updatePreview();
  };

  optSplit.onclick = () => {
    optSplit.querySelector('input').checked = true;
    optSingle.querySelector('input').checked = false;
    optSplit.style.borderColor = '#3b82f6';
    optSingle.style.borderColor = 'transparent';
    updatePreview();
  };

  showPriceCheck.onchange = updatePreview;

  copyMinus.onclick = () => {
    const val = parseInt(copyCount.value) || 1;
    if (val > 1) {
      copyCount.value = val - 1;
    }
  };

  copyPlus.onclick = () => {
    const val = parseInt(copyCount.value) || 1;
    if (val < 100) {
      copyCount.value = val + 1;
    }
  };

  // Toggle debug info on preview area double-click
  previewArea.ondblclick = () => {
    debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
  };

  // Close modal
  const closeModal = () => modal.remove();
  document.getElementById('closeModal').onclick = closeModal;
  document.getElementById('cancelBtn').onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  // Print button
  document.getElementById('printBtn').onclick = async () => {
    const labelType = optSplit.querySelector('input').checked ? 'split' : 'single';
    const showPrice = showPriceCheck.checked;
    const copies = parseInt(copyCount.value) || 1;

    Logger.log('[BARCODE] Print clicked:', { labelType, showPrice, copies, type });

    // Close modal first
    closeModal();

    // Print using printBarcodeLabels (which delegates to BarcodeService)
    await printBarcodeLabels([item], {
      type,
      labelType,
      copies,
      showPrice,
      skipShortCodeGeneration: false
    });
  };

  // Keyboard shortcuts
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleKeydown);
    } else if (e.key === 'Enter') {
      document.getElementById('printBtn').click();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 BARCODE GENERATOR OBJECT (Global Export)
// ═══════════════════════════════════════════════════════════════════════════════

const BarcodeGenerator = {
  // Version
  VERSION: '18.0.0',

  // Core functions (delegate to BarcodeService)
  generateBarcodeSVG,
  generateCode128SVG,
  extractShortCode,
  getBarcodeType,

  // Label generation
  generateSingleLabel,
  generateSplitLabel,
  generateAccessorySingleLabel,
  generateAccessorySplitLabel,
  generateDeviceBarcodeLabel,
  generateAccessoryBarcodeLabel,

  // Short code management
  generateAndSaveShortCode,

  // Print functions
  printBarcodeLabels,
  printDeviceBarcode,
  printAccessoryBarcode,
  printMultipleBarcodes,

  // UI
  showBarcodePreviewModal,

  // Utilities
  getShopName,
  formatPrice,
  calculateEAN13CheckDigit,
  generateEAN13Code,
  parseEAN13Code,

  // Constants
  BARCODE_RANGES,
  EAN13_PREFIXES
};

// Global export
window.BarcodeGenerator = BarcodeGenerator;

// Also expose individual functions globally for backward compatibility
window.showBarcodePreviewModal = showBarcodePreviewModal;
window.printBarcodeLabels = printBarcodeLabels;
window.printDeviceBarcode = printDeviceBarcode;
window.printAccessoryBarcode = printAccessoryBarcode;
window.generateBarcodeSVG = generateBarcodeSVG;
window.generateCode128SVG = generateCode128SVG;
window.extractShortCode = extractShortCode;
window.generateAndSaveShortCode = generateAndSaveShortCode;

// Log initialization
Logger.log(`[BARCODE-GENERATOR] BarcodeGenerator v${BarcodeGenerator.VERSION} initialized`);
Logger.log('[BARCODE-GENERATOR] Delegating rendering to BarcodeService');
