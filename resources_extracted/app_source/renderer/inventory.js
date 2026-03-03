// ═══════════════════════════════════════════════════════════════
// 📦 ELOS INVENTORY SYSTEM - Enhanced Version with Sorting & Details
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

// ═════════════════════════════════════
// 💾 CACHING SYSTEM
// ═════════════════════════════════════
const isStorageDevicesPage = window.location.pathname.includes('storage-devices.html');
if (!isStorageDevicesPage) {
  // Ensure main inventory does not inherit storage filters
  localStorage.removeItem('isStorageWarehouse');
  localStorage.removeItem('currentWarehouseId');
}
const InventoryCache = {
  data: {},
  stats: {},

  getCacheKey() {
    // Create unique key based on current filters AND warehouse
    const imei = document.getElementById('qImei')?.value.trim() || '';
    const condition = document.getElementById('fCondition')?.value || '';
    const status = document.getElementById('fStatus')?.value || '';
    const warehouseId = localStorage.getItem('currentWarehouseId') || 'main';
    return `${warehouseId}_${imei}_${condition}_${status}`;
  },
  
  set(type, value) {
    const key = this.getCacheKey();
    if (!this[type]) this[type] = {};
    this[type][key] = {
      value: value,
      timestamp: Date.now()
    };
  },
  
  get(type) {
    const key = this.getCacheKey();
    if (!this[type] || !this[type][key]) {
      return null;
    }
    
    const cached = this[type][key];
    const age = Date.now() - cached.timestamp;
    const ttl = 30000; // 30 seconds
    
    if (age > ttl) {
      delete this[type][key];
      return null;
    }
    
    return cached.value;
  },
  
  clear() {
    this.data = {};
    this.stats = {};
  }
};

// Clear cache on certain events
window.addEventListener('focus', () => {
  // Refresh cache when user returns to tab
});

// Clear cache on page load to ensure fresh data
InventoryCache.clear();
console.log('[Inventory] Cache cleared on page load');
console.log('[Inventory] currentWarehouseId:', localStorage.getItem('currentWarehouseId'));
console.log('[Inventory] isStorageWarehouse:', localStorage.getItem('isStorageWarehouse'));

// ═════════════════════════════════════
// 🛠️ UTILITIES
// ═════════════════════════════════════
// fmt() is now imported from utils.js (window.fmt)

// Debounce function for search optimization
function debounce(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// ═════════════════════════════════════
// 🔄 SORTING STATE
// ═════════════════════════════════════
let sortColumn = null;
let sortDirection = 'asc';

// ═════════════════════════════════════
// ✅ DEVICE MULTI-SELECT SYSTEM
// ═════════════════════════════════════
let selectedDevices = new Set();
let availableDeviceWarehouses = [];
let mainDeviceWarehouseId = null;

// Toggle select all devices
window.toggleSelectAllDevices = function(checkbox) {
  const isChecked = checkbox.checked;
  const rowCheckboxes = document.querySelectorAll('.device-row-checkbox');

  rowCheckboxes.forEach(cb => {
    cb.checked = isChecked;
    const id = parseInt(cb.dataset.id);
    if (isChecked) {
      selectedDevices.add(id);
    } else {
      selectedDevices.delete(id);
    }
    const row = cb.closest('tr');
    if (row) row.classList.toggle('device-selected-row', isChecked);
  });

  updateDeviceSelectionUI();
};

// Toggle single device selection
window.toggleDeviceSelection = function(checkbox, id) {
  const deviceId = parseInt(id);
  if (checkbox.checked) {
    selectedDevices.add(deviceId);
  } else {
    selectedDevices.delete(deviceId);
  }

  const row = checkbox.closest('tr');
  if (row) row.classList.toggle('device-selected-row', checkbox.checked);

  updateDeviceSelectAllCheckbox();
  updateDeviceSelectionUI();
};

function updateDeviceSelectAllCheckbox() {
  const selectAll = document.getElementById('selectAllDevices');
  const rowCheckboxes = document.querySelectorAll('.device-row-checkbox');
  const checkedCount = document.querySelectorAll('.device-row-checkbox:checked').length;

  if (selectAll) {
    selectAll.checked = rowCheckboxes.length > 0 && checkedCount === rowCheckboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
  }
}

function updateDeviceSelectionUI() {
  const count = selectedDevices.size;
  const countEl = document.getElementById('deviceSelectionCount');
  const transferBtn = document.getElementById('btnBulkTransferDevices');
  const avgBtn = document.getElementById('btnAveragePrices');
  const printBarcodeBtn = document.getElementById('btnPrintBarcodesDevices');

  if (countEl) {
    if (count > 0) {
      countEl.textContent = `${count} محدد`;
      countEl.style.display = 'inline-block';
    } else {
      countEl.style.display = 'none';
    }
  }

  if (transferBtn) {
    transferBtn.style.display = count > 0 ? 'flex' : 'none';
  }

  // زر توحيد الأسعار يظهر فقط إذا كان أكثر من جهاز محدد
  if (avgBtn) {
    avgBtn.style.display = count > 1 ? 'flex' : 'none';
  }

  if (printBarcodeBtn) {
    printBarcodeBtn.style.display = count > 0 ? 'flex' : 'none';
  }
}

function clearDeviceSelection() {
  selectedDevices.clear();
  document.querySelectorAll('.device-row-checkbox').forEach(cb => {
    cb.checked = false;
    const row = cb.closest('tr');
    if (row) row.classList.remove('device-selected-row');
  });
  const selectAll = document.getElementById('selectAllDevices');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
  updateDeviceSelectionUI();
}

// Load available warehouses for transfer
async function loadDeviceWarehouses() {
  try {
    const response = await fetch('elos-db://warehouses');
    const data = await response.json();
    availableDeviceWarehouses = (data.warehouses || data || []).filter(w => w.is_active !== 0);
    const mainWarehouse = availableDeviceWarehouses.find(w => w.type === 'devices' && !w.is_storage_only);
    mainDeviceWarehouseId = mainWarehouse ? mainWarehouse.id : null;
    console.log('[Inventory] Loaded warehouses for transfer:', availableDeviceWarehouses.length);
  } catch (error) {
    console.error('[Inventory] Failed to load warehouses:', error);
    availableDeviceWarehouses = [];
    mainDeviceWarehouseId = null;
  }
}

// Open bulk transfer modal for devices
window.openDeviceBulkTransferModal = function() {
  if (selectedDevices.size === 0) {
    showToast('⚠️ يرجى تحديد جهاز واحد على الأقل', 'warning');
    return;
  }

  const modal = document.getElementById('deviceBulkTransferModal');
  if (!modal) return;

  // Update count
  const countEl = document.getElementById('deviceTransferItemsCount');
  if (countEl) countEl.textContent = selectedDevices.size;

  // Populate target warehouse dropdown - فقط مخازن الأجهزة
  const targetSelect = document.getElementById('deviceTransferTargetWarehouse');
  if (targetSelect) {
    const currentWarehouseId = localStorage.getItem('currentWarehouseId') || '';
    // تصفية: فقط مخازن الأجهزة
    // - المخازن الأساسية: type = 'devices'
    // - المخازن التخزينية: is_storage_only = 1 AND storage_type = 'devices'
    const deviceWarehouses = availableDeviceWarehouses.filter(w => {
      if (String(w.id) === currentWarehouseId) return false;

      // مخزن أساسي للأجهزة
      if (w.type === 'devices') return true;

      // مخزن تخزيني للأجهزة
      if (w.is_storage_only === 1 && w.storage_type === 'devices') return true;

      return false;
    });

    if (deviceWarehouses.length === 0) {
      targetSelect.innerHTML = '<option value="">-- لا توجد مخازن أجهزة متاحة --</option>';
    } else {
      targetSelect.innerHTML = '<option value="">-- اختر المخزن الوجهة --</option>' +
        deviceWarehouses
          .map(w => `<option value="${w.id}">${w.icon || '📱'} ${w.name}</option>`)
          .join('');
    }
  }

  // Render selected devices list
  renderDeviceTransferList();

  // Clear notes
  const notesEl = document.getElementById('deviceTransferNotes');
  if (notesEl) notesEl.value = '';

  // Show modal
  modal.style.display = 'flex';
};

// Close transfer modal
window.closeDeviceBulkTransferModal = function() {
  const modal = document.getElementById('deviceBulkTransferModal');
  if (modal) modal.style.display = 'none';
};

/**
 * طباعة باركود للأجهزة المحددة — جهاز واحد = باركود واحد
 */
window.printSelectedDevicesBarcodes = function() {
  if (selectedDevices.size === 0) {
    showToast('حدد أجهزة أولاً', 'warning');
    return;
  }
  const selectedDevicesList = currentList.filter(d => selectedDevices.has(d.id));
  if (selectedDevicesList.length === 0) {
    showToast('لا توجد أجهزة محددة في القائمة الحالية', 'warning');
    return;
  }
  const toPrint = [];
  let skipped = 0;
  for (const d of selectedDevicesList) {
    const code = String(d.short_code || d.barcode || d.code || '').trim();
    if (!code) {
      skipped++;
      continue;
    }
    const deviceData = {
      ...d,
      short_code: code,
      barcode: code,
      code: code,
      model: d.model || d.type || 'جهاز',
      expected_price: d.expected_price,
      purchase_cost: d.purchase_cost
    };
    toPrint.push(deviceData);
  }
  if (toPrint.length === 0) {
    showToast(skipped ? 'الأجهزة المحددة لا تحتوي على باركود' : 'لا يوجد ما يطبع', 'warning');
    return;
  }
  if (typeof BarcodeGenerator !== 'undefined' && BarcodeGenerator.printMultipleBarcodes) {
    BarcodeGenerator.printMultipleBarcodes(toPrint, { type: 'device', skipShortCodeGeneration: true }).then(() => {
      showToast(`تم إرسال ${toPrint.length} باركود للطباعة`, 'success');
    }).catch(err => {
      console.error('[PRINT] printSelectedDevicesBarcodes error:', err);
      showToast('فشل في الطباعة', 'error');
    });
  } else {
    showToast('نظام الباركود غير متاح', 'error');
  }
};

// Render device list in transfer modal
function renderDeviceTransferList() {
  const listEl = document.getElementById('deviceTransferItemsList');
  if (!listEl) return;

  const selectedDevicesList = currentList.filter(d => selectedDevices.has(d.id));

  if (selectedDevicesList.length === 0) {
    listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">لا توجد أجهزة محددة</div>';
    return;
  }

  listEl.innerHTML = selectedDevicesList.map(device => `
    <div class="device-transfer-item" data-id="${device.id}">
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <span style="font-size: 20px;">📱</span>
        <div>
          <div style="font-weight: 600; color: var(--ink);">${escapeHtml(device.model || device.type || 'جهاز')}</div>
          <div style="font-size: 11px; color: var(--muted);">
            IMEI: ${device.imei1 || '-'} | ${device.storage || '-'}
          </div>
        </div>
      </div>
      <button class="device-transfer-remove" onclick="removeDeviceFromTransfer(${device.id})" title="إزالة">
        ✕
      </button>
    </div>
  `).join('');
}

// Remove device from transfer list
window.removeDeviceFromTransfer = function(deviceId) {
  selectedDevices.delete(deviceId);

  const checkbox = document.querySelector(`.device-row-checkbox[data-id="${deviceId}"]`);
  if (checkbox) {
    checkbox.checked = false;
    const row = checkbox.closest('tr');
    if (row) row.classList.remove('device-selected-row');
  }

  updateDeviceSelectAllCheckbox();
  updateDeviceSelectionUI();
  renderDeviceTransferList();

  const countEl = document.getElementById('deviceTransferItemsCount');
  if (countEl) countEl.textContent = selectedDevices.size;

  if (selectedDevices.size === 0) {
    closeDeviceBulkTransferModal();
    showToast('تم إزالة جميع الأجهزة', 'info');
  }
};

// Execute bulk transfer for devices
window.executeDeviceBulkTransfer = async function() {
  const targetWarehouseId = document.getElementById('deviceTransferTargetWarehouse')?.value;
  const notes = document.getElementById('deviceTransferNotes')?.value || '';

  if (!targetWarehouseId) {
    showToast('⚠️ يرجى اختيار المخزن الوجهة', 'warning');
    return;
  }

  if (selectedDevices.size === 0) {
    showToast('⚠️ لا توجد أجهزة للتحويل', 'warning');
    return;
  }

  // Build items array
  const items = Array.from(selectedDevices).map(id => ({
    item_type: 'device',
    item_id: id,
    quantity: 1
  }));

  // تحديد المخزن المصدر
  // إذا كنا في مخزن تخزيني، نستخدم ID المحفوظ
  // إذا كنا في المخزن الرئيسي، نجد ID المخزن الرئيسي للأجهزة
  let currentWarehouseId = localStorage.getItem('currentWarehouseId');
  if (!currentWarehouseId) {
    // البحث عن المخزن الرئيسي للأجهزة (type = 'devices' وليس تخزيني)
    const mainDeviceWarehouse = availableDeviceWarehouses.find(w => w.type === 'devices' && !w.is_storage_only);
    if (mainDeviceWarehouse) {
      currentWarehouseId = mainDeviceWarehouse.id;
    } else {
      showToast('❌ لم يتم العثور على المخزن المصدر', 'error');
      return;
    }
  }

  // Disable button
  const btn = document.getElementById('btnExecuteDeviceTransfer');
  const originalText = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ جاري التحويل...';
  }

  try {
    console.log('[Transfer] Starting device bulk transfer:', {
      from: currentWarehouseId,
      to: targetWarehouseId,
      devices: items.length
    });

    const response = await fetch('elos-db://warehouse-transfers/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_warehouse_id: parseInt(currentWarehouseId),
        to_warehouse_id: parseInt(targetWarehouseId),
        items: items,
        notes: notes
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'فشل التحويل');
    }

    console.log('[Transfer] ✅ Success:', result);
    showToast(`✅ ${result.message}`, 'success');

    // Close modal and clear selection
    closeDeviceBulkTransferModal();
    clearDeviceSelection();

    // Reload data
    InventoryCache.clear();
    await render();

  } catch (error) {
    console.error('[Transfer] Error:', error);
    showToast(`❌ ${error.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};

// ═════════════════════════════════════
// 📊 AVERAGE PRICES SYSTEM - توحيد الأسعار
// ═════════════════════════════════════

// Open average prices modal
window.openAveragePricesModal = function() {
  if (selectedDevices.size < 2) {
    showToast('⚠️ يرجى تحديد جهازين على الأقل لتوحيد الأسعار', 'warning');
    return;
  }

  const modal = document.getElementById('averagePricesModal');
  if (!modal) return;

  // Get selected devices data
  const selectedDevicesList = currentList.filter(d => selectedDevices.has(d.id) && d.status === 'in_stock');

  if (selectedDevicesList.length < 2) {
    showToast('⚠️ يرجى تحديد جهازين متاحين على الأقل', 'warning');
    return;
  }

  // Update count
  document.getElementById('avgDevicesCount').textContent = selectedDevicesList.length;

  // Render devices list
  const listEl = document.getElementById('avgDevicesList');
  listEl.innerHTML = selectedDevicesList.map(d => `
    <div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--line);">
      <span style="font-size: 18px;">📱</span>
      <div style="flex: 1;">
        <div style="font-weight: 600; color: var(--ink); font-size: 13px;">${escapeHtml(d.model || 'جهاز')}</div>
        <div style="font-size: 11px; color: var(--muted);">${d.storage || '-'} | ${d.imei1 || '-'}</div>
      </div>
      <div style="text-align: left; font-size: 12px;">
        <div style="color: var(--danger);">تكلفة: ${fmt(d.purchase_cost)}</div>
        <div style="color: var(--success);">بيع: ${fmt(d.expected_price)}</div>
      </div>
    </div>
  `).join('');

  // Calculate statistics
  const costs = selectedDevicesList.map(d => Number(d.purchase_cost || 0));
  const prices = selectedDevicesList.map(d => Number(d.expected_price || 0));

  const totalCost = costs.reduce((a, b) => a + b, 0);
  const totalPrice = prices.reduce((a, b) => a + b, 0);
  const avgCost = Math.round(totalCost / costs.length);
  const avgPrice = Math.round(totalPrice / prices.length);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Update UI
  document.getElementById('avgTotalCost').textContent = fmt(totalCost) + ' ج.م';
  document.getElementById('avgMinCost').textContent = fmt(minCost) + ' ج.م';
  document.getElementById('avgMaxCost').textContent = fmt(maxCost) + ' ج.م';
  document.getElementById('avgAvgCost').textContent = fmt(avgCost) + ' ج.م';

  document.getElementById('avgTotalPrice').textContent = fmt(totalPrice) + ' ج.م';
  document.getElementById('avgMinPrice').textContent = fmt(minPrice) + ' ج.م';
  document.getElementById('avgMaxPrice').textContent = fmt(maxPrice) + ' ج.م';
  document.getElementById('avgAvgPrice').textContent = fmt(avgPrice) + ' ج.م';

  const expectedProfit = avgPrice - avgCost;
  document.getElementById('avgExpectedProfit').textContent = fmt(expectedProfit) + ' ج.م';
  document.getElementById('avgExpectedProfit').style.color = expectedProfit >= 0 ? 'var(--success)' : 'var(--danger)';

  // Store calculated values for later
  modal.dataset.avgCost = avgCost;
  modal.dataset.avgPrice = avgPrice;
  modal.dataset.deviceIds = JSON.stringify(Array.from(selectedDevices));

  // Show modal
  modal.style.display = 'flex';
};

// Close average prices modal
window.closeAveragePricesModal = function() {
  const modal = document.getElementById('averagePricesModal');
  if (modal) modal.style.display = 'none';
};

// Apply average prices
window.applyAveragePrices = async function() {
  const modal = document.getElementById('averagePricesModal');
  const applyCost = document.getElementById('avgApplyCost')?.checked;
  const applyPrice = document.getElementById('avgApplyPrice')?.checked;

  if (!applyCost && !applyPrice) {
    showToast('⚠️ يرجى اختيار خيار واحد على الأقل للتوحيد', 'warning');
    return;
  }

  const avgCost = Number(modal.dataset.avgCost || 0);
  const avgPrice = Number(modal.dataset.avgPrice || 0);
  const deviceIds = JSON.parse(modal.dataset.deviceIds || '[]');

  if (deviceIds.length < 2) {
    showToast('⚠️ لا توجد أجهزة كافية', 'warning');
    return;
  }

  // Confirmation
  const confirmMsg = `هل أنت متأكد من توحيد أسعار ${deviceIds.length} جهاز؟\n\n` +
    (applyCost ? `✓ التكلفة الجديدة: ${fmt(avgCost)} ج.م\n` : '') +
    (applyPrice ? `✓ سعر البيع الجديد: ${fmt(avgPrice)} ج.م` : '');

  if (!confirm(confirmMsg)) return;

  // Disable button
  const btn = document.getElementById('btnApplyAveragePrices');
  const originalText = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ جاري التطبيق...';
  }

  try {
    const response = await fetch('elos-db://devices/average-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_ids: deviceIds,
        avg_cost: applyCost ? avgCost : null,
        avg_price: applyPrice ? avgPrice : null
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'فشل تطبيق المتوسط');
    }

    showToast(`✅ تم توحيد أسعار ${result.updated} جهاز بنجاح`, 'success');

    // Close modal and clear selection
    closeAveragePricesModal();
    clearDeviceSelection();

    // Reload data
    InventoryCache.clear();
    await render();

  } catch (error) {
    console.error('[AveragePrices] Error:', error);
    showToast(`❌ ${error.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};

// ═════════════════════════════════════
// ✅ EVENT DELEGATION SYSTEM (منع تسريب الذاكرة)
// ═════════════════════════════════════
let eventDelegationInitialized = false;

function initEventDelegation() {
  if (eventDelegationInitialized) return;
  eventDelegationInitialized = true;

  const tbody = document.getElementById("rows");
  if (!tbody) return;

  // ✅ Event delegation للـ tbody - listener واحد فقط لكل الأحداث
  tbody.addEventListener('click', handleTableClick);
  tbody.addEventListener('dblclick', handleTableDblClick);

  Logger.log('[Inventory] Event delegation initialized');
}

// ✅ Handler للـ click events
function handleTableClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;

  const deviceId = Number(btn.dataset.details || btn.dataset.sell || btn.dataset.edit || btn.dataset.archive || btn.dataset.delete);
  if (!deviceId) return;

  if (btn.dataset.details) {
    showDeviceDetails(deviceId);
  } else if (btn.dataset.sell) {
    handleSellClick(deviceId);
  } else if (btn.dataset.edit) {
    handleEditClick(deviceId);
  } else if (btn.dataset.archive) {
    handleArchiveClick(deviceId);
  } else if (btn.dataset.delete) {
    handleDeleteClick(deviceId);
  }
}

