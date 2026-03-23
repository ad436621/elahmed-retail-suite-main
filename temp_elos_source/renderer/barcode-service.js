// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ ELOS UNIFIED BARCODE SERVICE V6.0 - Thermal-Safe Barcode Pipeline
// ═══════════════════════════════════════════════════════════════════════════════
//
// 📋 PURPOSE:
// This is the SINGLE SOURCE OF TRUTH for all barcode operations in the application.
// Both Inventory and POS print flows MUST delegate to this service.
//
// 🔧 KEY FEATURES:
// - Unified barcode format decision (CODE128 vs EAN-13)
// - Thermal-safe rendering for 203 DPI printers (XPrinter 233B)
// - Centralized printer profiles (FULL 38×25mm, SPLIT 38×12mm)
// - Guaranteed quiet zones and module widths for reliable scanning
// - NO CSS scaling - pixel-perfect output only
//
// 🔒 BARCODE POLICY (STRICT):
// - 4-6 digits (numeric only): CODE128 with thermal-safe settings
// - 12 digits: Calculate check digit → EAN-13
// - 13 digits: Validate check digit → EAN-13 if valid, CODE128 + warning if invalid
// - Other: CODE128 fallback
//
// 🖨️ THERMAL PRINTING REQUIREMENTS (203 DPI):
// - Module width: >= 2.4px (ensures bars print cleanly)
// - Quiet zone: >= 10 modules (prevents edge clipping)
// - Bar height: FULL >= 32px, SPLIT >= 20px
// - Background: MUST be white (#FFFFFF), never transparent
// - Bars: Pure black (#000000) with crisp edges
// - NO CSS max-width scaling - renders at exact pixel size
//
// ═══════════════════════════════════════════════════════════════════════════════