// ✅ Handler للـ double-click events
function handleTableDblClick(e) {
  if (e.target.closest('button')) return;

  const row = e.target.closest('tr');
  if (!row) return;

  const detailsBtn = row.querySelector('button[data-details]');
  if (detailsBtn) {
    const deviceId = Number(detailsBtn.dataset.details);
    showDeviceDetails(deviceId);
  }
}

// ✅ Handler للـ sell button
function handleSellClick(deviceId) {
  const device = currentList.find(d => d.id === deviceId);
  if (!device) return;

  showSellOptionsModal(device, deviceId);
}

// ✅ عرض modal خيارات البيع
function showSellOptionsModal(device, deviceId) {
  // إزالة أي modal سابق
  const existingModal = document.getElementById('sellOptionsModalContainer');
  if (existingModal) existingModal.remove();

  const quickSellHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.2s ease;
    " id="sellOptionsModal">
      <div style="
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 28px;
        max-width: 450px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        animation: slideUp 0.3s ease;
      ">
        <h3 style="
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 20px;
          color: var(--accent);
          display: flex;
          align-items: center;
          gap: 10px;
        ">
          <span>💰</span>
          <span>خيارات البيع</span>
        </h3>

        <div style="
          background: var(--bg-tertiary);
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
        ">
          <div style="font-weight: 700; margin-bottom: 4px;">${escapeHtml(device.model || 'الجهاز')}</div>
          <div style="color: var(--text-secondary); font-size: 13px;">السعر المتوقع: ${fmt(device.expected_price)} جنيه</div>
        </div>

        <div style="display: grid; gap: 12px; margin-bottom: 20px;">
          <button id="quickSellBtn" style="
            background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 14px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
          ">
            <span>⚡</span>
            <span>بيع سريع الآن</span>
          </button>

          <button id="addToCartBtn" style="
            background: linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%);
            color: var(--accent);
            border: 1px solid rgba(59,130,246,0.3);
            border-radius: 10px;
            padding: 14px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
          ">
            <span>🛒</span>
            <span>إضافة لعربة التسوق (POS)</span>
          </button>
        </div>

        <button id="cancelSellBtn" style="
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
        ">
          إلغاء
        </button>
      </div>
    </div>
  `;

  const modalDiv = document.createElement('div');
  modalDiv.id = 'sellOptionsModalContainer';
  modalDiv.innerHTML = quickSellHTML;
  document.body.appendChild(modalDiv);

  // ✅ استخدام onclick بدلاً من addEventListener لتجنب التراكم
  const closeModal = () => modalDiv.remove();

  document.getElementById('quickSellBtn').onclick = () => {
    closeModal();
    sellCurrentId = deviceId;
    const ask = Number(device.expected_price || 0);
    document.getElementById("sellPrice").value = ask > 0 ? ask : "";
    document.getElementById("sellName").value = "";
    document.getElementById("sellPhone").value = "";
    document.getElementById("sellModal").style.display = "flex";
  };

  document.getElementById('addToCartBtn').onclick = () => {
    const brandIcons = {
      'Apple': '🍎', 'Samsung': '📱', 'Oppo': '📲', 'Realme': '⚡',
      'Vivo': '🌟', 'Xiaomi': '🎯', 'Nokia': '📞', 'Huawei': '🔷'
    };

    // ✅ استخدام type مباشرة كاسم الشركة
    let brand = device.type || 'أخرى';
    const brands = Object.keys(brandIcons);
    // لو الـ type مش موجود في brandIcons، ندور في الموديل
    if (!brandIcons[brand]) {
      for (const b of brands) {
        if (device.model && device.model.toLowerCase().includes(b.toLowerCase())) {
          brand = b;
          break;
        }
      }
    }

    const cartItem = {
      id: device.id,
      label: `${device.model || 'جهاز'} ${device.storage || ''}`.trim(),
      model: device.model,
      storage: device.storage,
      color: device.color,
      condition: device.condition,
      imei1: device.imei1,
      imei2: device.imei2,
      brand: brand,
      brandIcon: brandIcons[brand] || '📱',
      ask: Number(device.expected_price || 0),
      price: Number(device.expected_price || 0),
      cost: Number(device.purchase_cost || 0),
      discount: 0,
      discountReason: '',
      notes: '',
      accessories: []
    };

    let posCart = [];
    try {
      const saved = localStorage.getItem('elos-pos-cart');
      if (saved) posCart = JSON.parse(saved);
    } catch (e) {}

    if (posCart.some(c => c.id === device.id)) {
      showToast('⚠️ الجهاز موجود بالفعل في عربة التسوق', 'warning');
      closeModal();
      return;
    }

    posCart.push(cartItem);
    localStorage.setItem('elos-pos-cart', JSON.stringify(posCart));
    showToast('✅ تمت إضافة الجهاز لعربة التسوق', 'success');
    closeModal();

    // ✅ استخدام showConfirm بدلاً من confirm لتجنب تجمد الـ inputs
    setTimeout(async () => {
      const goToPOS = await showConfirm('تم إضافة الجهاز للعربة.\n\nهل تريد الانتقال لصفحة نقطة البيع الآن؟', 'انتقال', 'بقاء هنا', 'info');
      if (goToPOS) {
        window.location.href = './pos.html';
      }
    }, 500);
  };

  document.getElementById('cancelSellBtn').onclick = closeModal;

  document.getElementById('sellOptionsModal').onclick = (e) => {
    if (e.target.id === 'sellOptionsModal') closeModal();
  };

  // ESC handler - يُزال تلقائياً عند إغلاق الـ modal
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ✅ Handler للـ edit button
function handleEditClick(deviceId) {
  const device = currentList.find(d => d.id === deviceId);
  if (!device) return;

  document.getElementById("editDeviceId").value = device.id;

  // ✅ التأكد من وجود الـ type في الـ select options
  const editTypeSelect = document.getElementById("editType");
  const deviceType = device.type || "";

  if (deviceType) {
    // تحقق إذا كان الـ type موجود في الـ options
    const optionExists = Array.from(editTypeSelect.options).some(opt => opt.value === deviceType);

    if (!optionExists) {
      // أضف option جديدة للـ type المخصص
      const newOption = document.createElement("option");
      newOption.value = deviceType;
      newOption.textContent = deviceType;
      editTypeSelect.appendChild(newOption);
    }
  }

  editTypeSelect.value = deviceType;

  // Helper function to safely set element value
  const setElementValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };

  setElementValue("editModel", device.model || "");
  setElementValue("editStorage", device.storage || "");
  setElementValue("editRam", device.ram || "");
  setElementValue("editCondition", device.condition || "used");
  setElementValue("editBattery", device.battery_health || "");
  setElementValue("editBox", device.has_box ? "with_box" : "without_box");
  setElementValue("editImei1", device.imei1 || "");
  setElementValue("editImei2", device.imei2 || "");
  setElementValue("editCost", device.purchase_cost || "");
  setElementValue("editNtraTax", device.ntra_tax || "");
  setElementValue("editPrice", device.expected_price || "");
  setElementValue("editNotes", device.notes || "");
  setElementValue("editSource", device.source || "");

  // Apple: Show battery, Hide RAM | Others: Show RAM, Hide battery
  const batteryField = document.getElementById("editBatteryField");
  const ramField = document.getElementById("editRamField");
  if (device.type === "Apple") {
    if (batteryField) batteryField.style.display = "block";
    if (ramField) ramField.style.display = "none";
  } else {
    if (batteryField) batteryField.style.display = "none";
    if (ramField) ramField.style.display = "block";
  }

  document.getElementById("editModal").style.display = "flex";
}

// ✅ Handler للـ archive button
async function handleArchiveClick(deviceId) {
  const device = currentList.find(d => d.id === deviceId);
  if (!device) return;

  if (device.status !== 'sold') {
    showToast('⚠️ لا يمكن أرشفة إلا الأجهزة المباعة فقط!', 'warning');
    return;
  }

  // ✅ استخدام showConfirm بدلاً من confirm لتجنب تجمد الـ inputs
  const confirmArchive = await showConfirm(`هل أنت متأكد من أرشفة الجهاز "${device.model}"?\n\nسيتم نقله للأرشيف.`, 'أرشفة', 'إلغاء', 'warning');
  if (!confirmArchive) {
    return;
  }

  try {
    showLoading();
    const res = await fetch(`elos-db://archive-device`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: deviceId })
    });

    if (!res.ok) throw new Error('Failed to archive');

    showToast('✅ تم نقل الجهاز للأرشيف', 'success');
    InventoryCache.clear();
    await render();
  } catch (error) {
    Logger.error('Archive error:', error);
    showToast('حدث خطأ أثناء الأرشفة', 'error');
  } finally {
    hideLoading();
  }
}

// ✅ Handler للـ delete button - حذف الجهاز نهائياً
async function handleDeleteClick(deviceId) {
  const device = currentList.find(d => d.id === deviceId);
  if (!device) return;

  // التحقق من إمكانية الحذف
  if (device.status === 'sold') {
    showToast('⚠️ لا يمكن حذف جهاز مباع! استخدم الأرشفة بدلاً من ذلك.', 'warning');
    return;
  }

  if (device.status === 'reserved') {
    showToast('⚠️ لا يمكن حذف جهاز محجوز!', 'warning');
    return;
  }

  // تأكيد الحذف
  const confirmDelete = await showConfirm(
    `⚠️ هل أنت متأكد من حذف الجهاز نهائياً؟\n\n` +
    `📱 ${device.model}\n` +
    `🔢 IMEI: ${device.imei1 || '—'}\n\n` +
    `⛔ هذا الإجراء لا يمكن التراجع عنه!\n` +
    `📝 سيتم الحفاظ على سجلات المبيعات والمشتريات المرتبطة.`,
    '🗑️ حذف نهائي',
    'إلغاء',
    'danger'
  );

  if (!confirmDelete) {
    return;
  }

  try {
    showLoading();
    const res = await fetch(`elos-db://delete-device`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: deviceId })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to delete');
    }

    showToast('✅ تم حذف الجهاز نهائياً', 'success');
    InventoryCache.clear();
    await render();
  } catch (error) {
    Logger.error('Delete error:', error);
    showToast('حدث خطأ أثناء الحذف: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ═════════════════════════════════════
// 📄 PAGINATION STATE
// ═════════════════════════════════════
let currentPage = 1;
let rowsPerPage = 50;
let viewingAll = false;
let totalDevices = 0;

// ═════════════════════════════════════
// 🔔 TOAST NOTIFICATION SYSTEM
// ═════════════════════════════════════
function createToastContainer() {
  if (document.getElementById('toast-container')) return;
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
  `;
  document.body.appendChild(container);
}

// Track active toasts to prevent duplicates
let activeToasts = new Map();
const MAX_TOASTS = 3;

function showToast(message, type = 'info', duration = 3000) {
  createToastContainer();
  
  // Prevent duplicate toasts with same message
  if (activeToasts.has(message)) {
    return;
  }
  
  const container = document.getElementById('toast-container');
  
  // Limit max toasts - remove oldest if exceeded
  if (container.children.length >= MAX_TOASTS) {
    const oldest = container.firstChild;
    if (oldest) {
      oldest.remove();
      // Clean up from activeToasts
      for (let [key, value] of activeToasts) {
        if (value === oldest) {
          activeToasts.delete(key);
          break;
        }
      }
    }
  }
  
  const toast = document.createElement('div');
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  
  toast.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1a1f29 0%, #151921 100%);
      border: 1px solid ${colors[type]};
      border-radius: 12px;
      padding: 14px 20px;
      color: #e6e8ee;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${colors[type]}40;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 300px;
      max-width: 500px;
      pointer-events: auto;
      animation: toastSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: system-ui, 'Cairo', sans-serif;
      font-size: 14px;
      font-weight: 500;
      backdrop-filter: blur(10px);
    ">
      <span style="font-size: 20px; animation: iconBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);">${icons[type]}</span>
      <span style="flex: 1;">${message}</span>
    </div>
  `;
  
  // Add animation keyframes if not exists
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes toastSlideIn {
        from { 
          opacity: 0; 
          transform: translateX(100px) scale(0.8);
        }
        to { 
          opacity: 1; 
          transform: translateX(0) scale(1);
        }
      }
      @keyframes toastSlideOut {
        from { 
          opacity: 1; 
          transform: translateX(0) scale(1);
        }
        to { 
          opacity: 0; 
          transform: translateX(100px) scale(0.8);
        }
      }
      @keyframes iconBounce {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.3) rotate(10deg);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  container.appendChild(toast);
  activeToasts.set(message, toast);
  
  // Auto remove with smooth animation
  setTimeout(() => {
    const toastContent = toast.querySelector('div');
    if (toastContent) {
      toastContent.style.animation = 'toastSlideOut 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      toastContent.style.animationFillMode = 'forwards';
    }
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
      activeToasts.delete(message);
    }, 400);
  }, duration);
}

// ═════════════════════════════════════
// 🔄 LOADING SPINNER
// ═════════════════════════════════════
let isLoading = false;

function createSpinner() {
  if (document.getElementById('loading-spinner')) return;
  
  const spinner = document.createElement('div');
  spinner.id = 'loading-spinner';
  spinner.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    display: none;
  `;
  
  spinner.innerHTML = `
    <div style="
      width: 60px;
      height: 60px;
      border: 4px solid rgba(59, 130, 246, 0.1);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    "></div>
  `;
  
  // Add spin animation
  if (!document.getElementById('spinner-animations')) {
    const style = document.createElement('style');
    style.id = 'spinner-animations';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(spinner);
}

function showLoading() {
  createSpinner();
  const spinner = document.getElementById('loading-spinner');
  spinner.style.display = 'block';
  isLoading = true;
}

function hideLoading() {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.style.display = 'none';
  isLoading = false;
}

// ═════════════════════════════════════
// 🌐 API CALLS
// ═════════════════════════════════════
async function fetchInventory(useCache = true) {
  // Check cache first
  if (useCache) {
    const cached = InventoryCache.get('data');
    if (cached) {
      setTimeout(() => {
        showToast('📦 تم التحميل من الذاكرة المؤقتة', 'info', 1500);
      }, 8000);
      return cached;
    }
  }
  
  const params = new URLSearchParams();
  const imei = qImei.value.trim();
  const condition = fCondition.value;
  const status = fStatus.value;

  if (imei) params.set("imei", imei);
  if (condition) params.set("condition", condition);
  if (status) params.set("status", status);

  // إضافة warehouse_id للفلترة على مستوى الـ API
  const warehouseId = localStorage.getItem('currentWarehouseId');
  const isStorageWarehouse = localStorage.getItem('isStorageWarehouse') === 'true';
  console.log('[Inventory] fetchInventory - warehouseId:', warehouseId, 'isStorageWarehouse:', isStorageWarehouse);
  if (warehouseId && isStorageWarehouse) {
    // في مخزن تخزيني: اعرض فقط الأجهزة في هذا المخزن
    params.set("warehouse_id", warehouseId);
  } else {
    // في المخزن الرئيسي: اعرض فقط الأجهزة بدون warehouse_id (في المخزن الرئيسي)
    // لا نضيف warehouse_id للـ params، وسيقوم الـ API بعرض الأجهزة التي warehouse_id IS NULL
  }

  console.log('[Inventory] Fetching inventory with params:', params.toString());
  const res = await fetch("elos-db://inventory?" + params.toString());
  if (!res.ok) throw new Error(await res.text());

  const data = await res.json();

  // Cache the result
  InventoryCache.set('data', data);

  return data;
}

async function fetchInventoryStats(useCache = true) {
  // Check cache first
  if (useCache) {
    const cached = InventoryCache.get('stats');
    if (cached) {
      return cached;
    }
  }

  const params = new URLSearchParams();
  const imei = qImei.value.trim();
  const condition = fCondition.value;
  const status = fStatus.value;

  if (imei) params.set("imei", imei);
  if (condition) params.set("condition", condition);
  if (status) params.set("status", status);

  // إضافة warehouse_id للفلترة على مستوى الـ API
  const warehouseId = localStorage.getItem('currentWarehouseId');
  const isStorageWarehouse = localStorage.getItem('isStorageWarehouse') === 'true';
  if (warehouseId && isStorageWarehouse) {
    // في مخزن تخزيني: اعرض فقط الأجهزة في هذا المخزن
    params.set("warehouse_id", warehouseId);
  } else {
    // في المخزن الرئيسي: اعرض فقط الأجهزة بدون warehouse_id (في المخزن الرئيسي)
    // لا نضيف warehouse_id للـ params، وسيقوم الـ API بعرض الأجهزة التي warehouse_id IS NULL
  }

  const res = await fetch("elos-db://inventory-stats?" + params.toString());
  if (!res.ok) throw new Error(await res.text());

  const stats = await res.json();

  // Cache the result
  InventoryCache.set('stats', stats);

  return stats;
}

async function addDevice(payload) {
  const res = await fetch("elos-db://quick-add", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

// 📊 دالة تبديل حقل الباركود (تلقائي/يدوي)
window.toggleAddBarcodeField = function() {
  const barcodeType = document.querySelector('input[name="addBarcodeType"]:checked')?.value;
  const manualField = document.getElementById('addBarcodeManualField');
  const barcodeInput = document.getElementById('addBarcode');

  if (barcodeType === 'manual') {
    manualField.style.display = 'block';
    // التركيز على حقل الباركود للسماح بالمسح مباشرة
    setTimeout(() => barcodeInput?.focus(), 100);
  } else {
    manualField.style.display = 'none';
    if (barcodeInput) barcodeInput.value = '';
  }
};

async function sellDevice(id, price, name, phone) {
  const res = await fetch("elos-db://sell", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, price, name, phone })
  });
  if (!res.ok) {
    const reason = await res.text();
    throw new Error(reason || `HTTP ${res.status}`);
  }
  return await res.json();
}

async function updateDevice(id, payload) {
  const res = await fetch("elos-db://update-device", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, ...payload })
  });
  if (!res.ok) {
    const reason = await res.text();
    throw new Error(reason || `HTTP ${res.status}`);
  }
  return await res.json();
}

// ═════════════════════════════════════
// 🎨 RENDERING FUNCTIONS
// ═════════════════════════════════════

function getConditionLabel(condition) {
  const labels = {
    new: 'جديد',
    like_new: 'كالجديد',
    used: 'مستعمل',
    faulty: 'عاطل'
  };
  return labels[condition] || condition;
}

function getStatusLabel(status) {
  const labels = {
    in_stock: 'متاح',
    sold: 'مباع',
    reserved: 'محجوز',
    returned: 'مرتجع',
    scrapped: 'هالك',
    archived: 'أرشيف'
  };
  return labels[status] || status;
}

function rowHtml(d, i) {
  const canSell = d.status === "in_stock";
  const canArchive = d.status === "sold"; // Can only archive SOLD devices
  const canDelete = d.status === "in_stock" || d.status === "faulty" || d.status === "scrapped"; // يمكن حذف الأجهزة المتاحة أو العاطلة أو الهالكة

  const sellBtn = canSell
    ? `<button class="action-btn sell-btn" data-sell="${d.id}" data-ask="${d.expected_price || ''}" title="بيع الجهاز">💰</button>`
    : ``;

  const editBtn = `<button class="action-btn edit-btn" data-edit="${d.id}" title="تعديل الجهاز">✏️</button>`;

  const archiveBtn = canArchive
    ? `<button class="action-btn archive-btn" data-archive="${d.id}" title="أرشفة الجهاز">🗄️</button>`
    : ``;

  const deleteBtn = canDelete
    ? `<button class="action-btn delete-btn" data-delete="${d.id}" title="حذف الجهاز نهائياً">🗑️</button>`
    : ``;
  
  // Extract brand from model if it starts with a known brand
  let displayType = d.type || "—";
  let displayModel = d.model || "—";
  
  const brands = ['Apple', 'Samsung', 'Oppo', 'Realme', 'Vivo', 'Xiaomi', 'Nokia'];
  for (const brand of brands) {
    if (displayModel.startsWith(brand + ' ')) {
      displayType = brand;
      break;
    }
  }
  
  // ✅ استخدام type مباشرة لو موجود
  if (d.type && !displayType) {
    displayType = d.type;
  }
    
  const isDeviceSelected = selectedDevices.has(d.id);
  // الباركود القصير (6 أرقام)
  const shortCode = d.short_code || '';
  
  return `<tr class="row-${d.status} ${isDeviceSelected ? 'device-selected-row' : ''}" data-device-id="${d.id}" style="animation: fadeIn 0.3s ease-out ${i * 0.02}s both;">
    <td style="text-align: center;">
      <input type="checkbox" class="device-row-checkbox" data-id="${d.id}" data-model="${escapeHtml(displayModel)}" data-imei="${d.imei1 || ''}" ${isDeviceSelected ? 'checked' : ''} onchange="toggleDeviceSelection(this, ${d.id})" onclick="event.stopPropagation()">
    </td>
    <td><strong>${d.id}</strong></td>
    <td>${displayType}</td>
    <td><strong>${displayModel}</strong></td>
    <td>${d.storage || "—"}</td>
    <td class="num" style="font-family: monospace; color: var(--accent, #6366f1);" title="الباركود القصير">${shortCode || "—"}</td>
    <td class="num">${d.imei1 || "—"}</td>
    <td><span class="badge b-${d.condition}">${getConditionLabel(d.condition)}</span></td>
    <td class="num">${fmt(d.purchase_cost)}</td>
    <td class="num"><strong style="color: #10b981;">${fmt(d.expected_price)}</strong></td>
    <td><span class="badge b-${d.status}">${getStatusLabel(d.status)}</span></td>
    <td class="actions">
      <button class="action-btn details-btn" data-details="${d.id}" title="عرض التفاصيل">📋</button>
      ${editBtn}
      ${sellBtn}
      ${archiveBtn}
      ${deleteBtn}
    </td>
  </tr>`;
}

// ═════════════════════════════════════
// 📊 UPDATE KPIs
// ═════════════════════════════════════
async function updateKPIs() {
  const kCount = document.getElementById('kCount');
  const kCost = document.getElementById('kCost');
  const kAsk = document.getElementById('kAsk');

  // Show loading state
  kCount.classList.add('loading');
  kCost.classList.add('loading');
  kAsk.classList.add('loading');
  kCount.classList.remove('loaded');
  kCost.classList.remove('loaded');
  kAsk.classList.remove('loaded');

  kCount.textContent = '...';
  kCost.textContent = '...';
  kAsk.textContent = '...';

  try {
    // Fetch stats from backend
    const stats = await fetchInventoryStats();

    kCount.classList.remove('loading');
    kCost.classList.remove('loading');
    kAsk.classList.remove('loading');

    kCount.textContent = stats.count.toLocaleString();
    kCost.textContent = fmt(stats.totalCost);
    kAsk.textContent = fmt(stats.totalExpectedPrice);

    // Trigger fade-in animation
    kCount.classList.add('loaded');
    kCost.classList.add('loaded');
    kAsk.classList.add('loaded');
  } catch (error) {
    Logger.error('Error fetching stats:', error);

    kCount.classList.remove('loading');
    kCost.classList.remove('loading');
    kAsk.classList.remove('loading');

    kCount.textContent = '—';
    kCost.textContent = '—';
    kAsk.textContent = '—';

    showToast('خطأ في تحميل الإحصائيات', 'error', 2000);
  }
}

// ═════════════════════════════════════
// 🔍 FILTERING & SEARCH
// ═════════════════════════════════════
let currentList = [];
let filteredList = [];

// Infer brand (company) from device record (type + model)
function inferBrandFromDevice(item) {
  let displayType = item.type || "";
  let displayModel = item.model || "";

  const brands = ['Apple', 'Samsung', 'Oppo', 'Realme', 'Vivo', 'Huawei', 'Xiaomi', 'Nokia'];
  for (const brand of brands) {
    if (displayModel && displayModel.toLowerCase().startsWith((brand + ' ').toLowerCase())) {
      displayType = brand;
      break;
    }
  }

  // ✅ استخدام type مباشرة لو موجود ومش محدد من الموديل
  if (item.type && !displayType) {
    displayType = item.type;
  }

  return (displayType || '').trim();
}

function applyFilters() {
  const searchInput = document.getElementById('qText');
  const brandSelect = document.getElementById('fType');
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const brandFilter = brandSelect ? brandSelect.value : '';

  // Show searching indicator
  if (searchTerm.length > 0) {
    const existingIndicator = searchInput.parentElement.querySelector('.search-indicator');
    if (!existingIndicator) {
      const indicator = document.createElement('span');
      indicator.className = 'search-indicator';
      indicator.innerHTML = '🔍';
      indicator.style.cssText = `
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 16px;
        animation: pulse 1s ease-in-out infinite;
      `;
      searchInput.parentElement.style.position = 'relative';
      searchInput.parentElement.appendChild(indicator);
      
      // Add pulse animation if not exists
      if (!document.getElementById('search-indicator-animation')) {
        const style = document.createElement('style');
        style.id = 'search-indicator-animation';
        style.textContent = `
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: translateY(-50%) scale(1); }
            50% { opacity: 0.5; transform: translateY(-50%) scale(0.95); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }

  filteredList = currentList.filter(item => {
    // Hide archived devices from main inventory view
    if (item.status === 'archived') return false;

    // Warehouse filter (إذا كان warehouse_id موجود في localStorage)
    const warehouseId = localStorage.getItem('currentWarehouseId');
    const isStorageWarehouse = localStorage.getItem('isStorageWarehouse') === 'true';

    if (warehouseId && isStorageWarehouse) {
      // في المخزن التخزيني: اعرض فقط الأجهزة اللي ليها نفس الـ warehouse_id
      if (!item.warehouse_id || item.warehouse_id != warehouseId) {
        return false;
      }
    } else if (!isStorageWarehouse) {
      // في المخزن الرئيسي: اعرض الأجهزة بدون warehouse_id أو المرتبطة بمخزن الأجهزة الرئيسي
      if (item.warehouse_id && (!mainDeviceWarehouseId || String(item.warehouse_id) !== String(mainDeviceWarehouseId))) {
        return false;
      }
    }

    // Brand filter (company)
    if (brandFilter) {
      const b = inferBrandFromDevice(item).toLowerCase();
      if (b !== brandFilter.toLowerCase()) return false;
    }

    // Text search
    if (!searchTerm) return true;

    const model = (item.model || '').toLowerCase();
    const storage = (item.storage || '').toLowerCase();
    const imei1 = (item.imei1 || '').toLowerCase();
    const imei2 = (item.imei2 || '').toLowerCase();
    const type = (item.type || '').toLowerCase();
    const brandName = inferBrandFromDevice(item).toLowerCase();
    const source = (item.source || '').toLowerCase();
    const notes = (item.notes || '').toLowerCase();

    return (
      model.includes(searchTerm) ||
      storage.includes(searchTerm) ||
      imei1.includes(searchTerm) ||
      imei2.includes(searchTerm) ||
      type.includes(searchTerm) ||
      brandName.includes(searchTerm) ||
      source.includes(searchTerm) ||
      notes.includes(searchTerm)
    );
  });

  // Remove search indicator after filtering
  const indicator = document.querySelector('.search-indicator');
  if (indicator) {
    setTimeout(() => indicator.remove(), 100);
  }

  applySorting();
  renderTable();
  
  // Note: We don't call updateKPIs here anymore because filters affect both
  // backend query AND frontend filtering. The KPIs should reflect backend data only.
}
// ═════════════════════════════════════
// 🔄 SORTING FUNCTION
// ═════════════════════════════════════
function applySorting() {
  // Default sort: in_stock first, then by ID descending
  filteredList.sort((a, b) => {
    // If no custom sort, prioritize in_stock status
    if (!sortColumn) {
      // in_stock items come first
      if (a.status === 'in_stock' && b.status !== 'in_stock') return -1;
      if (a.status !== 'in_stock' && b.status === 'in_stock') return 1;
      // Then sort by ID descending (newest first)
      return b.id - a.id;
    }
    
    // Custom sorting
    let valA = a[sortColumn];
    let valB = b[sortColumn];
    
    // Handle numeric fields
    if (sortColumn === 'id' || sortColumn === 'purchase_cost' || sortColumn === 'expected_price') {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else {
      // Convert to string for text comparison
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return valA > valB ? 1 : valA < valB ? -1 : 0;
    } else {
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    }
  });
  
  // Update header indicators - use cached selector for better performance
  const sortableHeaders = document.querySelectorAll('.tbl th[data-sort]');
  sortableHeaders.forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.getAttribute('data-sort') === sortColumn) {
      th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

function initSortHandlers() {
  document.querySelectorAll('.tbl th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.getAttribute('data-sort');
      
      if (sortColumn === column) {
        // Toggle direction
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        // New column
        sortColumn = column;
        sortDirection = 'asc';
      }
      
      applySorting();
      renderTable();
      
      showToast(`تم الترتيب حسب ${th.textContent.trim()} ${sortDirection === 'asc' ? '↑' : '↓'}`, 'info', 2000);
    });
  });
}