// Logger fallback - safe usage without conflicts
(function() {
  if (typeof window.Logger === 'undefined') {
    window.Logger = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      debug: () => {},
      info: console.info
    };
  }
})();
var Logger = window.Logger;

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 BARCODE SERVICE V6.0 - Unified Thermal-Safe Barcode System
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const BarcodeService = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // 📊 VERSION & METADATA
  // ═══════════════════════════════════════════════════════════════════════════════
  VERSION: '6.0.0',
  BUILD_DATE: '2026-01-09',

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🖨️ PRINTER PROFILES (XPrinter 233B @ 203 DPI)
  // ═══════════════════════════════════════════════════════════════════════════════
  //
  // WHY THESE VALUES:
  // - 203 DPI = 8 dots per mm
  // - 38mm width = 304 dots ≈ 144px at typical browser/print scaling
  // - Module width of 2.4px ensures thermal head can reliably print each bar
  // - Quiet zones of 10+ modules prevent scanner edge detection issues
  // - Heights chosen to fit label while maintaining scan reliability
  //
  PRINTER_PROFILES: {
    // Full label: 38×25mm - IMPROVED VERSION with larger fonts and better space utilization
    FULL: {
      name: 'FULL',
      description: '38×25mm full label',
      labelWidthMM: 38,
      labelHeightMM: 25,
      labelWidthPx: 140,      // Slightly smaller to ensure fit
      labelHeightPx: 90,      // Slightly smaller to ensure fit
      barcodeWidthPx: 100,    // Reduced to fit long codes (12 digits)
      barcodeHeightPx: 26,    // Slightly smaller barcode height
      moduleWidthPx: 1.2,     // Thinner bars for long codes (CODE128 12-digit)
      marginPx: 4,            // Smaller quiet zone
      fontSize: 9,            // Increased barcode text (was 7)
      textMarginPx: 1,        // Gap between bars and text
      shopNameSize: 10,       // Increased shop name font (was 7)
      productSize: 11,        // Increased product info font (was 7) - CRITICAL for readability
      priceSize: 10,          // Increased price font (was 7)
      padding: 2              // Slightly increased padding (was 1)
    },
    // Split label: 38×12mm (half height, 2 labels per physical label)
    SPLIT: {
      name: 'SPLIT',
      description: '38×12mm split label (2 per label)',
      labelWidthMM: 38,
      labelHeightMM: 12,
      labelWidthPx: 140,      // Same width as FULL
      labelHeightPx: 44,      // Half of FULL height
      barcodeWidthPx: 100,    // Reduced to fit long codes
      barcodeHeightPx: 20,    // Smaller for split
      moduleWidthPx: 1.2,     // Thinner bars for long codes
      marginPx: 3,            // Minimal quiet zone
      fontSize: 8,            // Increased font for compact label (was 6)
      textMarginPx: 1,
      shopNameSize: 7,        // Increased shop name (was 5)
      infoSize: 8,            // Increased product info font (was 6)
      priceSize: 7,           // Increased price (was 5)
      padding: 1
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📏 BARCODE FORMAT DECISION TABLE
  // ═══════════════════════════════════════════════════════════════════════════════
  //
  // | Length | Content     | Action                                    | Format  |
  // |--------|-------------|-------------------------------------------|---------|
  // | 4-6    | Numeric     | Use CODE128 (thermal-safe settings)       | CODE128 |
  // | 12     | Numeric     | Calculate check digit, generate EAN-13    | EAN13   |
  // | 13     | Numeric     | Validate check digit                      | EAN13/CODE128 |
  // | Other  | Any         | Fallback to CODE128                       | CODE128 |
  //
  BARCODE_RANGES: {
    device: { min: 10000, max: 19999, digits: 5 },
    device_legacy: { min: 1000, max: 4999, digits: 4 },
    accessory: { min: 50000, max: 89999, digits: 5 },
    accessory_legacy: { min: 100000, max: 999999, digits: 6 }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔧 CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════════
  config: {
    // Printer settings
    printer: {
      name: 'XPrinter 233B',
      dpi: 203
    },
    // Barcode generation defaults
    generation: {
      startFrom: 1000000001,
      prefix: '',
      suffix: '',
      length: 10,
      type: 'numeric'
    },
    // EAN-13 prefixes for legacy support
    ean13: {
      prefixes: {
        device: '2',
        accessory: '3',
        repair: '4'
      }
    },
    // Device barcode ranges (short codes)
    devices: {
      enabled: true,
      minCode: 10000,
      maxCode: 19999,
      legacyMinCode: 1000,
      legacyMaxCode: 4999,
      format: 'NUMERIC',
      autoGenerate: true
    },
    // Accessory barcode ranges (short codes)
    accessories: {
      enabled: true,
      minCode: 50000,
      maxCode: 89999,
      legacyMinCode: 100000,
      legacyMaxCode: 999999,
      format: 'NUMERIC',
      autoGenerate: true
    },
    // Printing defaults
    printing: {
      defaultCopies: 1,
      defaultLabelType: 'single',
      showPrice: true,
      showShopName: true
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 CORE API: getPrintableCode(item, options)
  // ═══════════════════════════════════════════════════════════════════════════════
  /**
   * Extract the best barcode to print from an item.
   * Priority: short_code > barcode > code
   *
   * @param {Object} item - The item (device, accessory, etc.)
   * @param {Object} options - { type: 'device'|'accessory', preferShort: true }
   * @returns {String} The barcode string to use for printing
   */
  getPrintableCode(item, options = {}) {
    if (!item) return '';

    const { type = 'device', preferShort = true } = options;

    // Determine expected digit count based on type
    // النظام الموحد: أجهزة 100000-499999 (6 أرقام)، إكسسوارات 500000-899999 (6 أرقام)
    const isAccessory = type === 'accessory';
    const expectedDigits = 6; // New unified system uses 6 digits

    // Regex patterns for validation - support both old (4-5 digit) and new (6 digit) formats
    const shortCodeRegex = isAccessory ? /^\d{4,6}$/ : /^\d{4,6}$/;

    // Priority 1: short_code
    if (item.short_code) {
      const rawCode = String(item.short_code).trim();

      // Handle legacy DV format - return as-is for POS scanning compatibility
      if (/^DV\d{6}$/i.test(rawCode)) {
        Logger.debug(`[BARCODE] Using DV short_code: ${rawCode}`);
        return rawCode.toUpperCase();
      }

      const cleaned = rawCode.replace(/[^0-9]/g, '');
      if (cleaned.length > 0 && shortCodeRegex.test(cleaned)) {
        Logger.debug(`[BARCODE] Using short_code: ${cleaned}`);
        return cleaned;
      }
      // Pad if too short
      if (cleaned.length > 0 && cleaned.length < expectedDigits) {
        const padded = cleaned.padStart(expectedDigits, '0');
        if (shortCodeRegex.test(padded)) {
          Logger.debug(`[BARCODE] Using padded short_code: ${padded}`);
          return padded;
        }
      }
    }

    // Priority 2: barcode
    if (item.barcode) {
      const cleaned = String(item.barcode).replace(/[^0-9]/g, '').trim();
      if (cleaned.length > 0) {
        // If it matches short code pattern, use it
        if (shortCodeRegex.test(cleaned)) {
          Logger.debug(`[BARCODE] Using barcode as short: ${cleaned}`);
          return cleaned;
        }
        // For legacy EAN-13 or other long codes, use as-is
        if (cleaned.length >= 4) {
          Logger.debug(`[BARCODE] Using barcode: ${cleaned}`);
          return cleaned;
        }
      }
    }

    // Priority 3: code
    if (item.code) {
      const cleaned = String(item.code).replace(/[^0-9]/g, '').trim();
      if (cleaned.length > 0) {
        if (shortCodeRegex.test(cleaned)) {
          Logger.debug(`[BARCODE] Using code as short: ${cleaned}`);
          return cleaned;
        }
        if (cleaned.length >= 4) {
          Logger.debug(`[BARCODE] Using code: ${cleaned}`);
          return cleaned;
        }
      }
    }

    // Priority 4: imei (for repairs/tickets - may be alphanumeric like R-202601-000008)
    if (item.imei) {
      // For repair tickets, clean and use the numeric part
      const cleaned = String(item.imei).replace(/[^0-9]/g, '').trim();
      if (cleaned.length >= 4) {
        Logger.debug(`[BARCODE] Using imei: ${cleaned}`);
        return cleaned;
      }
    }

    Logger.warn(`[BARCODE] No valid code found for item:`, item.id || item.name || item);
    return '';
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 CORE API: decideFormat(code)
  // ═══════════════════════════════════════════════════════════════════════════════
  /**
   * Decide the optimal barcode format based on code content.
   * Implements the strict policy from the decision table.
   *
   * @param {String} code - The barcode string
   * @returns {Object} { format: 'CODE128'|'EAN13', normalizedCode: String, notes: String[] }
   */
  decideFormat(code) {
    const result = {
      format: 'CODE128',
      normalizedCode: '',
      notes: [],
      isValid: false
    };

    if (!code) {
      result.notes.push('Empty code provided');
      return result;
    }

    // Clean the code - only digits
    const cleanCode = String(code).replace(/[^0-9]/g, '').trim();

    if (!cleanCode || cleanCode.length === 0) {
      result.notes.push('No numeric content in code');
      return result;
    }

    result.normalizedCode = cleanCode;
    result.isValid = true;

    const len = cleanCode.length;

    // POLICY: 4-6 digit numeric codes → CODE128 (thermal-safe)
    if (len >= 4 && len <= 6 && /^\d+$/.test(cleanCode)) {
      result.format = 'CODE128';
      result.notes.push(`Short numeric code (${len} digits): using CODE128 for thermal reliability`);
      return result;
    }

    // POLICY: 12 digits → Use CODE128 for thermal reliability (EAN-13 often doesn't scan well)
    // Previously used EAN-13 but thermal printers have issues with it
    if (len === 12 && /^\d+$/.test(cleanCode)) {
      result.format = 'CODE128';
      result.notes.push(`12-digit code: using CODE128 for thermal reliability`);
      return result;
    }

    // POLICY: 13 digits → Validate check digit
    if (len === 13 && /^\d+$/.test(cleanCode)) {
      const code12 = cleanCode.substring(0, 12);
      const providedCheck = parseInt(cleanCode[12], 10);
      const calculatedCheck = this.calculateEAN13CheckDigit(code12);

      if (providedCheck === calculatedCheck) {
        result.format = 'EAN13';
        result.notes.push(`13-digit code: valid EAN-13 (check digit ${providedCheck} correct)`);
      } else {
        // POLICY: Invalid check digit → fallback to CODE128 + warning
        result.format = 'CODE128';
        result.notes.push(`⚠️ 13-digit code: INVALID EAN-13 check digit (expected ${calculatedCheck}, got ${providedCheck}). Using CODE128 fallback.`);
        Logger.warn(`[BARCODE] EAN-13 check digit mismatch for ${cleanCode}: expected ${calculatedCheck}, got ${providedCheck}`);
      }
      return result;
    }

    // POLICY: All other cases → CODE128 fallback
    result.format = 'CODE128';
    result.notes.push(`${len}-digit code: using CODE128 (default fallback)`);
    return result;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 CORE API: renderBarcodeSVG(code, options)
  // ═══════════════════════════════════════════════════════════════════════════════
  /**
   * Render a thermal-safe barcode SVG.
   * Uses JsBarcode with carefully tuned settings for 203 DPI thermal printers.
   *
   * CRITICAL THERMAL PRINTING REQUIREMENTS:
   * - White background (not transparent) - thermal paper is white
   * - Black bars (#000000) with crisp edges
   * - Module width >= 2.4px for thermal head resolution
   * - Quiet zone >= 10 modules to prevent edge clipping
   * - NO CSS scaling - exact pixel output
   *
   * @param {String} code - The barcode string
   * @param {Object} options - { labelProfile: 'FULL'|'SPLIT', showText: true }
   * @returns {String} SVG string
   */
  renderBarcodeSVG(code, options = {}) {
    const { labelProfile = 'FULL', showText = true } = options;
    const profile = this.PRINTER_PROFILES[labelProfile] || this.PRINTER_PROFILES.FULL;

    // Decide format
    const decision = this.decideFormat(code);
    if (!decision.isValid) {
      Logger.error('[BARCODE] Cannot render invalid code:', code, decision.notes);
      return this._createErrorSVG('Invalid Code', profile.barcodeWidthPx, profile.barcodeHeightPx);
    }

    const codeToRender = decision.normalizedCode;
    const format = decision.format;

    Logger.log(`[BARCODE] Rendering ${format}: "${codeToRender}" (profile: ${labelProfile})`);
    decision.notes.forEach(note => Logger.debug(`[BARCODE] ${note}`));

    // Check JsBarcode availability
    if (typeof JsBarcode === 'undefined') {
      Logger.error('[BARCODE] CRITICAL: JsBarcode library not loaded!');
      return this._createErrorSVG('JsBarcode Missing', profile.barcodeWidthPx, profile.barcodeHeightPx);
    }

    // Create temporary SVG element
    const svgNS = "http://www.w3.org/2000/svg";
    const tempSvg = document.createElementNS(svgNS, "svg");

    try {
      // ═══════════════════════════════════════════════════════════════
      // 🔥 THERMAL-SAFE JSBARCODE OPTIONS
      // ═══════════════════════════════════════════════════════════════
      // These values are CRITICAL for reliable scanning on budget scanners
      // with thermal-printed labels at 203 DPI.
      //
      // width: Module width in pixels. 2.4px is the minimum safe value.
      //        Lower values cause bars to merge on thermal printers.
      //
      // height: Bar height. Must be >= 20px for reliable scanning.
      //         Higher is better, but constrained by label size.
      //
      // margin: Quiet zone in pixels. MUST be >= 10 modules.
      //         Scanners need clear space to detect barcode edges.
      //
      // background: MUST be white (#ffffff), never transparent.
      //             Thermal paper is white; transparent causes issues.
      //
      // lineColor: MUST be pure black (#000000) for maximum contrast.
      //
      // flat: true - No rounded corners. Crisp thermal edges only.
      //
      const jsOptions = {
        format: format,
        width: profile.moduleWidthPx,
        height: profile.barcodeHeightPx,
        displayValue: showText,
        fontSize: profile.fontSize,
        textMargin: profile.textMarginPx,
        margin: profile.marginPx,
        background: "#ffffff",     // THERMAL-SAFE: explicit white background
        lineColor: "#000000",      // THERMAL-SAFE: pure black bars
        textPosition: "bottom",
        textAlign: "center",
        flat: true                 // THERMAL-SAFE: no rounded corners
      };

      JsBarcode(tempSvg, codeToRender, jsOptions);

      // ═══════════════════════════════════════════════════════════════
      // 🔧 POST-PROCESSING: Ensure thermal-safe attributes
      // ═══════════════════════════════════════════════════════════════
      // JsBarcode generates correct SVG, but we reinforce attributes
      // to prevent any CSS or external interference.

      // Ensure SVG has explicit dimensions (no CSS scaling!)
      const svgWidth = tempSvg.getAttribute('width');
      const svgHeight = tempSvg.getAttribute('height');

      // Add data attributes for QA/debugging
      tempSvg.setAttribute('data-barcode-service', 'v6.0');
      tempSvg.setAttribute('data-format', format);
      tempSvg.setAttribute('data-code', codeToRender);
      tempSvg.setAttribute('data-profile', labelProfile);
      tempSvg.setAttribute('data-module-width', profile.moduleWidthPx);
      tempSvg.setAttribute('data-margin', profile.marginPx);

      // Ensure all rect elements (bars) have explicit black fill
      // This prevents CSS from overriding bar colors
      const bars = tempSvg.querySelectorAll('rect');
      bars.forEach((rect, idx) => {
        const fill = rect.getAttribute('fill');
        // Only modify bar rects (black), not background rect (white)
        if (fill === '#000000' || fill === '#000' || fill === 'black') {
          rect.setAttribute('fill', '#000000');
          rect.setAttribute('fill-opacity', '1');
          // DO NOT add stroke to bars - it can widen them and affect scanning
        }
        // Ensure background rect stays white
        if (fill === '#ffffff' || fill === '#fff' || fill === 'white') {
          rect.setAttribute('fill', '#ffffff');
          rect.setAttribute('fill-opacity', '1');
        }
      });

      // Ensure text is black
      const texts = tempSvg.querySelectorAll('text');
      texts.forEach(text => {
        text.setAttribute('fill', '#000000');
      });

      // Get final SVG string
      let svgContent = tempSvg.outerHTML;

      // Validate output
      if (!svgContent || typeof svgContent !== 'string' || svgContent.length < 50) {
        Logger.error('[BARCODE] SVG generation produced invalid output');
        return this._createErrorSVG('SVG Error', profile.barcodeWidthPx, profile.barcodeHeightPx);
      }

      Logger.debug(`[BARCODE] Generated SVG: ${svgWidth}x${svgHeight}px, format=${format}`);
      return svgContent;

    } catch (error) {
      Logger.error('[BARCODE] JsBarcode error:', error);
      return this._createErrorSVG(error.message || 'Render Error', profile.barcodeWidthPx, profile.barcodeHeightPx);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 CORE API: renderLabelHTML(item, options)
  // ═══════════════════════════════════════════════════════════════════════════════
  /**
   * Render a complete label with barcode, product info, and optional price.
   *
   * @param {Object} item - The item to create a label for
   * @param {Object} options - { labelProfile, showPrice, showShopName, type }
   * @returns {HTMLElement|String} The label element or HTML string
   */
  renderLabelHTML(item, options = {}) {
    const {
      labelProfile = 'FULL',
      showShopName = true,
      type = 'device',
      returnString = false
    } = options;
    
    // CRITICAL FIX: Don't use default value for showPrice in destructuring
    // This ensures that false values are respected
    const showPrice = options.showPrice !== undefined ? Boolean(options.showPrice) : true;
    Logger.log('[BARCODE] renderLabelHTML - options.showPrice:', options.showPrice, 'final showPrice:', showPrice, 'labelProfile:', labelProfile);

    const profile = this.PRINTER_PROFILES[labelProfile] || this.PRINTER_PROFILES.FULL;
    const isSplit = labelProfile === 'SPLIT';

    if (isSplit) {
      Logger.log('[BARCODE] renderLabelHTML - Rendering SPLIT label with showPrice:', showPrice);
      return this._renderSplitLabel(item, { ...options, showPrice, profile });
    }

    Logger.log('[BARCODE] renderLabelHTML - Rendering FULL label with showPrice:', showPrice);
    return this._renderFullLabel(item, { ...options, showPrice, profile });
  },

  /**
   * Render a full-size label (38×25mm)
   * @private
   */
  _renderFullLabel(item, options) {
    const { profile, showShopName = true, type = 'device', returnString = false } = options;
    // CRITICAL FIX: Explicitly check showPrice - don't use default value in destructuring
    // If showPrice is explicitly false, respect it. Otherwise default to true.
    // This ensures the checkbox in the modal works correctly
    const showPrice = options.showPrice !== undefined ? Boolean(options.showPrice) : true;
    Logger.log('[BARCODE] _renderFullLabel - showPrice from options:', options.showPrice, 'final showPrice:', showPrice, 'price:', item.expected_price || item.sale_price || item.price);

    const shopName = showShopName ? this.getShopName() : '';
    const code = this.getPrintableCode(item, { type });
    // Generate barcode WITHOUT text - we'll add code + battery manually below
    const barcodeSVG = code ? this.renderBarcodeSVG(code, { labelProfile: 'FULL', showText: false }) : '';

    // Extract item properties
    const model = item.model || item.name || item.type || '';
    const storage = item.storage || '';
    const color = item.color || '';
    const ram = item.ram || '';

    // Determine device type for conditional display
    const deviceType = (item.type || '').toLowerCase();
    const isAppleDevice = deviceType.includes('apple') || deviceType.includes('iphone') || deviceType.includes('ipad') || deviceType.includes('ابل') || deviceType.includes('ايفون') || deviceType.includes('ايباد');

    // Battery only shown for Apple devices (iPhone, iPad, etc.)
    // FIX: battery_health can be 0, so check for undefined/null explicitly
    let battery = null;
    if (isAppleDevice) {
      if (item.battery_health !== undefined && item.battery_health !== null && item.battery_health !== '') {
        battery = item.battery_health;
      } else if (item.battery !== undefined && item.battery !== null && item.battery !== '') {
        battery = item.battery;
      }
    }
    const price = item.expected_price || item.sale_price || item.price || 0;
    const condition = item.condition || '';

    // Build product text based on device type:
    // Apple devices: Model + Storage + Color (Battery shown next to barcode number)
    // Android/Other: Model + Storage + Color (RAM shown next to barcode number)
    // NOTE: RAM is displayed next to barcode number, not in product text
    const productParts = [model, storage, color].filter(Boolean);
    const productText = productParts.join(' | ');

    // Create label element
    const label = document.createElement('div');
    label.className = 'barcode-label barcode-label-single barcode-label-thermal-safe';

    // CRITICAL: Use exact pixel dimensions, overflow HIDDEN to prevent spilling
    // IMPROVED: Better space utilization with tighter spacing
    label.style.cssText = `
      width: ${profile.labelWidthPx}px;
      height: ${profile.labelHeightPx}px;
      max-width: ${profile.labelWidthPx}px;
      max-height: ${profile.labelHeightPx}px;
      background: #ffffff;
      padding: ${profile.padding}px;
      font-family: Arial, sans-serif;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
      color: #000000;
      gap: 2px;
    `;

    // Header: Shop name + Price - IMPROVED: Price next to shop name (like split label)
    if (shopName || showPrice) {
      const header = document.createElement('div');
      header.style.cssText = `
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 4px;
        font-size: ${profile.shopNameSize}px;
        font-weight: bold;
        color: #000000;
        border-bottom: 1px solid #000000;
        padding-bottom: 2px;
        margin-bottom: 3px;
        flex-shrink: 0;
        line-height: 1.2;
        overflow: hidden;
      `;
      
      // Left: Shop name - IMPROVED: Prevent overflow
      if (shopName) {
        const shopNameSpan = document.createElement('span');
        shopNameSpan.style.cssText = `
          text-align: right;
          direction: rtl;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        `;
        shopNameSpan.textContent = shopName;
        header.appendChild(shopNameSpan);
      } else {
        // Empty span to push price to the right if no shop name
        const emptySpan = document.createElement('span');
        emptySpan.style.cssText = 'flex: 1;';
        header.appendChild(emptySpan);
      }
      
      // Right: Price (if showPrice is true)
      if (showPrice) {
        const priceSpan = document.createElement('span');
        priceSpan.style.cssText = `
          font-size: ${profile.priceSize}px;
          font-weight: bold;
          border: 1px solid #000000;
          padding: 1px 3px;
          background: #ffffff;
          color: #000000;
          white-space: nowrap;
          direction: ltr;
          flex-shrink: 0;
        `;
        const displayPrice = price > 0 ? price : 0;
        priceSpan.textContent = this.formatPrice(displayPrice);
        header.appendChild(priceSpan);
      }
      label.appendChild(header);
    }

    // Barcode container - IMPROVED: More compact spacing
    const barcodeDiv = document.createElement('div');
    barcodeDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      flex-shrink: 0;
      width: 100%;
      overflow: visible;
      background: #ffffff;
      margin: 2px 0;
    `;

    if (barcodeSVG) {
      barcodeDiv.innerHTML = barcodeSVG;

      // Add code + battery text below barcode bars
      const barcodeTextDiv = document.createElement('div');
      barcodeTextDiv.style.cssText = `
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
        font-size: ${profile.fontSize}px;
        font-weight: bold;
        color: #000000;
        margin-top: 1px;
      `;

      // Code number
      const codeSpan = document.createElement('span');
      codeSpan.style.cssText = 'font-family: monospace; direction: ltr;';
      codeSpan.textContent = code;
      barcodeTextDiv.appendChild(codeSpan);

      // For Apple: Show Battery percentage
      // For Android/Others: Show RAM
      // NOTE: No emojis - thermal printers don't render them properly
      if (isAppleDevice) {
        if (battery !== null) {
          const batterySpan = document.createElement('span');
          batterySpan.style.cssText = 'direction: ltr;';
          batterySpan.textContent = `B:${battery}%`;
          barcodeTextDiv.appendChild(batterySpan);
        }
      } else {
        // Android/Others: Show RAM next to barcode
        if (ram) {
          const ramSpan = document.createElement('span');
          ramSpan.style.cssText = 'direction: ltr;';
          ramSpan.textContent = `RAM:${ram}`;
          barcodeTextDiv.appendChild(ramSpan);
        }
      }

      barcodeDiv.appendChild(barcodeTextDiv);
    } else {
      barcodeDiv.innerHTML = `<span style="color:#999;font-size:10px;">No barcode</span>`;
    }
    label.appendChild(barcodeDiv);

    // Product info - Model + Storage
    if (productText) {
      const productDiv = document.createElement('div');
      productDiv.style.cssText = `
        width: 100%;
        text-align: center;
        font-size: ${profile.productSize}px;
        font-weight: bold;
        color: #000000;
        direction: rtl;
        flex-shrink: 0;
        line-height: 1.3;
        padding: 1px 0;
        word-wrap: break-word;
        overflow-wrap: break-word;
      `;
      productDiv.textContent = productText;
      label.appendChild(productDiv);
    }


    return returnString ? label.outerHTML : label;
  },

  /**
   * Render split label - TWO barcodes on ONE 38×25mm sticker
   * The sticker is divided into top half and bottom half
   * @private
   */
  _renderSplitLabel(item, options) {
    const { profile, type = 'device', returnString = false, showPrice = false } = options;
    const fullProfile = this.PRINTER_PROFILES.FULL;

    const code = this.getPrintableCode(item, { type });
    const barcodeSVG = code ? this.renderBarcodeSVG(code, { labelProfile: 'SPLIT', showText: true }) : '';

    // Extract item properties for display
    const model = item.model || item.name || item.type || '';
    const storage = item.storage || '';
    const color = item.color || '';
    const ram = item.ram || '';
    const price = item.expected_price || item.sale_price || item.price || 0;

    // Determine device type for conditional display
    const deviceType = (item.type || '').toLowerCase();
    const isAppleDevice = deviceType.includes('apple') || deviceType.includes('iphone') || deviceType.includes('ipad') || deviceType.includes('ابل') || deviceType.includes('ايفون') || deviceType.includes('ايباد');

    // Battery only for Apple devices
    const battery = isAppleDevice ? (item.battery_health || item.battery || '') : '';

    // Build compact product text based on device type:
    // Apple: Model Storage Color B:Battery%
    // Android/Other: Model Storage Color (RAM shown next to barcode number in Full label)
    // NOTE: No emojis - thermal printers don't render them properly
    let productText;
    if (isAppleDevice) {
      // Apple: Model + Storage + Color + Battery
      productText = [model, storage, color].filter(Boolean).join(' ');
      if (battery) {
        productText += ` B:${battery}%`;
      }
    } else {
      // Android/Other: Model + Storage + Color (RAM is in Full label next to barcode)
      productText = [model, storage, color].filter(Boolean).join(' ');
    }
    productText = productText.substring(0, 30); // Allow more chars for additional info

    // Height for each half (full label height / 2)
    const halfHeight = Math.floor(fullProfile.labelHeightPx / 2);

    // Create a half section (barcode + product name)
    const createHalfSection = () => {
      const half = document.createElement('div');
      half.style.cssText = `
        width: 100%;
        height: ${halfHeight}px;
        max-height: ${halfHeight}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: #ffffff;
        box-sizing: border-box;
        padding: 1px;
      `;

      // Product name (top of half) - IMPROVED: Include price if requested
      if (productText) {
        const productDiv = document.createElement('div');
        let displayText = productText;
        // Add price to product text if showPrice is true (for split labels, we combine them)
        if (showPrice && price > 0) {
          displayText = `${productText} | ${this.formatPrice(price)}`;
        }
        productDiv.style.cssText = `
          width: 100%;
          text-align: center;
          font-size: ${profile.infoSize}px;
          font-weight: bold;
          color: #000000;
          direction: rtl;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-shrink: 0;
          line-height: 1;
        `;
        productDiv.textContent = displayText;
        half.appendChild(productDiv);
      } else if (showPrice && price > 0) {
        // If no product text but showPrice is true, show price only
        const priceDiv = document.createElement('div');
        priceDiv.style.cssText = `
          width: 100%;
          text-align: center;
          font-size: ${profile.priceSize}px;
          font-weight: bold;
          color: #000000;
          direction: rtl;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-shrink: 0;
          line-height: 1;
        `;
        priceDiv.textContent = this.formatPrice(price);
        half.appendChild(priceDiv);
      }

      // Barcode
      const barcodeDiv = document.createElement('div');
      barcodeDiv.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        flex-grow: 1;
        overflow: hidden;
        background: #ffffff;
      `;

      if (barcodeSVG) {
        barcodeDiv.innerHTML = barcodeSVG;
      }

      half.appendChild(barcodeDiv);
      return half;
    };

    // Main container - ONE label with TWO halves (same size as FULL)
    const label = document.createElement('div');
    label.className = 'barcode-label barcode-label-split barcode-label-thermal-safe';
    label.style.cssText = `
      width: ${fullProfile.labelWidthPx}px;
      height: ${fullProfile.labelHeightPx}px;
      max-width: ${fullProfile.labelWidthPx}px;
      max-height: ${fullProfile.labelHeightPx}px;
      background: #ffffff;
      font-family: Arial, sans-serif;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
    `;

    // Top half
    label.appendChild(createHalfSection());

    // Divider line (optional visual separator)
    const divider = document.createElement('div');
    divider.style.cssText = `
      width: 90%;
      height: 1px;
      background: #cccccc;
      flex-shrink: 0;
    `;
    label.appendChild(divider);

    // Bottom half
    label.appendChild(createHalfSection());

    return returnString ? label.outerHTML : label;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 CORE API: getPrinterProfiles()
  // ═══════════════════════════════════════════════════════════════════════════════
  /**
   * Get all available printer profiles.
   *
   * @returns {Object} The PRINTER_PROFILES object
   */
  getPrinterProfiles() {
    return { ...this.PRINTER_PROFILES };
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📊 EAN-13 HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Calculate EAN-13 check digit.
   * @param {String} code12 - 12 digit code without check digit
   * @returns {Number} check digit (0-9)
   */
  calculateEAN13CheckDigit(code12) {
    if (!code12 || code12.length !== 12) return 0;

    const digits = code12.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10;
  },

  /**
   * Validate an EAN-13 code.
   * @param {String} code13 - 13 digit EAN-13 code
   * @returns {Boolean} true if valid
   */
  validateEAN13(code13) {
    if (!code13 || code13.length !== 13 || !/^\d+$/.test(code13)) return false;

    const code12 = code13.substring(0, 12);
    const providedCheck = parseInt(code13[12], 10);
    const calculatedCheck = this.calculateEAN13CheckDigit(code12);

    return providedCheck === calculatedCheck;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔧 UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get shop name from settings.
   */
  getShopName() {
    try {
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      return settings.companyName || 'ELOS';
    } catch (e) {
      Logger.error('[BARCODE] Error getting shop name:', e);
      return 'ELOS';
    }
  },

  /**
   * Format price for display.
   */
  formatPrice(price) {
    const num = Number(price || 0);
    return num.toLocaleString('en-US') + ' L.E';
  },

  /**
   * Create an error SVG placeholder.
   * @private
   */
  _createErrorSVG(message, width, height) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
      <text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#ff0000" font-size="10">${message}</text>
    </svg>`;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📏 BARCODE TYPE DETECTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Determine item type from barcode value.
   * @param {String} code - The barcode
   * @returns {String} 'device' | 'accessory' | 'repair' | 'unknown'
   */
  getBarcodeType(code) {
    if (!code) return 'unknown';
    const cleanCode = String(code).trim();

    // New devices: 5 digits (10000-19999)
    if (/^\d{5}$/.test(cleanCode)) {
      const numCode = parseInt(cleanCode, 10);
      if (numCode >= 10000 && numCode <= 19999) return 'device';
      if (numCode >= 50000 && numCode <= 89999) return 'accessory';
    }

    // Legacy devices: 4 digits (1000-4999)
    if (/^\d{4}$/.test(cleanCode)) {
      const numCode = parseInt(cleanCode, 10);
      if (numCode >= 1000 && numCode <= 4999) return 'device';
      if (numCode >= 5000 && numCode <= 8999) return 'accessory';
    }

    // Legacy accessories: 6 digits
    if (/^\d{6}$/.test(cleanCode)) {
      const numCode = parseInt(cleanCode, 10);
      if (numCode >= 100000 && numCode <= 999999) return 'accessory';
    }

    // EAN-13 prefix detection
    if (cleanCode.length === 13 && /^\d+$/.test(cleanCode)) {
      const prefix = cleanCode[0];
      if (prefix === '2') return 'device';
      if (prefix === '3') return 'accessory';
      if (prefix === '4') return 'repair';
    }

    return 'unknown';
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🖨️ PRINT FUNCTION (Main Entry Point for Printing)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Print barcode labels.
   * This is the main printing function that both Inventory and POS should use.
   *
   * @param {Array|Object} items - Item(s) to print
   * @param {Object} options - { type, labelType, copies, showPrice, showShopName }
   */
  async printLabels(items, options = {}) {
    const itemsArray = Array.isArray(items) ? items : [items];
    const {
      type = 'device',
      labelType = 'single',
      copies = 1,
      showPrice = true,
      showShopName = true
    } = options;

    const labelProfile = labelType === 'split' ? 'SPLIT' : 'FULL';
    const profile = this.PRINTER_PROFILES[labelProfile];
    // CRITICAL: Always use FULL profile for page size (physical sticker is always 38×25mm)
    const pageProfile = this.PRINTER_PROFILES.FULL;

    // Generate all label HTML
    Logger.log('[BARCODE] printLabels - showPrice:', showPrice, 'labelProfile:', labelProfile, 'type:', type);
    let allLabelsHTML = '';
    itemsArray.forEach(item => {
      for (let i = 0; i < copies; i++) {
        const label = this.renderLabelHTML(item, {
          labelProfile,
          showPrice,
          showShopName,
          type,
          returnString: true
        });
        allLabelsHTML += label;
      }
    });

    // Build print HTML with thermal-safe CSS (always use FULL page size)
    const printHTML = this._buildPrintHTML(allLabelsHTML, { profile: pageProfile, labelType, showPrice });

    // Try silent print first (Electron printBridge)
    let printBridge = null;
    if (typeof window !== 'undefined' && window.printBridge && typeof window.printBridge.printSilent === 'function') {
      printBridge = window.printBridge;
      Logger.log('[PRINT] Found printBridge in current window');
    } else if (typeof window !== 'undefined' && window.opener && window.opener.printBridge) {
      printBridge = window.opener.printBridge;
      Logger.log('[PRINT] Found printBridge in opener window');
    }

    if (printBridge) {
      try {
        Logger.log('[PRINT] Sending to printBridge.printSilent()...');
        printBridge.printSilent({
          htmlContent: printHTML,
          silent: true,
          printBackground: true
        });
        Logger.log('[PRINT] Silent print sent successfully');
        return;
      } catch (error) {
        Logger.error('[PRINT] Silent print failed:', error);
        // Fall through to window.print() fallback
      }
    }

    // Fallback: Open print preview window (always use FULL page size)
    this._openPrintWindow(printHTML, { profile: pageProfile, labelType, showPrice });
  },

  /**
   * Build the complete print HTML document.
   * @private
   */
  _buildPrintHTML(labelsHTML, options) {
    const { profile, labelType, showPrice } = options;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Print Barcode - XPrinter 233B</title>
        <style>
          /* ═══════════════════════════════════════════════════════════════
             THERMAL-SAFE PRINT STYLES
             These styles ensure reliable barcode printing on thermal printers.
             ═══════════════════════════════════════════════════════════════ */

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: Arial, sans-serif;
            background: white;
            padding: 0;
            margin: 0;
          }

          .preview {
            display: block;
            margin: 0;
            padding: 0;
          }

          /* ═══════════════════════════════════════════════════════════════
             CRITICAL: Barcode label thermal-safe rules
             ═══════════════════════════════════════════════════════════════ */
          .barcode-label {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always;
            page-break-inside: avoid;
            background: #ffffff !important;
            /* CRITICAL: Start from top-left, no centering */
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            align-items: center !important;
          }

          /* Force black text on white background */
          .barcode-label * {
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* ═══════════════════════════════════════════════════════════════
             CRITICAL: SVG barcode rendering - NO SCALING
             ═══════════════════════════════════════════════════════════════ */
          .barcode-label svg {
            display: block !important;
            visibility: visible !important;
            /* NO max-width: 100% - this would scale the barcode! */
            /* NO transform: scale() - exact pixels only! */
          }

          /* Ensure SVG bars are black and visible */
          .barcode-label svg rect {
            fill-opacity: 1 !important;
          }

          /* Ensure SVG text is black */
          .barcode-label svg text {
            fill: #000000 !important;
          }

          @page {
            size: ${profile.labelWidthMM}mm ${profile.labelHeightMM}mm;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="preview">${labelsHTML}</div>
      </body>
      </html>
    `;
  },

  /**
   * Open a print preview window with controls.
   * @private
   */
  _openPrintWindow(printHTML, options) {
    const { profile, labelType, showPrice } = options;

    const printWindow = window.open('', '_blank', 'width=700,height=500');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Print Barcode - XPrinter 233B</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #f0f0f0; padding: 20px; }
          .controls {
            position: fixed; top: 10px; right: 10px;
            display: flex; gap: 10px; background: white;
            padding: 15px; border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 1000;
          }
          .controls button {
            padding: 12px 25px; border: none; border-radius: 8px;
            font-size: 14px; font-weight: bold; cursor: pointer;
          }
          .btn-print { background: #3b82f6; color: white; }
          .btn-print:hover { background: #2563eb; }
          .btn-close { background: #666; color: white; }
          .btn-close:hover { background: #555; }
          .preview {
            display: flex; flex-wrap: wrap; gap: 20px;
            justify-content: center; margin-top: 70px;
          }
          .barcode-label {
            border: 1px dashed #999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .info {
            position: fixed; bottom: 10px; left: 50%;
            transform: translateX(-50%); background: #333;
            color: white; padding: 10px 20px; border-radius: 8px; font-size: 13px;
          }

          @media print {
            .controls, .info { display: none !important; }
            body { background: white; padding: 0; margin: 0; }
            .preview { display: block; margin: 0; padding: 0; }
            .barcode-label {
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              page-break-after: always;
              page-break-inside: avoid;
              background: #ffffff !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
              align-items: center !important;
            }
            .barcode-label * {
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .barcode-label svg {
              display: block !important;
              visibility: visible !important;
            }
            .barcode-label svg rect {
              fill-opacity: 1 !important;
            }
            .barcode-label svg text {
              fill: #000000 !important;
            }
            @page { size: ${profile.labelWidthMM}mm ${profile.labelHeightMM}mm; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button class="btn-print" onclick="window.print()">🖨️ Print</button>
          <button class="btn-close" onclick="window.close()">✕ Close</button>
        </div>
        <div class="info">
          XPrinter 233B | ${profile.labelWidthMM}×${profile.labelHeightMM}mm | ${labelType === 'split' ? 'Split (2x)' : 'Full'} | ${showPrice ? 'With Price' : 'No Price'}
        </div>
        <div class="preview">${printHTML.replace(/<html>[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*<\/html>/, '')}</div>
      </body>
      </html>
    `);

    printWindow.document.close();
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 QA DIAGNOSTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get diagnostic info for a barcode.
   * Used by the preview debug overlay.
   *
   * @param {String} code - The barcode
   * @param {String} labelProfile - 'FULL' or 'SPLIT'
   * @returns {Object} Diagnostic information
   */
  getDiagnostics(code, labelProfile = 'FULL') {
    const decision = this.decideFormat(code);
    const profile = this.PRINTER_PROFILES[labelProfile] || this.PRINTER_PROFILES.FULL;

    return {
      version: this.VERSION,
      inputCode: code,
      normalizedCode: decision.normalizedCode,
      format: decision.format,
      isValid: decision.isValid,
      notes: decision.notes,
      profile: {
        name: profile.name,
        labelSize: `${profile.labelWidthMM}×${profile.labelHeightMM}mm`,
        labelPx: `${profile.labelWidthPx}×${profile.labelHeightPx}px`,
        barcodePx: `${profile.barcodeWidthPx}×${profile.barcodeHeightPx}px`,
        moduleWidthPx: profile.moduleWidthPx,
        marginPx: profile.marginPx,
        fontSize: profile.fontSize
      },
      thermal: {
        moduleWidthOk: profile.moduleWidthPx >= 2.4,
        quietZoneOk: profile.marginPx >= 10,
        heightOk: profile.barcodeHeightPx >= 20,
        recommendation: this._getThermalRecommendation(profile)
      }
    };
  },

  /**
   * Get thermal printing recommendation.
   * @private
   */
  _getThermalRecommendation(profile) {
    const issues = [];

    if (profile.moduleWidthPx < 2.4) {
      issues.push(`Module width ${profile.moduleWidthPx}px < 2.4px minimum`);
    }
    if (profile.marginPx < 10) {
      issues.push(`Quiet zone ${profile.marginPx}px < 10px minimum`);
    }
    if (profile.barcodeHeightPx < 20) {
      issues.push(`Bar height ${profile.barcodeHeightPx}px < 20px minimum`);
    }

    if (issues.length === 0) {
      return '✅ All thermal requirements met';
    }

    return '⚠️ Issues: ' + issues.join('; ');
  },

  /**
   * Create a debug overlay element for the preview.
   * Shows diagnostic info without printing it.
   *
   * @param {String} code - The barcode
   * @param {String} labelProfile - 'FULL' or 'SPLIT'
   * @returns {HTMLElement} Debug overlay element
   */
  createDebugOverlay(code, labelProfile = 'FULL') {
    const diag = this.getDiagnostics(code, labelProfile);

    const overlay = document.createElement('div');
    overlay.className = 'barcode-debug-overlay no-print';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.85);
      color: #00ff00;
      font-family: monospace;
      font-size: 9px;
      padding: 4px;
      display: none;
      z-index: 100;
      white-space: pre-wrap;
    `;

    overlay.innerHTML = `
<strong>BarcodeService v${diag.version}</strong>
Format: ${diag.format} | Code: ${diag.normalizedCode}
Module: ${diag.profile.moduleWidthPx}px | Margin: ${diag.profile.marginPx}px
Size: ${diag.profile.barcodePx}
${diag.thermal.recommendation}
${diag.notes.join('\n')}
    `.trim();

    return overlay;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔄 LEGACY COMPATIBILITY LAYER
  // ═══════════════════════════════════════════════════════════════════════════════
  // These methods maintain backward compatibility with existing code that
  // calls the old API patterns.

  /**
   * Legacy: Generate barcode SVG (delegates to renderBarcodeSVG)
   */
  generateCode128SVG(text, width, height) {
    return this.renderBarcodeSVG(text, { labelProfile: 'FULL' });
  },

  /**
   * Legacy: Print barcodes (delegates to printLabels)
   */
  printBarcodes(items, options = {}) {
    return this.printLabels(items, options);
  },

  /**
   * Legacy: Generate label (delegates to renderLabelHTML)
   */
  generateLabel(item, type, options = {}) {
    const labelProfile = options.labelType === 'split' ? 'SPLIT' : 'FULL';
    return this.renderLabelHTML(item, { ...options, labelProfile, type });
  },

  /**
   * Legacy: Extract short barcode
   */
  extractShortBarcode(item, maxLength = 6) {
    return this.getPrintableCode(item, { preferShort: true });
  },

  /**
   * Legacy: Extract barcode
   */
  extractBarcode(item) {
    return this.getPrintableCode(item, { preferShort: false });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 GLOBAL EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
window.BarcodeService = BarcodeService;

// Log initialization
Logger.log(`[BARCODE] BarcodeService v${BarcodeService.VERSION} initialized`);
Logger.log('[BARCODE] Thermal-safe profiles:', Object.keys(BarcodeService.PRINTER_PROFILES).join(', '));