function renderTable() {
  const tbody = document.getElementById("rows");
  const empty = document.getElementById("empty");
  const resCount = document.getElementById("resCount");
  
  // Add fade-in animation CSS if not exists
  if (!document.getElementById('table-animations')) {
    const style = document.createElement('style');
    style.id = 'table-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
  
  if (filteredList.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    updatePaginationUI(0);
  } else {
    empty.style.display = 'none';
    
    // Apply pagination
    totalDevices = filteredList.length;
    let devicesToShow = filteredList;
    
    if (!viewingAll) {
      const start = (currentPage - 1) * rowsPerPage;
      const end = start + rowsPerPage;
      devicesToShow = filteredList.slice(start, end);
    }
    
    tbody.innerHTML = devicesToShow.map((row, i) => rowHtml(row, i)).join("");

    // Update pagination UI
    updatePaginationUI(totalDevices);

    // ✅ تهيئة Event Delegation مرة واحدة فقط (بدلاً من إضافة listeners في كل render)
    initEventDelegation();

    // ✅ إضافة cursor pointer للصفوف (CSS فقط، بدون listeners)
    tbody.querySelectorAll("tr").forEach((row) => {
      row.style.cursor = 'pointer';
    });
  }
  
  resCount.textContent = filteredList.length.toLocaleString();
}

// ═════════════════════════════════════

// 📋 DEVICE DETAILS MODAL
// ═════════════════════════════════════

function openInventoryDeviceModal(device) {
  if (!device) {
    showToast('لم يتم العثور على الجهاز', 'error');
    return;
  }

  const detailContent = document.getElementById('detailContent');

  // Extract brand from model
  let displayType = device.type || "—";
  let displayModel = device.model || "—";

  const brands = ['Apple', 'Samsung', 'Oppo', 'Realme', 'Vivo', 'Xiaomi', 'Nokia'];
  for (const brand of brands) {
    if (displayModel && displayModel.startsWith(brand + ' ')) {
      displayType = brand;
      break;
    }
  }

  // ✅ استخدام type مباشرة لو موجود ومش محدد من الموديل
  if (device.type && !displayType) {
    displayType = device.type;
  }

  // Status text and colors
  const statusText = {
    'in_stock': '✅ متوفر في المخزن',
    'sold': '🔴 مباع',
    'reserved': '🟡 محجوز',
    'returned': '🔄 مرتجع',
    'scrapped': '❌ خردة'
  };
  
  const statusColors = {
    'in_stock': 'var(--success)',
    'sold': 'var(--danger)',
    'reserved': 'var(--warning)',
    'returned': 'var(--cyan)',
    'scrapped': 'var(--text-secondary)'
  };

  // Build battery info from device field directly (only for Apple devices)
  let batteryHTML = '';
  const batteryValue = device.battery_health;
  const isAppleDevice = displayType === 'Apple' || device.type === 'Apple';
  
  if (isAppleDevice && batteryValue !== null && batteryValue !== undefined && batteryValue !== '') {
    const batteryNum = Number(batteryValue);
    if (!isNaN(batteryNum) && batteryNum > 0) {
      let color = '#ef4444';
      if (batteryNum >= 80) color = '#10b981';
      else if (batteryNum >= 60) color = '#f59e0b';

      batteryHTML = `
        <div class="info-row">
          <span class="info-label">🔋 صحة البطارية:</span>
          <span class="info-value" style="color: ${color};">${batteryNum}%</span>
        </div>
      `;
    }
  }

  // Build box info from device field directly
  let hasBox = false;
  if (typeof device.has_box === 'boolean') {
    hasBox = device.has_box;
  } else if (typeof device.has_box === 'number') {
    hasBox = device.has_box === 1;
  } else if (typeof device.has_box === 'string') {
    hasBox = device.has_box === 'true' || device.has_box === '1';
  }

  const boxStatus = hasBox ? '✓ مع كرتونة' : '✗ بدون كرتونة';
  const boxColor = hasBox ? '#10b981' : '#8b93a6';

  // Source name from device field directly
  const sourceName = device.source || '—';

  // Storage
  const storage = device.storage || device.capacity || '—';

  // Notes - clean user notes
  const notes = device.notes || '';

  // Purchase / created date
  let dateDisplay = '—';
  if (device.purchase_date) {
    try {
      dateDisplay = new Date(device.purchase_date).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      dateDisplay = device.purchase_date;
    }
  } else if (device.created_at) {
    try {
      dateDisplay = new Date(device.created_at).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      dateDisplay = device.created_at;
    }
  }

  const cost = Number(device.purchase_cost || device.cost || 0);
  const expected = Number(device.expected_price || device.price || 0);
  const ntraTax = Number(device.ntra_tax || 0);
  const margin = expected - cost; // الهامش من غير الضريبة
  const marginPct = cost > 0 ? ((margin / cost) * 100).toFixed(1) : 0;

  // Build NTRA tax HTML (only show if tax exists)
  let ntraTaxHTML = '';
  if (ntraTax > 0) {
    ntraTaxHTML = `
      <div class="info-row">
        <span class="info-label">🏛️ ضريبة NTRA:</span>
        <span class="info-value" style="color: var(--warning);">${fmt(ntraTax)} جنيه</span>
      </div>
    `;
  }

  // تحديد اسم المخزن
  let warehouseDisplayName = 'مخزن الأجهزة الرئيسي';
  let warehouseIcon = '📦';
  if (device.warehouse_display_name) {
    warehouseDisplayName = device.warehouse_display_name;
    warehouseIcon = device.warehouse_icon || '📦';
  } else if (device.warehouse_name) {
    warehouseDisplayName = device.warehouse_name;
    warehouseIcon = device.warehouse_icon || '📦';
  } else if (device.warehouse_id) {
    warehouseDisplayName = 'مخزن تخزيني';
  }

  detailContent.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">📱 معلومات الجهاز</div>

      <div class="info-row">
        <span class="info-label">رقم التعريف:</span>
        <span class="info-value" style="color: var(--accent);">#${device.id}</span>
      </div>

      <div class="info-row">
        <span class="info-label">IMEI 1:</span>
        <span class="info-value" style="font-family: monospace; color: var(--cyan);">${device.imei1 || device.imei_1 || '—'}</span>
      </div>

      <div class="info-row">
        <span class="info-label">IMEI 2:</span>
        <span class="info-value" style="font-family: monospace; color: var(--cyan);">${device.imei2 || device.imei_2 || '—'}</span>
      </div>

      <div class="info-row">
        <span class="info-label">الحالة:</span>
        <span class="info-value" style="color: ${statusColors[device.status]};">${statusText[device.status] || device.status}</span>
      </div>

      <div class="info-row">
        <span class="info-label">📍 المخزن:</span>
        <span class="info-value" style="color: var(--purple); font-weight: 600;">${warehouseIcon} ${warehouseDisplayName}</span>
      </div>
    </div>
    
    <div class="detail-section">
      <div class="detail-section-title">📋 المواصفات</div>
      
      <div class="info-row">
        <span class="info-label">النوع:</span>
        <span class="info-value">${displayType}</span>
      </div>
      
      <div class="info-row">
        <span class="info-label">الموديل:</span>
        <span class="info-value">${displayModel}</span>
      </div>
      
      <div class="info-row">
        <span class="info-label">السعة:</span>
        <span class="info-value">${storage}</span>
      </div>
      
      <div class="info-row">
        <span class="info-label">اللون:</span>
        <span class="info-value">${escapeHtml(device.color || 'غير محدد')}</span>
      </div>

      ${!isAppleDevice && device.ram ? `
      <div class="info-row">
        <span class="info-label">💾 الرام:</span>
        <span class="info-value" style="color: var(--purple);">${escapeHtml(device.ram)}</span>
      </div>
      ` : ''}

      <div class="info-row">
        <span class="info-label">الحالة العامة:</span>
        <span class="info-value">${getConditionLabel(device.condition)}</span>
      </div>

      ${batteryHTML}
      
      <div class="info-row">
        <span class="info-label">الكرتونة:</span>
        <span class="info-value" style="color: ${boxColor};">${boxStatus}</span>
      </div>
    </div>
    
    <div class="detail-section">
      <div class="detail-section-title">💰 الأسعار والتكلفة</div>
      
      <div class="info-row">
        <span class="info-label">التكلفة:</span>
        <span class="info-value" style="color: var(--danger);">${fmt(cost)} جنيه</span>
      </div>
      
      ${ntraTaxHTML}
      
      <div class="info-row">
        <span class="info-label">السعر المتوقع:</span>
        <span class="info-value" style="color: var(--success);">${fmt(expected)} جنيه</span>
      </div>
      
      <div class="info-row">
        <span class="info-label">الهامش:</span>
        <span class="info-value" style="color: ${margin >= 0 ? 'var(--success)' : 'var(--danger)'};">
          ${fmt(margin)} جنيه (${marginPct}%)
        </span>
      </div>
    </div>
    
    <div class="detail-section">
      <div class="detail-section-title">ℹ️ معلومات إضافية</div>
      
      <div class="info-row">
        <span class="info-label">المصدر:</span>
        <span class="info-value" style="color: var(--cyan);">${sourceName}</span>
      </div>
      
      <div class="info-row">
        <span class="info-label">تاريخ الإضافة:</span>
        <span class="info-value">${dateDisplay}</span>
      </div>
      
      ${notes ? `
      <div class="info-row" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); flex-direction: column; align-items: flex-start;">
        <span class="info-label" style="margin-bottom: 8px;">ملاحظات:</span>
        <span class="info-value" style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; white-space: pre-wrap;">
          ${notes}
        </span>
      </div>
      ` : ''}
    </div>

    <!-- Barcode Print Button -->
    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border); text-align: center;">
      <button id="btnPrintDeviceBarcode" style="
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        font-family: 'Cairo', sans-serif;
        transition: all 0.2s ease;
      " onmouseover="this.style.background='linear-gradient(135deg, #7c3aed, #6d28d9)'; this.style.transform='translateY(-2px)';"
         onmouseout="this.style.background='linear-gradient(135deg, #8b5cf6, #7c3aed)'; this.style.transform='translateY(0)';">
        🏷️ طباعة باركود
      </button>
    </div>
  `;

  document.getElementById('detailModal').style.display = 'flex';

  // Add barcode print button event
  document.getElementById('btnPrintDeviceBarcode').onclick = () => {
    // ✅ استخدام modal المعاينة أولاً - يعرض الخيارات قبل الطباعة
    // Priority 1: BarcodeGenerator.showBarcodePreviewModal (من barcode-generator.js)
    // ✅ التحقق من وجود BarcodeGenerator.showBarcodePreviewModal
    Logger.log('[PRINT] Checking BarcodeGenerator:', typeof window.BarcodeGenerator);
    Logger.log('[PRINT] showBarcodePreviewModal:', typeof (window.BarcodeGenerator?.showBarcodePreviewModal));
    
    if (window.BarcodeGenerator && typeof window.BarcodeGenerator.showBarcodePreviewModal === 'function') {
      try {
        // ✅ استخدام barcode أو code أولاً (لضمان استخدام القيمة الكاملة مثل 10277)
        // ثم نستخدم short_code فقط إذا لم يكن barcode أو code موجودين
        const barcodeCode = device.barcode || device.code || device.short_code;
        // ✅ V24.15: أولوية لـ short_code (4 أرقام) للقراءة السريعة بالاسكانر
        const deviceData = {
          ...device,
          short_code: device.short_code || device.barcode || device.code,
          barcode: device.short_code || device.barcode || device.code, // استخدام short_code أولاً
          code: device.short_code || device.code || device.barcode
        };
        
        Logger.log('[PRINT] ✅ Calling showBarcodePreviewModal with device:', device.id, device.model);
        Logger.log('[PRINT] Device barcode fields:', { 
          barcode: device.barcode, 
          code: device.code, 
          short_code: device.short_code,
          final_barcode: deviceData.barcode 
        });
        
        // ✅ استدعاء modal المعاينة الذي يسمح باختيار:
        // - نوع الملصق (عادي/مقسوم)
        // - إظهار السعر أم لا
        // - عدد النسخ
        // ثم يطبع بعد اختيار الإعدادات
        window.BarcodeGenerator.showBarcodePreviewModal(deviceData, 'device');
        Logger.log('[PRINT] ✅ showBarcodePreviewModal called successfully');
        return;
      } catch (error) {
        Logger.error('[PRINT] ❌ Error opening preview modal:', error);
        Logger.error('[PRINT] Error stack:', error.stack);
        showToast('خطأ في فتح نافذة المعاينة: ' + error.message, 'error');
      }
    } else {
      Logger.warn('[PRINT] ⚠️ BarcodeGenerator.showBarcodePreviewModal not available');
      Logger.warn('[PRINT] BarcodeGenerator type:', typeof window.BarcodeGenerator);
      if (window.BarcodeGenerator) {
        Logger.warn('[PRINT] Available methods:', Object.keys(window.BarcodeGenerator));
      }
    }
    
    // Fallback: استخدام BarcodeService.printBarcodes مباشرة (ليس مفضل)
    if (typeof BarcodeService !== 'undefined') {
      Logger.warn('[PRINT] ⚠️ Using BarcodeService.printBarcodes directly (preview modal not available)');
      BarcodeService.printBarcodes(device, {
        type: 'device',
        labelType: 'single',
        copies: 1,
        showPrice: true
      });
    } else {
      showToast('مكتبة الباركود غير متاحة', 'error');
    }
  };
}

function showDeviceDetails(deviceId) {
  const device = currentList.find(d => d.id === deviceId);
  if (!device) {
    showToast('لم يتم العثور على الجهاز', 'error');
    return;
  }
  openInventoryDeviceModal(device);
}

document.getElementById('btnCloseDetail').addEventListener('click', () => {
  document.getElementById('detailModal').style.display = 'none';
});

window.openInventoryDeviceModal = openInventoryDeviceModal;

// ═════════════════════════════════════
// 🔄 MAIN RENDER FUNCTION
// ═════════════════════════════════════
async function render() {

  try {
    showLoading();
    
    currentList = await fetchInventory();
    filteredList = [...currentList];

    // Calculate KPIs from loaded data (fallback if backend stats fail)
    try {
      const stats = await fetchInventoryStats();

      const kCount = document.getElementById('kCount');
      const kCost = document.getElementById('kCost');
      const kAsk = document.getElementById('kAsk');

      kCount.classList.remove('loading');
      kCost.classList.remove('loading');
      kAsk.classList.remove('loading');

      kCount.textContent = stats.count.toLocaleString();
      kCost.textContent = fmt(stats.totalCost);
      kAsk.textContent = fmt(stats.totalExpectedPrice);

      // Trigger fade-in animation
      kCount.classList.add('loaded');
      kCost.classList.add('loaded');
      kAsk.classList.add('loaded');
    } catch (statsError) {
      Logger.warn('[RENDER] Backend stats failed, using frontend calculation:', statsError);

      // Fallback: calculate from current data
      const count = currentList.length;
      const totalCost = currentList.reduce((sum, item) => sum + Number(item.purchase_cost || 0), 0);
      const totalAsk = currentList.reduce((sum, item) => sum + Number(item.expected_price || 0), 0);

      const kCount = document.getElementById('kCount');
      const kCost = document.getElementById('kCost');
      const kAsk = document.getElementById('kAsk');

      kCount.classList.remove('loading');
      kCost.classList.remove('loading');
      kAsk.classList.remove('loading');

      kCount.textContent = count.toLocaleString();
      kCost.textContent = fmt(totalCost);
      kAsk.textContent = fmt(totalAsk);
    }

    applyFilters();

    // Use count from backend stats (more accurate)
    const kCount = document.getElementById('kCount');
    const displayCount = kCount ? parseInt(kCount.textContent.replace(/,/g, '')) : filteredList.length;

    // إظهار Toast فوراً بدون تأخير - في SPA mode نستخدم toast أخف
    if (!window.isSpaMode) {
      if (displayCount === 0) {
        showToast('لا توجد أجهزة في المخزون', 'info', 2000);
      } else {
        showToast(`📦 ${displayCount.toLocaleString()} جهاز`, 'success', 1500);
      }
    }
  } catch (error) {
    Logger.error('Render error:', error);
    showToast('حدث خطأ أثناء تحميل البيانات: ' + error.message, 'error');
    currentList = [];
    filteredList = [];
    renderTable();
  } finally {
    hideLoading();
  }
}

// ═════════════════════════════════════
// ➕ ADD DEVICE MODAL - Enhanced Logic
// ═════════════════════════════════════

// Handle Type Selection (show custom type field if "Other" is selected)
// Toggle RAM/Battery fields based on device type
window.toggleAddDeviceFields = function() {
  const typeValue = document.getElementById("addType").value;
  const customTypeField = document.getElementById("customTypeField");
  const batteryField = document.getElementById("addBatteryField");
  const ramField = document.getElementById("addRamField");
  const customTypeInput = document.getElementById("addCustomType");
  const batteryInput = document.getElementById("addBattery");
  const ramInput = document.getElementById("addRam");

  // Optional "Other" type handling – only if the extra field exists
  if (customTypeField) {
    if (typeValue === "Other") {
      customTypeField.style.display = "block";
    } else {
      customTypeField.style.display = "none";
      if (customTypeInput) customTypeInput.value = "";
    }
  }

  // Apple: Show battery, Hide RAM — توافق: أيفون/أبل = بطارية 100% افتراضياً
  if (typeValue === "Apple") {
    if (batteryField) batteryField.style.display = "block";
    if (ramField) ramField.style.display = "none";
    if (ramInput) ramInput.value = "";
    if (batteryInput) batteryInput.value = "100";
  } else {
    if (batteryField) {
      batteryField.style.display = "none";
      if (batteryInput) batteryInput.value = "";
    }
    if (ramField) ramField.style.display = "block";
  }
};

document.getElementById("addType").addEventListener("change", window.toggleAddDeviceFields);

// توافق: عند اختيار "جديد" → مع كرتونة افتراضياً
const addConditionEl = document.getElementById("addCondition");
if (addConditionEl) {
  addConditionEl.addEventListener("change", function() {
    const addBox = document.getElementById("addBox");
    if (addBox && this.value === "new") addBox.value = "with_box";
  });
}

// Handle Source Type Selection
document.getElementById("addSourceType").addEventListener("change", async (e) => {
  const customerField = document.getElementById("customerSourceField");
  const supplierField = document.getElementById("supplierSourceField");
  const customField = document.getElementById("customSourceField");
  
  // Hide all fields first
  customerField.style.display = "none";
  supplierField.style.display = "none";
  customField.style.display = "none";
  
  if (e.target.value === "customer") {
    customerField.style.display = "block";
    await loadCustomers();
  } else if (e.target.value === "supplier") {
    supplierField.style.display = "block";
    await loadSuppliers();
  } else if (e.target.value === "custom") {
    customField.style.display = "block";
  }
});

// Load Customers List
async function loadCustomers() {
  const select = document.getElementById("addCustomerSource");
  select.innerHTML = '<option value="">-- جاري التحميل... --</option>';
  
  try {
    const res = await fetch("elos-db://clients"); // تغيير من customers إلى clients
    if (!res.ok) {
      // If clients endpoint doesn't exist, show custom input
      select.innerHTML = '<option value="">غير متوفر - استخدم الكتابة اليدوية</option>';
      showToast("قائمة العملاء غير متوفرة حالياً. استخدم الكتابة اليدوية بدلاً من ذلك", "info", 4000);
      
      // Auto switch to custom input
      setTimeout(() => {
        document.getElementById("addSourceType").value = "custom";
        document.getElementById("customerSourceField").style.display = "none";
        document.getElementById("customSourceField").style.display = "block";
      }, 500);
      return;
    }
    
    const customers = await res.json();
    select.innerHTML = '<option value="">-- اختر عميل --</option>';
    
    if (!customers || customers.length === 0) {
      select.innerHTML += '<option value="">لا يوجد عملاء</option>';
      return;
    }
    
    customers.forEach(customer => {
      const option = document.createElement("option");
      option.value = customer.name;
      option.textContent = `${customer.name} ${customer.phone ? '(' + customer.phone + ')' : ''}`;
      select.appendChild(option);
    });
  } catch (error) {
    Logger.error("Error loading customers:", error);
    select.innerHTML = '<option value="">غير متوفر - استخدم الكتابة اليدوية</option>';
    
    // Auto switch to custom input
    setTimeout(() => {
      document.getElementById("addSourceType").value = "custom";
      document.getElementById("customerSourceField").style.display = "none";
      document.getElementById("customSourceField").style.display = "block";
    }, 500);
  }
}

// Load Suppliers List
async function loadSuppliers() {
  const select = document.getElementById("addSupplierSource");
  select.innerHTML = '<option value="">-- جاري التحميل... --</option>';
  
  try {
    const res = await fetch("elos-db://suppliers");
    if (!res.ok) {
      // If suppliers endpoint doesn't exist, show custom input
      select.innerHTML = '<option value="">غير متوفر - استخدم الكتابة اليدوية</option>';
      showToast("قائمة الموردين غير متوفرة حالياً. استخدم الكتابة اليدوية بدلاً من ذلك", "info", 4000);
      
      // Auto switch to custom input
      setTimeout(() => {
        document.getElementById("addSourceType").value = "custom";
        document.getElementById("supplierSourceField").style.display = "none";
        document.getElementById("customSourceField").style.display = "block";
      }, 500);
      return;
    }
    
    const suppliers = await res.json();
    select.innerHTML = '<option value="">-- اختر مورد --</option>';
    
    if (!suppliers || suppliers.length === 0) {
      select.innerHTML += '<option value="">لا يوجد موردين</option>';
      return;
    }
    
    suppliers.forEach(supplier => {
      const option = document.createElement("option");
      option.value = supplier.name;
      option.textContent = `${supplier.name} ${supplier.contact ? '(' + supplier.contact + ')' : ''}`;
      select.appendChild(option);
    });
  } catch (error) {
    Logger.error("Error loading suppliers:", error);
    select.innerHTML = '<option value="">غير متوفر - استخدم الكتابة اليدوية</option>';
    
    // Auto switch to custom input
    setTimeout(() => {
      document.getElementById("addSourceType").value = "custom";
      document.getElementById("supplierSourceField").style.display = "none";
      document.getElementById("customSourceField").style.display = "block";
    }, 500);
  }
}

document.getElementById("openAddModal").addEventListener("click", () => {
  // Reset form safely (handle optional fields)
  const addType = document.getElementById("addType");
  const customTypeField = document.getElementById("customTypeField");
  const customTypeInput = document.getElementById("addCustomType");
  const batteryField = document.getElementById("addBatteryField");
  const ramField = document.getElementById("addRamField");

  if (addType) addType.value = "";

  if (customTypeField) customTypeField.style.display = "none";
  if (customTypeInput) customTypeInput.value = "";

  const addSourceType = document.getElementById("addSourceType");
  if (addSourceType) addSourceType.value = "";

  const customerSourceField = document.getElementById("customerSourceField");
  const supplierSourceField = document.getElementById("supplierSourceField");
  const customSourceField = document.getElementById("customSourceField");

  if (customerSourceField) customerSourceField.style.display = "none";
  if (supplierSourceField) supplierSourceField.style.display = "none";
  if (customSourceField) customSourceField.style.display = "none";

  const addModel = document.getElementById("addModel");
  const addStorage = document.getElementById("addStorage");
  const addCondition = document.getElementById("addCondition");

  if (addModel) addModel.value = "";
  if (addStorage) addStorage.value = "";
  if (addCondition) addCondition.value = "used";

  // Reset RAM & Battery fields - both hidden initially
  if (batteryField) batteryField.style.display = "none";
  if (ramField) ramField.style.display = "block"; // RAM visible by default (non-Apple)
  const addBattery = document.getElementById("addBattery");
  const addRam = document.getElementById("addRam");
  if (addBattery) addBattery.value = "";
  if (addRam) addRam.value = "";

  const addBox = document.getElementById("addBox");
  if (addBox) addBox.value = "with_box";

  const addImei1 = document.getElementById("addImei1");
  const addImei2 = document.getElementById("addImei2");
  const addCost = document.getElementById("addCost");
  const addPrice = document.getElementById("addPrice");
  const addNotes = document.getElementById("addNotes");
  const addNtraTax = document.getElementById("addNtraTax");
  const addColor = document.getElementById("addColor");

  if (addImei1) addImei1.value = "";
  if (addImei2) addImei2.value = "";
  if (addCost) addCost.value = "";
  if (addPrice) addPrice.value = "";
  if (addNotes) addNotes.value = "";
  if (addNtraTax) addNtraTax.value = "";
  if (addColor) addColor.value = "";

  // 📊 إعادة تعيين حقل الباركود
  const barcodeAutoRadio = document.querySelector('input[name="addBarcodeType"][value="auto"]');
  if (barcodeAutoRadio) barcodeAutoRadio.checked = true;
  const addBarcodeManualField = document.getElementById('addBarcodeManualField');
  if (addBarcodeManualField) addBarcodeManualField.style.display = 'none';
  const addBarcode = document.getElementById('addBarcode');
  if (addBarcode) addBarcode.value = '';

  const addModal = document.getElementById("addModal");
  if (addModal) {
    addModal.style.display = "flex";
  }

  // Focus on type selection (if available)
  if (addType) {
    setTimeout(() => {
      addType.focus();
    }, 100);
  }
});

document.getElementById("btnCancelAdd").addEventListener("click", () => {
  document.getElementById("addModal").style.display = "none";
});

// Close modal on outside click
window.addEventListener("click", (e) => {
  const addModal = document.getElementById("addModal");
  const detailModal = document.getElementById("detailModal");
  
  if (e.target === addModal) {
    addModal.style.display = "none";
  }
  if (e.target === detailModal) {
    detailModal.style.display = "none";
  }
});

// متغير لمنع الضغط المتكرر على زر الإضافة
let isAddingDevice = false;

document.getElementById("btnConfirmAdd").addEventListener("click", async () => {
  // حماية ضد الضغط المتكرر
  if (isLoading || isAddingDevice) return;
  isAddingDevice = true;

  // Disable the button immediately
  const addBtn = document.getElementById("btnConfirmAdd");
  if (addBtn) addBtn.disabled = true;

  try {
    await handleAddDevice();
  } finally {
    isAddingDevice = false;
    if (addBtn) addBtn.disabled = false;
  }
});

async function handleAddDevice() {
  // Get device type
  let deviceType = document.getElementById("addType").value;
  let deviceBrand = deviceType; // Store original brand

  console.log('[ADD] Device type selected:', deviceType);

  if (deviceType === "Other") {
    const customTypeEl = document.getElementById("addCustomType");
    deviceBrand = customTypeEl ? customTypeEl.value.trim() : '';
    console.log('[ADD] Custom type value:', deviceBrand);
  }

  // ✅ استخدام اسم الشركة مباشرة (Apple, Samsung, etc.)
  let dbType = deviceBrand || deviceType;
  console.log('[ADD] Final dbType:', dbType);

  // Get source
  let sourceName = "";
  const sourceType = document.getElementById("addSourceType").value;
  if (sourceType === "customer") {
    sourceName = document.getElementById("addCustomerSource").value;
  } else if (sourceType === "supplier") {
    sourceName = document.getElementById("addSupplierSource").value;
  } else if (sourceType === "custom") {
    sourceName = document.getElementById("addCustomSource").value.trim();
  }
  
  // Build model with brand prefix if needed
  let modelValue = document.getElementById("addModel").value.trim();
  
  // If not Apple, prepend brand to model for clarity
  if (deviceType !== "Apple" && deviceType !== "Other" && deviceBrand && !modelValue.toLowerCase().includes(deviceBrand.toLowerCase())) {
    modelValue = `${deviceBrand} ${modelValue}`;
  } else if (deviceType === "Other" && deviceBrand) {
    modelValue = `${deviceBrand} ${modelValue}`;
  }
  
  // Get battery health for Apple devices
  let batteryHealth = null;
  const batteryInput = document.getElementById("addBattery");
  if (deviceType === "Apple") {
    const batteryVal = batteryInput ? batteryInput.value.trim() : "";
    if (!batteryVal) {
      showToast('رجاء إدخال نسبة البطارية لأجهزة Apple', 'warning');
      if (batteryInput) batteryInput.focus();
      return;
    }
    const batteryNum = Number(batteryVal);
    if (isNaN(batteryNum) || batteryNum <= 0 || batteryNum > 100) {
      showToast('قيمة البطارية يجب أن تكون بين 1 و 100', 'warning');
      if (batteryInput) batteryInput.focus();
      return;
    }
    batteryHealth = batteryNum;
  }

  // Get user notes (just the notes, no metadata)
  const userNotes = document.getElementById("addNotes").value.trim();

  // Build payload - send clean data to DB
  // Check if we're in a storage warehouse context
  const currentWarehouseId = localStorage.getItem('currentWarehouseId');
  const isStorageWarehouse = localStorage.getItem('isStorageWarehouse') === 'true';
  
  // Only set warehouse_id if we're in a storage warehouse context
  let warehouseIdValue = null;
  if (isStorageWarehouse && currentWarehouseId) {
    warehouseIdValue = parseInt(currentWarehouseId);
    console.log('[ADD] ✅ Adding device to storage warehouse:', warehouseIdValue);
  } else {
    console.log('[ADD] ℹ️ Not in storage warehouse context. warehouse_id will be null');
  }

  // 📊 تحديد الباركود (تلقائي أو يدوي)
  const barcodeType = document.querySelector('input[name="addBarcodeType"]:checked')?.value || 'auto';
  const manualBarcode = document.getElementById("addBarcode")?.value.trim() || '';

  const payload = {
    type: dbType, // Use iPhone or Android for DB
    source: sourceName, // Now will be saved in DB
    model: modelValue, // Model now includes brand
    storage: document.getElementById("addStorage").value.trim(),
    ram: document.getElementById("addRam").value.trim(),
    color: document.getElementById("addColor").value.trim(),
    condition: document.getElementById("addCondition").value,
    battery_health: batteryHealth, // Will be saved in DB
    has_box: document.getElementById("addBox").value === "with_box", // Will be saved in DB
    imei1: document.getElementById("addImei1").value.trim(),
    imei2: document.getElementById("addImei2").value.trim(),
    purchase_cost: Number(document.getElementById("addCost").value || 0),
    expected_price: Number(document.getElementById("addPrice").value || 0),
    ntra_tax: Number(document.getElementById("addNtraTax").value || 0), // NTRA customs tax
    notes: userNotes, // Clean user notes only
    warehouse_id: warehouseIdValue, // Link to storage warehouse (only if in storage context)
    // 📊 الباركود اليدوي (إذا تم اختياره)
    short_code: barcodeType === 'manual' && manualBarcode ? manualBarcode : null,
  };

  console.log('[ADD] Payload to send:', JSON.stringify(payload, null, 2));
  console.log('[ADD] Warehouse context:', { currentWarehouseId, isStorageWarehouse, warehouseIdValue });
  
  // Validation
  if (!deviceBrand) {
    showToast('رجاء اختيار الشركة', 'warning');
    document.getElementById("addType").focus();
    return;
  }
  
  if (deviceType === "Other" && document.getElementById("addCustomType") && !document.getElementById("addCustomType").value.trim()) {
    showToast('رجاء إدخال اسم النوع', 'warning');
    document.getElementById("addCustomType").focus();
    return;
  }
  
  if (!document.getElementById("addModel").value.trim()) {
    showToast('رجاء إدخال الموديل', 'warning');
    document.getElementById("addModel").focus();
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // 🚫 IMEI CHECK - التحقق من IMEI قبل الإضافة
  // ═══════════════════════════════════════════════════════════════
  const imei1 = payload.imei1;
  const imei2 = payload.imei2;

  if (imei1 && imei1.length >= 10) {
    try {
      const checkRes = await fetch(`elos-db://check-imei/${imei1}`);
      const checkData = await checkRes.json();

      if (checkData.warnings && checkData.warnings.length > 0) {
        let warningMessages = checkData.warnings.map(w => {
          if (w.type === 'blacklist') {
            return `🚫 تحذير خطير!\n${w.message}\nالسبب: ${w.reason}\nالمالك: ${w.owner || '-'}\nالتواصل: ${w.phone || '-'}`;
          } else if (w.type === 'duplicate') {
            return `⚠️ ${w.message}\n${w.device}`;
          }
          return w.message;
        }).join('\n\n');

        // ✅ استخدام showConfirm بدلاً من confirm لتجنب تجمد الـ inputs
        const proceed = await showConfirm(warningMessages + '\n\nهل تريد المتابعة رغم ذلك؟', 'متابعة', 'إلغاء', 'warning');
        if (!proceed) {
          showToast('تم إلغاء الإضافة', 'info');
          return;
        }
      }
    } catch (e) {
      Logger.warn('[IMEI CHECK] Error checking IMEI1:', e);
    }
  }

  if (imei2 && imei2.length >= 10 && imei2 !== imei1) {
    try {
      const checkRes = await fetch(`elos-db://check-imei/${imei2}`);
      const checkData = await checkRes.json();

      if (checkData.warnings && checkData.warnings.length > 0) {
        let warningMessages = checkData.warnings.map(w => {
          if (w.type === 'blacklist') {
            return `🚫 تحذير خطير! (IMEI2)\n${w.message}\nالسبب: ${w.reason}\nالمالك: ${w.owner || '-'}\nالتواصل: ${w.phone || '-'}`;
          } else if (w.type === 'duplicate') {
            return `⚠️ ${w.message} (IMEI2)\n${w.device}`;
          }
          return w.message;
        }).join('\n\n');

        // ✅ استخدام showConfirm بدلاً من confirm لتجنب تجمد الـ inputs
        const proceed = await showConfirm(warningMessages + '\n\nهل تريد المتابعة رغم ذلك؟', 'متابعة', 'إلغاء', 'warning');
        if (!proceed) {
          showToast('تم إلغاء الإضافة', 'info');
          return;
        }
      }
    } catch (e) {
      Logger.warn('[IMEI CHECK] Error checking IMEI2:', e);
    }
  }

  try {
    showLoading();
    const result = await addDevice(payload);

    showToast(`تمت الإضافة بنجاح (ID: ${result.id}) ✅`, 'success');
    document.getElementById("addModal").style.display = "none";

    // Clear cache and reload data to show the new device
    InventoryCache.clear();
    hideLoading();
    await render();

  } catch (e) {
    Logger.error('Add device error:', e);
    showToast('خطأ أثناء الإضافة: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ═════════════════════════════════════
// 💰 SELL DEVICE MODAL
// ═════════════════════════════════════
let sellCurrentId = null;
const sellModal = document.getElementById("sellModal");
const sellCancel = document.getElementById("btnCancelSell");
const sellConfirm = document.getElementById("btnConfirmSell");

sellCancel.addEventListener("click", () => {
  sellModal.style.display = "none";
  sellCurrentId = null;
});

// Close modal on outside click
window.addEventListener("click", (e) => {
  if (e.target === sellModal) {
    sellModal.style.display = "none";
    sellCurrentId = null;
  }
});

sellConfirm.addEventListener("click", async () => {
  if (isLoading) return;
  
  const price = Number(document.getElementById("sellPrice").value || 0);
  const name = document.getElementById("sellName").value.trim();
  const phone = document.getElementById("sellPhone").value.trim();

  // Validation
  if (!sellCurrentId) {
    showToast('لا يوجد جهاز محدد', 'error');
    return;
  }
  
  if (!(price > 0)) {
    showToast('أدخل سعر صالح', 'warning');
    document.getElementById("sellPrice").focus();
    return;
  }

  try {
    showLoading();
    await sellDevice(sellCurrentId, price, name, phone);
    
    showToast('تم تسجيل البيع بنجاح ✅', 'success');
    sellModal.style.display = "none";
    sellCurrentId = null;
    
    // Clear cache and reload
    InventoryCache.clear();
    await render();
  } catch (err) {
    Logger.error('Sell error:', err);
    showToast('خطأ أثناء البيع: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
});

// ═════════════════════════════════════
// ✏️ EDIT DEVICE MODAL
// ═════════════════════════════════════
const editModal = document.getElementById("editModal");
const editCancel = document.getElementById("btnCancelEdit");
const editConfirm = document.getElementById("btnConfirmEdit");

if (editCancel) {
  editCancel.addEventListener("click", () => {
    editModal.style.display = "none";
  });
}

// Close modal on outside click
window.addEventListener("click", (e) => {
  if (e.target === editModal) {
    editModal.style.display = "none";
  }
});

// Show/hide RAM & battery fields based on brand selection
function toggleEditDeviceFields() {
  const typeValue = document.getElementById("editType").value;
  const batteryField = document.getElementById("editBatteryField");
  const ramField = document.getElementById("editRamField");
  const batteryInput = document.getElementById("editBattery");
  const ramInput = document.getElementById("editRam");

  // Apple: Show battery, Hide RAM — توافق: أيفون = بطارية 100% إذا الحقل فارغ
  if (typeValue === "Apple") {
    if (batteryField) batteryField.style.display = "block";
    if (ramField) ramField.style.display = "none";
    if (ramInput) ramInput.value = "";
    if (batteryInput && !batteryInput.value.trim()) batteryInput.value = "100";
  } else {
    if (batteryField) {
      batteryField.style.display = "none";
      if (batteryInput) batteryInput.value = "";
    }
    if (ramField) ramField.style.display = "block";
  }
}

const editTypeSelect = document.getElementById("editType");
if (editTypeSelect) editTypeSelect.addEventListener("change", toggleEditDeviceFields);

// توافق: عند اختيار "جديد" في التعديل → مع كرتونة
const editConditionEl = document.getElementById("editCondition");
if (editConditionEl) {
  editConditionEl.addEventListener("change", function() {
    const editBox = document.getElementById("editBox");
    if (editBox && this.value === "new") editBox.value = "with_box";
  });
}

if (editConfirm) {
  editConfirm.addEventListener("click", async () => {
    if (isLoading) return;
    
    const deviceId = Number(document.getElementById("editDeviceId").value);
    
    const payload = {
      type: document.getElementById("editType").value.trim(),
      model: document.getElementById("editModel").value.trim(),
      storage: document.getElementById("editStorage").value.trim(),
      ram: document.getElementById("editRam").value.trim(),
      condition: document.getElementById("editCondition").value,
      battery_health: document.getElementById("editBattery").value ? Number(document.getElementById("editBattery").value) : null,
      box_status: document.getElementById("editBox").value,
      imei1: document.getElementById("editImei1").value.trim(),
      imei2: document.getElementById("editImei2").value.trim(),
      purchase_cost: Number(document.getElementById("editCost").value || 0),
      ntra_tax: Number(document.getElementById("editNtraTax").value || 0),
      expected_price: Number(document.getElementById("editPrice").value || 0),
      notes: document.getElementById("editNotes").value.trim(),
      source: document.getElementById("editSource").value.trim()
    };

    // Validation
    if (!payload.model) {
      showToast('الموديل مطلوب', 'warning');
      document.getElementById("editModel").focus();
      return;
    }

    try {
      showLoading();
      await updateDevice(deviceId, payload);
      
      showToast('تم تحديث الجهاز بنجاح ✅', 'success');
      editModal.style.display = "none";
      
      // Clear cache and reload
      InventoryCache.clear();
      await render();
    } catch (err) {
      Logger.error('Edit error:', err);
      showToast('خطأ أثناء التحديث: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  });
}

// ═════════════════════════════════════
// 🔍 FILTERS & SEARCH
// ═════════════════════════════════════
document.getElementById("btnFilter").addEventListener("click", () => {
  InventoryCache.clear(); // Clear cache on filter change
  render();
});

document.getElementById("btnReset").addEventListener("click", () => {
  document.getElementById("qImei").value = "";
  document.getElementById("fType").value = "";
  document.getElementById("fCondition").value = "";
  document.getElementById("fStatus").value = "in_stock";
  document.getElementById("qText").value = "";
  sortColumn = null;
  sortDirection = 'asc';
  
  const btnShowAll = document.getElementById("btnShowAll");
  if (btnShowAll) {
    btnShowAll.innerHTML = '<span>📊</span><span>عرض الكل</span>';
    btnShowAll.style.background = "var(--purple)";
  }
  
  InventoryCache.clear(); // Clear cache on reset
  render();
});

// Real-time local search with debouncing (200ms delay)
const debouncedSearch = debounce(applyFilters, 200);
document.getElementById("qText").addEventListener("input", debouncedSearch);
document.getElementById("fType").addEventListener("change", applyFilters);

// Enter key support for IMEI search
document.getElementById("qImei").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    InventoryCache.clear(); // Clear cache on IMEI search
    render();
  }
});

// ═════════════════════════════════════
// 📊 SHOW ALL BUTTON
// ═════════════════════════════════════
document.getElementById("btnShowAll")?.addEventListener("click", () => {
  const fStatus = document.getElementById("fStatus");
  const btnShowAll = document.getElementById("btnShowAll");
  
  if (fStatus.value === "") {
    fStatus.value = "in_stock";
    btnShowAll.innerHTML = '<span>📊</span><span>عرض الكل</span>';
    btnShowAll.style.background = "var(--purple)";
    showToast('عرض الأجهزة المتوفرة فقط', 'info', 2000);
  } else {
    fStatus.value = "";
    btnShowAll.innerHTML = '<span>✅</span><span>عرض المتوفر فقط</span>';
    btnShowAll.style.background = "var(--success)";
    showToast('عرض جميع الأجهزة', 'info', 2000);
  }
  
  // CRITICAL: Clear cache when changing filter
  InventoryCache.clear();
  render();
});

// ═════════════════════════════════════
// 📄 PAGINATION FUNCTIONS
// ═════════════════════════════════════
function updatePaginationUI(total) {
  const totalPages = Math.ceil(total / rowsPerPage);
  const paginationControls = document.getElementById('paginationControls');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageJump = document.getElementById('pageJump');
  
  if (!paginationControls) return;
  
  // Hide pagination if:
  // 1. No data
  // 2. Viewing all records
  // 3. Total records fit in one page (≤ rowsPerPage)
  if (total === 0 || viewingAll || total <= rowsPerPage) {
    paginationControls.style.display = 'none';
    return;
  }
  
  paginationControls.style.display = 'flex';
  pageInfo.textContent = `صفحة ${currentPage} من ${totalPages} (${total} جهاز)`;
  
  // Re-initialize scroll detection
  setTimeout(() => initPaginationScrollDetection(), 100);
  
  if (pageJump) {
    pageJump.max = totalPages;
  }
  
  if (prevBtn) {
    prevBtn.disabled = currentPage === 1;
    prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
    prevBtn.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    nextBtn.style.opacity = (currentPage === totalPages || totalPages === 0) ? '0.5' : '1';
    nextBtn.style.cursor = (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer';
  }
}

window.changePage = function(direction) {
  const totalPages = Math.ceil(totalDevices / rowsPerPage);
  currentPage += direction;
  
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  
  renderTable();
  
  // Scroll to top of table
  const tableWrapper = document.querySelector('.table-wrapper');
  if (tableWrapper) {
    tableWrapper.scrollTop = 0;
  }
};

window.jumpToPage = function() {
  const input = document.getElementById('pageJump');
  const pageNum = parseInt(input.value);
  const totalPages = Math.ceil(totalDevices / rowsPerPage);
  
  if (pageNum >= 1 && pageNum <= totalPages) {
    currentPage = pageNum;
    renderTable();
    input.value = '';
    
    // Scroll to top of table
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.scrollTop = 0;
    }
    
    showToast(`انتقلت إلى الصفحة ${pageNum}`, 'success', 2000);
  } else {
    showToast(`الرجاء إدخال رقم صفحة بين 1 و ${totalPages}`, 'warning');
  }
};

window.toggleViewAll = function() {
  viewingAll = !viewingAll;
  const btn = document.getElementById('viewAllBtn');
  
  if (viewingAll) {
    btn.textContent = 'عرض بصفحات';
    btn.classList.add('active');
    showToast(`يتم عرض ${totalDevices} جهاز`, 'info', 2000);
  } else {
    btn.textContent = 'عرض الكل';
    btn.classList.remove('active');
    currentPage = 1;
    showToast('تم تفعيل نظام الصفحات (50 جهاز/صفحة)', 'info', 2000);
  }
  
  renderTable();
};

// Reset to page 1 when filters change
const originalBtnReset = document.getElementById("btnReset");
if (originalBtnReset) {
  originalBtnReset.addEventListener("click", () => {
    currentPage = 1;
    viewingAll = false;
    const btn = document.getElementById('viewAllBtn');
    if (btn) {
      btn.textContent = 'عرض الكل';
      btn.classList.remove('active');
    }
  });
}

// ═════════════════════════════════════
// ⌨️ KEYBOARD SHORTCUTS
// ═════════════════════════════════════
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + F = Focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    document.getElementById('qText').focus();
  }
  
  // Ctrl/Cmd + N = New device
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    document.getElementById('openAddModal').click();
  }
  
  // Ctrl/Cmd + S = Save in modals
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    
    // Check which modal is open and click its save button
    const addModal = document.getElementById('addModal');
    const editModal = document.getElementById('editModal');
    const sellModal = document.getElementById('sellModal');
    
    if (addModal && addModal.style.display !== 'none') {
      const saveBtn = addModal.querySelector('button[type="submit"], .btn-success, .btn');
      if (saveBtn) saveBtn.click();
    } else if (editModal && editModal.style.display !== 'none') {
      const saveBtn = editModal.querySelector('button[type="submit"], .btn-success, .btn');
      if (saveBtn) saveBtn.click();
    } else if (sellModal && sellModal.style.display !== 'none') {
      const saveBtn = sellModal.querySelector('button[type="submit"], .btn-success, .btn');
      if (saveBtn) saveBtn.click();
    }
  }
  
  // Escape = Close modals
  if (e.key === 'Escape') {
    document.getElementById('addModal').style.display = 'none';
    document.getElementById('sellModal').style.display = 'none';
    document.getElementById('detailModal').style.display = 'none';
    const editModal = document.getElementById('editModal');
    if (editModal) editModal.style.display = 'none';
  }
});

// ═════════════════════════════════════
// 📜 PAGINATION SCROLL DETECTION
// ═════════════════════════════════════
function initPaginationScrollDetection() {
  const tableWrapper = document.querySelector('.table-wrapper');
  const paginationControls = document.getElementById('paginationControls');
  
  if (!tableWrapper || !paginationControls) {
    Logger.warn('[PAGINATION] Elements not found');
    return;
  }
  
  Logger.log('[PAGINATION] Scroll detection initialized');
  
  let scrollTimeout;
  
  function checkScroll() {
    const { scrollTop, scrollHeight, clientHeight } = tableWrapper;
    const scrollableHeight = scrollHeight - clientHeight;
    
    // If no scroll needed, hide pagination
    if (scrollableHeight <= 10) {
      paginationControls.classList.remove('visible');
      Logger.log('[PAGINATION] No scroll needed, hiding');
      return;
    }
    
    const scrollPercentage = (scrollTop / scrollableHeight) * 100;
    
    // Show when scrolled past 40% OR near bottom (within 150px)
    const nearBottom = (scrollableHeight - scrollTop) < 150;
    
    if (scrollPercentage > 40 || nearBottom) {
      paginationControls.classList.add('visible');
    } else {
      paginationControls.classList.remove('visible');
    }
  }
  
  tableWrapper.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    checkScroll();
    
    // Auto-hide after 3 seconds of no scrolling (unless near bottom)
    scrollTimeout = setTimeout(() => {
      const { scrollTop, scrollHeight, clientHeight } = tableWrapper;
      const nearBottom = ((scrollHeight - clientHeight) - scrollTop) < 150;
      
      if (!nearBottom) {
        paginationControls.classList.remove('visible');
      }
    }, 3000);
  });
  
  // Initial check
  setTimeout(checkScroll, 200);
}

// ═════════════════════════════════════
// 📦 BULK ADD SYSTEM - إضافة متعددة
// ═════════════════════════════════════

let bulkDeviceRowIndex = 0;

// فتح موديل الإضافة المتعددة
window.openBulkAddModal = async function() {
  const modal = document.getElementById('bulkAddModal');
  if (modal) {
    modal.classList.add('show');

    // إعادة تعيين الحقول
    resetBulkAddForm();

    // تحميل المخازن
    await loadBulkWarehouses();

    // إضافة 5 صفوف افتراضية
    for (let i = 0; i < 5; i++) {
      addBulkDeviceRow();
    }

    updateBulkSummary();
  }
};

// إغلاق موديل الإضافة المتعددة
window.closeBulkAddModal = function() {
  const modal = document.getElementById('bulkAddModal');
  if (modal) {
    modal.classList.remove('show');
  }
};

// إعادة تعيين النموذج
function resetBulkAddForm() {
  bulkDeviceRowIndex = 0;

  // إعادة تعيين الحقول المشتركة
  const fields = ['bulkType', 'bulkModel', 'bulkStorage', 'bulkRam', 'bulkBattery',
                  'bulkCondition', 'bulkBox', 'bulkCost', 'bulkPrice', 'bulkWarehouse'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else {
        el.value = '';
      }
    }
  });

  // تعيين الحالة الافتراضية
  const conditionEl = document.getElementById('bulkCondition');
  if (conditionEl) conditionEl.value = 'used';

  const boxEl = document.getElementById('bulkBox');
  if (boxEl) boxEl.value = 'without_box';

  // مسح جدول الأجهزة
  const tbody = document.getElementById('bulkDevicesBody');
  if (tbody) tbody.innerHTML = '';

  // إعادة تعيين حقل تطبيق اللون
  const colorField = document.getElementById('bulkApplyColor');
  if (colorField) colorField.value = '';

  // إظهار/إخفاء الرام والبطارية
  toggleBulkRamBattery();
}

// تحميل المخازن للإضافة المتعددة
async function loadBulkWarehouses() {
  const select = document.getElementById('bulkWarehouse');
  if (!select) return;

  try {
    const res = await fetch('elos-db://warehouses');
    if (res.ok) {
      const data = await res.json();
      const warehouses = (data.warehouses || []).filter(w => w.is_active !== 0);
      const deviceWarehouses = warehouses.filter(w => {
        if (w.type === 'devices' && !w.is_storage_only) return true;
        if (w.is_storage_only === 1 && w.storage_type === 'devices') return true;
        return false;
      });
      const mainWarehouse = deviceWarehouses.find(w => w.type === 'devices' && !w.is_storage_only);
      mainDeviceWarehouseId = mainWarehouse ? mainWarehouse.id : mainDeviceWarehouseId;
      const currentWarehouseId = localStorage.getItem('currentWarehouseId');
      const isStorageWarehouse = localStorage.getItem('isStorageWarehouse') === 'true';
      const defaultOptionLabel = isStorageWarehouse ? '-- اختر المخزن --' : 'المخزن الرئيسي';
      select.innerHTML = `<option value="">${defaultOptionLabel}</option>`;
      if (isStorageWarehouse) {
        // Allow choosing main warehouse explicitly from storage context
        select.innerHTML += '<option value="">المخزن الرئيسي</option>';
      }
      deviceWarehouses.forEach(wh => {
        // Skip main warehouse entry to avoid mapping it to a non-null id
        if (mainDeviceWarehouseId && String(wh.id) === String(mainDeviceWarehouseId)) return;
        const opt = document.createElement('option');
        opt.value = wh.id;
        opt.textContent = wh.name;
        if (isStorageWarehouse && currentWarehouseId && String(wh.id) === String(currentWarehouseId)) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
      if (!isStorageWarehouse) {
        select.value = '';
      }
    }
  } catch (error) {
    Logger.error('Error loading warehouses for bulk add:', error);
    select.innerHTML = '<option value="">خطأ في التحميل</option>';
  }
}

// تبديل إظهار الرام/البطارية — توافق: أبل = بطارية 100%
window.toggleBulkRamBattery = function() {
  const typeValue = document.getElementById('bulkType')?.value || '';
  const ramField = document.getElementById('bulkRamField');
  const batteryField = document.getElementById('bulkBatteryField');
  const ramInput = document.getElementById('bulkRam');
  const batteryInput = document.getElementById('bulkBattery');

  if (typeValue === 'Apple') {
    if (ramField) ramField.style.display = 'none';
    if (batteryField) batteryField.style.display = 'block';
    if (ramInput) ramInput.value = '';
    if (batteryInput) batteryInput.value = '100';
  } else {
    if (ramField) ramField.style.display = 'block';
    if (batteryField) batteryField.style.display = 'none';
    if (batteryInput) batteryInput.value = '';
  }
};

// توافق إضافة متعددة: عند اختيار "جديد" → مع كرتونة
const bulkConditionEl = document.getElementById('bulkCondition');
if (bulkConditionEl) {
  bulkConditionEl.addEventListener('change', function() {
    const bulkBox = document.getElementById('bulkBox');
    if (bulkBox && this.value === 'new') bulkBox.value = 'with_box';
  });
}

// إضافة صف جديد للجهاز
window.addBulkDeviceRow = function() {
  const tbody = document.getElementById('bulkDevicesBody');
  if (!tbody) return;

  bulkDeviceRowIndex++;
  const row = document.createElement('tr');
  row.id = `bulkRow_${bulkDeviceRowIndex}`;
  row.innerHTML = `
    <td class="row-num">${bulkDeviceRowIndex}</td>
    <td><input type="text" id="bulkImei1_${bulkDeviceRowIndex}" placeholder="IMEI 1" maxlength="20" onchange="updateBulkSummary()"></td>
    <td><input type="text" id="bulkImei2_${bulkDeviceRowIndex}" placeholder="IMEI 2" maxlength="20"></td>
    <td><input type="text" id="bulkColor_${bulkDeviceRowIndex}" placeholder="اللون" value="أسود"></td>
    <td><input type="text" id="bulkBarcode_${bulkDeviceRowIndex}" placeholder="اختياري - امسح الباركود"></td>
    <td><button class="delete-row-btn" onclick="removeBulkDeviceRow(${bulkDeviceRowIndex})">×</button></td>
  `;
  tbody.appendChild(row);

  updateBulkSummary();

  // التركيز على حقل IMEI1 الجديد
  const newImeiField = document.getElementById(`bulkImei1_${bulkDeviceRowIndex}`);
  if (newImeiField) newImeiField.focus();
};

// حذف صف جهاز
window.removeBulkDeviceRow = function(index) {
  const row = document.getElementById(`bulkRow_${index}`);
  if (row) {
    row.remove();
    updateRowNumbers();
    updateBulkSummary();
  }
};

// تحديث أرقام الصفوف
function updateRowNumbers() {
  const tbody = document.getElementById('bulkDevicesBody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, i) => {
    const numCell = row.querySelector('.row-num');
    if (numCell) numCell.textContent = i + 1;
  });
}

// لصق IMEIs من الحافظة
window.pasteIMEIsFromClipboard = async function() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      showToast('الحافظة فارغة', 'warning');
      return;
    }

    // تقسيم النص إلى أسطر (يدعم فواصل مختلفة)
    const lines = text.split(/[\n\r\t,;]+/).map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) {
      showToast('لم يتم العثور على بيانات صالحة', 'warning');
      return;
    }

    // مسح الصفوف الفارغة الحالية
    const tbody = document.getElementById('bulkDevicesBody');
    const existingRows = tbody.querySelectorAll('tr');
    let emptyRowsRemoved = 0;

    existingRows.forEach(row => {
      const imei1Input = row.querySelector('input[id^="bulkImei1_"]');
      if (imei1Input && !imei1Input.value.trim()) {
        row.remove();
        emptyRowsRemoved++;
      }
    });

    // إضافة صفوف جديدة لكل IMEI
    const defaultColor = document.getElementById('bulkApplyColor')?.value || 'أسود';

    lines.forEach(imei => {
      bulkDeviceRowIndex++;
      const row = document.createElement('tr');
      row.id = `bulkRow_${bulkDeviceRowIndex}`;
      row.innerHTML = `
        <td class="row-num">${bulkDeviceRowIndex}</td>
        <td><input type="text" id="bulkImei1_${bulkDeviceRowIndex}" placeholder="IMEI 1" maxlength="20" value="${escapeHtml(imei)}" onchange="updateBulkSummary()"></td>
        <td><input type="text" id="bulkImei2_${bulkDeviceRowIndex}" placeholder="IMEI 2" maxlength="20"></td>
        <td><input type="text" id="bulkColor_${bulkDeviceRowIndex}" placeholder="اللون" value="${escapeHtml(defaultColor)}"></td>
        <td><button class="delete-row-btn" onclick="removeBulkDeviceRow(${bulkDeviceRowIndex})">×</button></td>
      `;
      tbody.appendChild(row);
    });

    updateRowNumbers();
    updateBulkSummary();

    showToast(`✅ تم لصق ${lines.length} IMEI بنجاح`, 'success');
  } catch (error) {
    Logger.error('Error pasting IMEIs:', error);
    showToast('خطأ في قراءة الحافظة - تأكد من السماح بالوصول', 'error');
  }
};

// تطبيق اللون على كل الصفوف
window.applyColorToAll = function() {
  const color = document.getElementById('bulkApplyColor')?.value?.trim();
  if (!color) {
    showToast('يرجى إدخال اللون أولاً', 'warning');
    return;
  }

  const tbody = document.getElementById('bulkDevicesBody');
  if (!tbody) return;

  const colorInputs = tbody.querySelectorAll('input[id^="bulkColor_"]');
  colorInputs.forEach(input => {
    input.value = color;
  });

  showToast(`✅ تم تطبيق اللون "${color}" على ${colorInputs.length} جهاز`, 'success');
};

// تحديث الملخص
window.updateBulkSummary = function() {
  const tbody = document.getElementById('bulkDevicesBody');
  const costInput = document.getElementById('bulkCost');
  const countEl = document.getElementById('bulkDeviceCount');
  const totalEl = document.getElementById('bulkTotalCost');
  const saveCountEl = document.getElementById('bulkSaveCount');

  if (!tbody) return;

  // عد الأجهزة التي لها IMEI1
  let deviceCount = 0;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const imei1 = row.querySelector('input[id^="bulkImei1_"]')?.value?.trim();
    if (imei1) deviceCount++;
  });

  const cost = parseFloat(costInput?.value) || 0;
  const total = deviceCount * cost;

  if (countEl) countEl.textContent = deviceCount;
  if (totalEl) totalEl.textContent = fmt(total, 0);
  if (saveCountEl) saveCountEl.textContent = deviceCount;
};

// حفظ جميع الأجهزة
window.submitBulkAdd = async function() {
  // التحقق من البيانات المشتركة
  const type = document.getElementById('bulkType')?.value?.trim();
  const model = document.getElementById('bulkModel')?.value?.trim();

  if (!type) {
    showToast('يرجى اختيار الشركة', 'error');
    return;
  }

  if (!model) {
    showToast('يرجى إدخال الموديل', 'error');
    return;
  }

  // جمع الأجهزة
  const tbody = document.getElementById('bulkDevicesBody');
  const rows = tbody.querySelectorAll('tr');
  const devices = [];

  rows.forEach(row => {
    const rowId = row.id.replace('bulkRow_', '');
    const imei1 = document.getElementById(`bulkImei1_${rowId}`)?.value?.trim();
    const imei2 = document.getElementById(`bulkImei2_${rowId}`)?.value?.trim() || '';
    const color = document.getElementById(`bulkColor_${rowId}`)?.value?.trim() || 'أسود';
    const barcode = document.getElementById(`bulkBarcode_${rowId}`)?.value?.trim() || '';

    if (imei1) {
      devices.push({ imei1, imei2, color, short_code: barcode || null });
    }
  });

  if (devices.length === 0) {
    showToast('يرجى إضافة جهاز واحد على الأقل مع IMEI', 'error');
    return;
  }

  // التحقق من التكرار في القائمة نفسها
  const imeis = devices.map(d => d.imei1);
  const duplicates = imeis.filter((item, index) => imeis.indexOf(item) !== index);

  if (duplicates.length > 0) {
    showToast(`⚠️ IMEIs مكررة: ${duplicates.join(', ')}`, 'error');
    return;
  }

  // تجميع البيانات المشتركة
  const isStorageWarehouse = localStorage.getItem('isStorageWarehouse') === 'true';
  const currentWarehouseId = localStorage.getItem('currentWarehouseId');
  const selectedWarehouseId = document.getElementById('bulkWarehouse')?.value || '';
  const effectiveWarehouseId = (isStorageWarehouse && currentWarehouseId) ? currentWarehouseId : selectedWarehouseId;

  if (mainDeviceWarehouseId && String(effectiveWarehouseId) === String(mainDeviceWarehouseId)) {
    // Treat main devices warehouse as NULL (main inventory)
    effectiveWarehouseId = '';
  }

  const common = {
    type: type,
    model: model,
    storage: document.getElementById('bulkStorage')?.value || '',
    ram: document.getElementById('bulkRam')?.value || '',
    battery_health: document.getElementById('bulkBattery')?.value || '',
    condition: document.getElementById('bulkCondition')?.value || 'used',
    has_box: document.getElementById('bulkBox')?.value || 'without_box',
    purchase_cost: parseFloat(document.getElementById('bulkCost')?.value) || 0,
    expected_price: parseFloat(document.getElementById('bulkPrice')?.value) || 0,
    warehouse_id: effectiveWarehouseId || ''
  };

  // إرسال الطلب
  try {
    showToast('⏳ جاري إضافة الأجهزة...', 'info', 2000);

    const res = await fetch('elos-db://inventory-bulk-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ common, devices })
    });

    const result = await res.json();

    if (res.ok && result.success) {
      showToast(`✅ تم إضافة ${result.added} جهاز بنجاح!`, 'success', 5000);

      // إغلاق الموديل وتحديث القائمة
      closeBulkAddModal();
      InventoryCache.clear();
      await render();

      // عرض تفاصيل الأخطاء إن وجدت
      if (result.errors && result.errors.length > 0) {
        setTimeout(() => {
          showToast(`⚠️ ${result.errors.length} جهاز فشل في الإضافة - راجع السجل`, 'warning', 5000);
          Logger.warn('Bulk add errors:', result.errors);
        }, 1000);
      }
    } else {
      showToast(result.error || 'خطأ في الإضافة', 'error');
    }
  } catch (error) {
    Logger.error('Error in bulk add:', error);
    showToast('خطأ في الاتصال بالسيرفر', 'error');
  }
};

// ═════════════════════════════════════
// 🚀 INITIALIZATION
// ═════════════════════════════════════
(async function init() {
  Logger.log('📦 ElOs Inventory System - Enhanced Version');
  Logger.log('✨ Loading...');

  try {
    initSortHandlers();
    // Load warehouses first so main warehouse mapping is ready
    await loadDeviceWarehouses();
    await render();

    // Initialize scroll detection after render
    setTimeout(() => initPaginationScrollDetection(), 500);
    
    // Check for sold devices and show archive warning after 40 seconds
    setTimeout(async () => {
      try {
        const res = await fetch("elos-db://inventory?status=sold");
        if (res.ok) {
          const soldDevices = await res.json();
          if (soldDevices.length > 200) {
            showToast(
              `⚠️ تنبيه: يوجد ${soldDevices.length} جهاز مباع - يُنصح بأرشفتها لتحسين الأداء`,
              'warning',
              8000
            );
          }
        }
      } catch (error) {
        Logger.error('Error checking sold devices:', error);
      }
    }, 40000);
    
    Logger.log('✅ Inventory ready!');
    Logger.log('⌨️ Keyboard shortcuts:');
    Logger.log('  - Ctrl/Cmd + F: Focus search');
    Logger.log('  - Ctrl/Cmd + N: Add new device');
    Logger.log('  - Escape: Close modals');
    Logger.log('  - Click column headers to sort');
  } catch (error) {
    Logger.error('❌ Init error:', error);
    showToast('حدث خطأ أثناء تحميل النظام', 'error');
  }
})();