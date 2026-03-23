// ═══════════════════════════════════════════════════════════════
// 🔧 ELOS REPAIR PARTS INVENTORY SYSTEM
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };

// Use window globals directly to avoid redeclaration errors in SPA mode
// Access via window.fmt and window.escapeHtml throughout the file

// ═════════════════════════════════════
// 🌐 GLOBAL STATE
// ═════════════════════════════════════
let allParts = [];
let filteredParts = [];
let CURRENT_WAREHOUSE_ID = null; // معرف المخزن الحالي (إن وجد)
let CURRENT_WAREHOUSE_NAME = null; // اسم المخزن الحالي
let selectedItems = new Set(); // للتحديد والتحويل بين المخازن
let allWarehouses = []; // قائمة المخازن المتاحة

// ═════════════════════════════════════
// 📄 PAGINATION STATE
// ═════════════════════════════════════
let currentPage = 1;
const PAGE_SIZE = 200;
let searchDebounceTimer = null;

// ═════════════════════════════════════
// 🔃 SORT STATE - الترتيب الافتراضي: الأحدث أولاً
// ═════════════════════════════════════
let sortColumn = 'id';
let sortDirection = 'DESC';

// ═════════════════════════════════════
// 🗄️ DATABASE WRAPPER
// ═════════════════════════════════════
async function apiRequest(endpoint, options = {}) {
  try {
    Logger.log('[API] Request:', endpoint, options);
    const response = await fetch(`elos-db://${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    Logger.log('[API] Response:', data);
    return data;
  } catch (error) {
    Logger.error('[API] Error:', error);
    throw error;
  }
}

// ═════════════════════════════════════
// 📥 LOAD DATA
// ═════════════════════════════════════
async function loadParts() {
  try {
    // بناء الـ URL مع warehouse_id إن وجد
    let endpoint = 'repair-parts';
    if (CURRENT_WAREHOUSE_ID) {
      endpoint += `?warehouse_id=${CURRENT_WAREHOUSE_ID}`;
    }
    const parts = await apiRequest(endpoint);
    allParts = parts || [];
    filteredParts = [...allParts];
    renderPartsTable();
    updateStats();
  } catch (error) {
    Logger.error('Failed to load parts:', error);
    if (typeof showToast === 'function') {
      showToast('فشل في تحميل قطع الغيار', 'error');
    }
    allParts = [];
    filteredParts = [];
    renderPartsTable();
  }
}

// ═════════════════════════════════════
// 📦 LOAD WAREHOUSE INFO
// ═════════════════════════════════════
async function loadWarehouseInfo() {
  if (!CURRENT_WAREHOUSE_ID) return;

  try {
    const warehouse = await apiRequest(`warehouses/${CURRENT_WAREHOUSE_ID}`);
    if (warehouse && warehouse.warehouse) {
      CURRENT_WAREHOUSE_NAME = warehouse.warehouse.name;
      updatePageTitle();
    }
  } catch (error) {
    Logger.error('Failed to load warehouse info:', error);
  }
}

function updatePageTitle() {
  const pageTitle = document.querySelector('.page-title');
  const headerTitle = document.querySelector('.header h1, header .page-title');

  if (CURRENT_WAREHOUSE_NAME) {
    const title = `🔧 ${CURRENT_WAREHOUSE_NAME}`;

    if (pageTitle) {
      pageTitle.innerHTML = `<span>🔧</span><span>${CURRENT_WAREHOUSE_NAME}</span>`;
    }

    // تحديث عنوان الصفحة في المتصفح
    document.title = `${CURRENT_WAREHOUSE_NAME} • ElOs Accounting`;
  }
}

// ═════════════════════════════════════
// 🔍 SEARCH & FILTER
// ═════════════════════════════════════
function filterParts() {
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  if (!searchTerm) {
    filteredParts = [...allParts];
  } else {
    filteredParts = allParts.filter(part => {
      const name = (part.name || '').toLowerCase();
      const category = (part.category || '').toLowerCase();
      const sku = (part.sku || '').toLowerCase();
      const barcode = (part.barcode || '').toLowerCase();
      return name.includes(searchTerm) || category.includes(searchTerm) || sku.includes(searchTerm) || barcode.includes(searchTerm);
    });
  }

  currentPage = 1; // الرجوع للصفحة الأولى عند البحث
  renderPartsTable();
  updateStats();
}

// ═════════════════════════════════════
// 🎨 RENDER TABLE
// ═════════════════════════════════════
function renderPartsTable() {
  const tbody = document.getElementById('partsTableBody');
  const emptyState = document.getElementById('emptyState');

  if (!tbody) return;

  if (filteredParts.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    renderPagination();
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // ✅ تطبيق الترتيب
  if (sortColumn) {
    filteredParts.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      // التعامل مع الأرقام
      const numCols = ['id', 'qty', 'min_qty', 'unit_cost', 'sell_price'];
      if (numCols.includes(sortColumn)) {
        valA = parseFloat(valA || 0);
        valB = parseFloat(valB || 0);
        return sortDirection === 'ASC' ? valA - valB : valB - valA;
      }

      // التعامل مع النصوص
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
      const cmp = valA.localeCompare(valB, 'ar');
      return sortDirection === 'ASC' ? cmp : -cmp;
    });
  }

  // حساب الصفحة الحالية
  const totalPages = Math.ceil(filteredParts.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, filteredParts.length);
  const pageParts = filteredParts.slice(startIndex, endIndex);

  tbody.innerHTML = pageParts.map(part => {
    const qty = parseFloat(part.qty || 0);
    const minQty = parseFloat(part.min_qty || 0);
    const unitCost = parseFloat(part.unit_cost || 0);
    const sellPrice = parseFloat(part.sell_price || 0);
    const isSelected = selectedItems.has(part.id);

    // تحديد الحالة بناءً على الكمية والحد الأدنى
    let statusBadge = '';
    let statusClass = '';
    if (qty === 0) {
      statusBadge = '<span class="badge badge-out-of-stock">❌ غير متوفر</span>';
      statusClass = 'badge-out-of-stock';
    } else if (qty > 0 && minQty > 0 && qty < minQty) {
      statusBadge = '<span class="badge badge-low-stock">⚠️ منخفض</span>';
      statusClass = 'badge-low-stock';
    } else {
      statusBadge = '<span class="badge badge-in-stock">✅ متوفر</span>';
      statusClass = 'badge-in-stock';
    }

    return `
      <tr data-id="${part.id}" class="${isSelected ? 'selected-row' : ''}">
        <td class="td-checkbox">
          <input type="checkbox" class="row-checkbox part-row-checkbox" data-id="${part.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td><strong>${window.escapeHtml(part.name || '')}</strong></td>
        <td>${window.escapeHtml(part.category || '-')}</td>
        <td style="font-family: monospace; color: var(--text-secondary);">${window.escapeHtml(part.sku || '-')}</td>
        <td class="number">${window.fmt(unitCost, 2)} ج.م</td>
        <td class="number">${window.fmt(sellPrice, 2)} ج.م</td>
        <td class="number"><strong>${window.fmt(qty, 2)}</strong></td>
        <td class="number">${window.fmt(minQty, 2)}</td>
        <td>
          ${statusBadge}
        </td>
        <td>
          <div class="btn-group">
            <button class="btn btn-primary btn-sm" onclick="openPartDetails(${part.id})" title="تفاصيل">
              <span>📋</span>
              <span>تفاصيل</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openEditPartModal(${part.id})" title="تعديل">
              <span>✏️</span>
              <span>تعديل</span>
            </button>
            <button class="btn btn-warning btn-sm" onclick="openAdjustModal(${part.id})" title="تعديل الرصيد">
              <span>🔢</span>
              <span>تعديل الرصيد</span>
            </button>
            <button class="btn btn-info btn-sm" onclick="printPartBarcode(${part.id})" title="طباعة الباركود">
              <span>🏷️</span>
              <span>باركود</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeletePart(${part.id}, '${window.escapeHtml(part.name || '').replace(/'/g, "\\'")}', ${qty})" title="حذف">
              <span>🗑️</span>
              <span>حذف</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // تحديث حالة checkbox تحديد الكل
  updateSelectAllCheckbox();

  // عرض pagination
  renderPagination();

  // ✅ تحديث أيقونات الترتيب في الـ headers
  updateSortIcons();
}

// ═════════════════════════════════════
// 🔃 SORTING - ترتيب الجدول
// ═════════════════════════════════════
function sortTable(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
  } else {
    sortColumn = column;
    sortDirection = (column === 'name' || column === 'category' || column === 'sku') ? 'ASC' : 'DESC';
  }
  currentPage = 1;
  renderPartsTable();
}

function updateSortIcons() {
  document.querySelectorAll('#partsTable thead th[data-sort]').forEach(th => {
    const col = th.dataset.sort;
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    if (col === sortColumn) {
      icon.textContent = sortDirection === 'ASC' ? ' ▲' : ' ▼';
      icon.style.opacity = '1';
    } else {
      icon.textContent = ' ⇅';
      icon.style.opacity = '0.3';
    }
  });
}

// ═════════════════════════════════════
// 📄 PAGINATION CONTROLS
// ═════════════════════════════════════
function renderPagination() {
  let paginationDiv = document.getElementById('paginationControls');
  if (!paginationDiv) {
    // إنشاء div الترقيم لو مش موجود
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;
    paginationDiv = document.createElement('div');
    paginationDiv.id = 'paginationControls';
    paginationDiv.className = 'pagination-controls';
    tableContainer.after(paginationDiv);
  }

  const totalItems = filteredParts.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  if (totalPages <= 1) {
    paginationDiv.innerHTML = totalItems > 0
      ? `<div class="pagination-info">عرض الكل: ${totalItems} صنف</div>`
      : '';
    return;
  }

  const startItem = (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, totalItems);

  // بناء أزرار الصفحات
  let pageButtons = '';

  // زر السابق
  pageButtons += `<button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}"
    onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>❯</button>`;

  // الصفحات
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    pageButtons += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) pageButtons += `<span class="pagination-dots">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    pageButtons += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pageButtons += `<span class="pagination-dots">...</span>`;
    pageButtons += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  // زر التالي
  pageButtons += `<button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}"
    onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>❮</button>`;

  paginationDiv.innerHTML = `
    <div class="pagination-info">عرض ${startItem} - ${endItem} من ${totalItems} صنف</div>
    <div class="pagination-buttons">${pageButtons}</div>
  `;
}

window.goToPage = function(page) {
  const totalPages = Math.ceil(filteredParts.length / PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderPartsTable();
  // التمرير لأعلى الجدول
  const tableContainer = document.querySelector('.table-container');
  if (tableContainer) tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═════════════════════════════════════
// 📊 UPDATE STATS
// ═════════════════════════════════════
function updateStats() {
  const totalCount = allParts.length;
  const totalQty = allParts.reduce((sum, part) => sum + (parseFloat(part.qty || 0)), 0);
  const totalCost = allParts.reduce((sum, part) => {
    const qty = parseFloat(part.qty || 0);
    const unitCost = parseFloat(part.unit_cost || 0);
    return sum + qty * unitCost;
  }, 0);
  const totalSaleValue = allParts.reduce((sum, part) => {
    const qty = parseFloat(part.qty || 0);
    const sellPrice = parseFloat(part.sell_price || 0);
    return sum + qty * sellPrice;
  }, 0);

  const fmtFn = window.fmt || ((n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const kpiCountEl = document.getElementById('kpiCount');
  const kpiTotalQtyEl = document.getElementById('kpiTotalQty');
  const kpiCostEl = document.getElementById('kpiCost');
  const kpiSaleEl = document.getElementById('kpiSale');
  if (kpiCountEl) kpiCountEl.textContent = totalCount.toLocaleString('ar-EG');
  if (kpiTotalQtyEl) kpiTotalQtyEl.textContent = totalQty.toLocaleString('ar-EG');
  if (kpiCostEl) kpiCostEl.textContent = fmtFn(totalCost);
  if (kpiSaleEl) kpiSaleEl.textContent = fmtFn(totalSaleValue);
}

// ═════════════════════════════════════
// ➕ ADD PART MODAL
// ═════════════════════════════════════

// دالة تبديل حقل الباركود اليدوي/التلقائي
window.togglePartBarcodeField = function() {
  const barcodeType = document.querySelector('input[name="partBarcodeType"]:checked')?.value;
  const manualField = document.getElementById('partBarcodeManualField');
  const barcodeInput = document.getElementById('partBarcode');

  if (barcodeType === 'manual') {
    if (manualField) manualField.style.display = 'block';
    if (barcodeInput) {
      barcodeInput.value = '';
      setTimeout(() => barcodeInput.focus(), 100);
    }
  } else {
    if (manualField) manualField.style.display = 'none';
    if (barcodeInput) barcodeInput.value = '';
  }
};

function openAddPartModal() {
  const modal = document.getElementById('partModal');
  const form = document.getElementById('partForm');
  const title = document.getElementById('partModalTitle');

  if (!modal || !form || !title) return;

  // Reset form
  form.reset();
  document.getElementById('partId').value = '';
  document.getElementById('partInitialQty').value = '0';
  document.getElementById('partMinQty').value = '0';
  document.getElementById('partSellPrice').value = '0';

  // إعادة ضبط خيار الباركود للتلقائي
  const autoRadio = document.querySelector('input[name="partBarcodeType"][value="auto"]');
  if (autoRadio) autoRadio.checked = true;
  const manualField = document.getElementById('partBarcodeManualField');
  if (manualField) manualField.style.display = 'none';
  const barcodeInput = document.getElementById('partBarcode');
  if (barcodeInput) barcodeInput.value = '';

  // Update title
  title.innerHTML = '<span>➕</span><span>إضافة قطعة جديدة</span>';

  // Show initial qty field for new parts
  const initialQtyGroup = document.getElementById('initialQtyGroup');
  if (initialQtyGroup) initialQtyGroup.style.display = 'block';

  modal.classList.add('active');
}

function closePartModal() {
  const modal = document.getElementById('partModal');
  if (modal) modal.classList.remove('active');
}

// ═════════════════════════════════════
// ✏️ EDIT PART MODAL
// ═════════════════════════════════════
async function openEditPartModal(partId) {
  const part = allParts.find(p => p.id === partId);
  if (!part) {
    if (typeof showToast === 'function') {
      showToast('القطعة غير موجودة', 'error');
    }
    return;
  }
  
  const modal = document.getElementById('partModal');
  const form = document.getElementById('partForm');
  const title = document.getElementById('partModalTitle');
  
  if (!modal || !form || !title) return;
  
  // Fill form
  document.getElementById('partId').value = part.id;
  document.getElementById('partName').value = part.name || '';
  document.getElementById('partCategory').value = part.category || '';
  document.getElementById('partSku').value = part.sku || '';
  document.getElementById('partUnitCost').value = part.unit_cost || 0;
  document.getElementById('partSellPrice').value = part.sell_price || 0;
  document.getElementById('partMinQty').value = part.min_qty || 0;
  document.getElementById('partNotes').value = part.notes || '';
  
  // Hide initial qty field for editing
  const initialQtyGroup = document.getElementById('initialQtyGroup');
  if (initialQtyGroup) initialQtyGroup.style.display = 'none';
  
  // Update title
  title.innerHTML = '<span>✏️</span><span>تعديل القطعة</span>';
  
  modal.classList.add('active');
}

// ═════════════════════════════════════
// 💾 SAVE PART (CREATE/UPDATE)
// ═════════════════════════════════════
async function handlePartSubmit(event) {
  event.preventDefault();
  
  const form = document.getElementById('partForm');
  const partId = document.getElementById('partId').value;
  const name = document.getElementById('partName').value.trim();
  const category = document.getElementById('partCategory').value.trim() || null;
  const sku = document.getElementById('partSku').value.trim() || null;
  const unitCost = parseFloat(document.getElementById('partUnitCost').value || 0);
  const sellPrice = parseFloat(document.getElementById('partSellPrice').value || 0);
  const minQty = parseFloat(document.getElementById('partMinQty').value || 0);
  const notes = document.getElementById('partNotes').value.trim() || null;
  
  // Validation
  if (!name) {
    if (typeof showToast === 'function') {
      showToast('اسم القطعة مطلوب', 'error');
    }
    return;
  }
  
  if (unitCost < 0) {
    if (typeof showToast === 'function') {
      showToast('سعر التكلفة يجب أن يكون أكبر من أو يساوي صفر', 'error');
    }
    return;
  }
  
  if (sellPrice < 0) {
    if (typeof showToast === 'function') {
      showToast('سعر البيع يجب أن يكون أكبر من أو يساوي صفر', 'error');
    }
    return;
  }
  
  try {
    if (partId) {
      // Update existing part
      await apiRequest(`repair-parts/${partId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          category,
          sku,
          unit_cost: unitCost,
          sell_price: sellPrice,
          min_qty: minQty,
          notes
        })
      });
      
      if (typeof showToast === 'function') {
        showToast('تم تحديث القطعة بنجاح', 'success');
      }
    } else {
      // Create new part
      const initialQty = parseFloat(document.getElementById('partInitialQty').value || 0);

      // التحقق من نوع الباركود (يدوي/تلقائي)
      const barcodeType = document.querySelector('input[name="partBarcodeType"]:checked')?.value || 'auto';
      let barcode = null;

      if (barcodeType === 'manual') {
        barcode = document.getElementById('partBarcode')?.value?.trim() || null;
      }

      await apiRequest('repair-parts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category,
          sku,
          unit_cost: unitCost,
          sell_price: sellPrice,
          qty: initialQty,
          min_qty: minQty,
          notes,
          warehouse_id: CURRENT_WAREHOUSE_ID, // إضافة warehouse_id
          barcode: barcode // الباركود اليدوي (null إذا كان تلقائي)
        })
      });

      if (typeof showToast === 'function') {
        showToast('تم إضافة القطعة بنجاح', 'success');
      }
    }
    
    closePartModal();
    await loadParts();
    
    // Notify repairs.js to refresh parts list if it exists
    if (typeof window.refreshRepairPartsList === 'function') {
      window.refreshRepairPartsList();
    }
    
  } catch (error) {
    Logger.error('Failed to save part:', error);
    if (typeof showToast === 'function') {
      showToast(error.message || 'فشل في حفظ القطعة', 'error');
    }
  }
}

// ═════════════════════════════════════
// 🔢 ADJUST STOCK MODAL
// ═════════════════════════════════════
async function openAdjustModal(partId) {
  const part = allParts.find(p => p.id === partId);
  if (!part) {
    if (typeof showToast === 'function') {
      showToast('القطعة غير موجودة', 'error');
    }
    return;
  }
  
  const modal = document.getElementById('adjustModal');
  const form = document.getElementById('adjustForm');
  
  if (!modal || !form) return;
  
  // Fill form
  document.getElementById('adjustPartId').value = part.id;
  document.getElementById('adjustPartName').value = part.name || '';
  document.getElementById('adjustCurrentQty').value = window.fmt(parseFloat(part.qty || 0), 2);
  
  // Reset
  document.getElementById('adjustDeltaQty').value = '';
  document.getElementById('adjustNote').value = '';
  document.getElementById('adjustNewQty').value = window.fmt(parseFloat(part.qty || 0), 2);
  
  // Add change listener for delta qty
  const deltaInput = document.getElementById('adjustDeltaQty');
  const newQtyInput = document.getElementById('adjustNewQty');
  const currentQty = parseFloat(part.qty || 0);
  
  const updateNewQty = () => {
    const delta = parseFloat(deltaInput.value || 0);
    const newQty = Math.max(0, currentQty + delta);
    newQtyInput.value = window.fmt(newQty, 2);
    
    // Change color based on whether it goes negative
    if (currentQty + delta < 0) {
      newQtyInput.style.color = 'var(--danger)';
    } else {
      newQtyInput.style.color = 'var(--accent)';
    }
  };
  
  // Remove old listener if exists
  deltaInput.oninput = updateNewQty;
  
  modal.classList.add('active');
}

function closeAdjustModal() {
  const modal = document.getElementById('adjustModal');
  if (modal) modal.classList.remove('active');
}

// ═════════════════════════════════════
// 💾 SAVE ADJUSTMENT
// ═════════════════════════════════════
async function handleAdjustSubmit(event) {
  event.preventDefault();
  
  const partId = document.getElementById('adjustPartId').value;
  const deltaQty = parseFloat(document.getElementById('adjustDeltaQty').value || 0);
  const note = document.getElementById('adjustNote').value.trim();
  const part = allParts.find(p => p.id === parseInt(partId));
  
  if (!part) {
    if (typeof showToast === 'function') {
      showToast('القطعة غير موجودة', 'error');
    }
    return;
  }
  
  // Validation
  if (!note) {
    if (typeof showToast === 'function') {
      showToast('ملاحظة التعديل مطلوبة', 'error');
    }
    return;
  }
  
  const currentQty = parseFloat(part.qty || 0);
  const newQty = currentQty + deltaQty;
  
  if (newQty < 0) {
    if (typeof showToast === 'function') {
      showToast('الكمية الناتجة لا يمكن أن تكون أقل من صفر', 'error');
    }
    return;
  }
  
  try {
    await apiRequest(`repair-parts/${partId}/adjust`, {
      method: 'POST',
      body: JSON.stringify({
        delta_qty: deltaQty,
        note
      })
    });
    
    if (typeof showToast === 'function') {
      showToast('تم تعديل الرصيد بنجاح', 'success');
    }
    
    closeAdjustModal();
    await loadParts();
    
    // Notify repairs.js to refresh parts list if it exists
    if (typeof window.refreshRepairPartsList === 'function') {
      window.refreshRepairPartsList();
    }
    
  } catch (error) {
    Logger.error('Failed to adjust stock:', error);
    if (typeof showToast === 'function') {
      showToast(error.message || 'فشل في تعديل الرصيد', 'error');
    }
  }
}

// ═════════════════════════════════════
// 🏷️ PRINT BARCODE
// ═════════════════════════════════════
function printPartBarcode(partId) {
  const part = allParts.find(p => p.id === parseInt(partId));
  if (!part) {
    if (typeof showToast === 'function') {
      showToast('القطعة غير موجودة', 'error');
    }
    return;
  }

  // استخدام الباركود المخزن أو توليد واحد من SKU أو ID
  const barcodeValue = part.barcode || part.sku || String(part.id).padStart(5, '0');

  if (!barcodeValue) {
    if (typeof showToast === 'function') {
      showToast('لا يوجد باركود لهذه القطعة', 'error');
    }
    return;
  }

  try {
    // استخدام BarcodeGenerator إن وجد
    if (window.BarcodeGenerator && typeof window.BarcodeGenerator.showBarcodePreviewModal === 'function') {
      const partData = {
        id: part.id,
        name: part.name,
        model: part.name,
        short_code: barcodeValue,
        barcode: barcodeValue,
        code: barcodeValue,
        category: part.category || 'قطعة صيانة',
        price: part.sell_price || part.unit_cost || 0,
        sell_price: part.sell_price || 0
      };

      window.BarcodeGenerator.showBarcodePreviewModal(partData, 'accessory');
      Logger.log('[BARCODE] Showing preview for part:', part.name, 'barcode:', barcodeValue);
    }
    // أو استخدام BarcodeService مباشرة
    else if (window.BarcodeService && typeof window.BarcodeService.printLabels === 'function') {
      window.BarcodeService.printLabels([{
        id: part.id,
        name: part.name,
        code: barcodeValue,
        short_code: barcodeValue,
        category: part.category || 'قطعة صيانة',
        price: part.sell_price || part.unit_cost || 0
      }], {
        type: 'accessory',
        labelType: 'single',
        copies: 1,
        showPrice: true,
        showShopName: true
      });

      if (typeof showToast === 'function') {
        showToast(`تم طباعة باركود "${part.name}"`, 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast('خدمة الباركود غير متوفرة', 'error');
      }
    }
  } catch (error) {
    Logger.error('Print barcode error:', error);
    if (typeof showToast === 'function') {
      showToast('فشل في طباعة الباركود: ' + error.message, 'error');
    }
  }
}

// ═════════════════════════════════════
// 📷 BARCODE SCANNER SUPPORT
// ═════════════════════════════════════
let barcodeBuffer = '';
let barcodeTimeout = null;
let currentDetailsPart = null; // القطعة المعروضة حالياً في موديل التفاصيل

function initBarcodeScanner() {
  document.addEventListener('keypress', (e) => {
    // تجاهل إذا كان المستخدم يكتب في حقل إدخال
    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.tagName === 'SELECT') {
      return;
    }

    // مسح المؤقت
    clearTimeout(barcodeTimeout);

    // إضافة الحرف للـ buffer
    if (e.key !== 'Enter') {
      barcodeBuffer += e.key;
    }

    // مؤقت لمعالجة الباركود
    barcodeTimeout = setTimeout(() => {
      // باركود قطع الصيانة: 90000-99999 (5 أرقام)
      if (barcodeBuffer.length === 5 && /^\d{5}$/.test(barcodeBuffer)) {
        processPartBarcode(barcodeBuffer);
      }
      barcodeBuffer = '';
    }, 100);

    // معالجة عند الضغط على Enter
    if (e.key === 'Enter' && barcodeBuffer.length >= 4) {
      // باركود قطع الصيانة: 90000-99999 (5 أرقام)
      if (/^\d{5}$/.test(barcodeBuffer)) {
        processPartBarcode(barcodeBuffer);
      }
      barcodeBuffer = '';
    }
  });

  Logger.log('📷 Barcode scanner initialized for repair parts');
}

async function processPartBarcode(code) {
  Logger.log('📷 Barcode scanned:', code);

  // تشغيل صوت المسح
  if (typeof SoundFX !== 'undefined' && SoundFX.play) {
    SoundFX.play('scan');
  }

  const cleanCode = String(code).trim();

  // البحث عن القطعة بالباركود
  const part = allParts.find(p => {
    const partBarcode = String(p.barcode || '').trim();
    const partSku = String(p.sku || '').trim();
    return partBarcode === cleanCode || partSku === cleanCode;
  });

  if (part) {
    showPartDetails(part);
  } else {
    if (typeof showToast === 'function') {
      showToast(`لم يتم العثور على قطعة بالباركود: ${cleanCode}`, 'warning');
    }
  }
}

function showPartDetails(part) {
  currentDetailsPart = part;

  const modal = document.getElementById('partDetailsModal');
  const body = document.getElementById('partDetailsBody');

  if (!modal || !body) return;

  // تحديد حالة المخزون
  let stockClass = '';
  let stockStatus = 'متوفر';
  if (part.qty <= 0) {
    stockClass = 'danger';
    stockStatus = 'نفذ';
  } else if (part.qty <= (part.min_qty || 0)) {
    stockClass = 'warning';
    stockStatus = 'منخفض';
  }

  body.innerHTML = `
    <div class="part-header">
      <div class="part-name">${window.escapeHtml(part.name)}</div>
      <div class="part-barcode">باركود: ${part.barcode || '-'}</div>
    </div>

    <div class="detail-row">
      <span class="detail-label">الفئة</span>
      <span class="detail-value">${window.escapeHtml(part.category || '-')}</span>
    </div>

    <div class="detail-row">
      <span class="detail-label">SKU</span>
      <span class="detail-value">${window.escapeHtml(part.sku || '-')}</span>
    </div>

    <div class="detail-row">
      <span class="detail-label">سعر التكلفة</span>
      <span class="detail-value">${window.fmt(part.unit_cost || 0)} ج.م</span>
    </div>

    <div class="detail-row">
      <span class="detail-label">سعر البيع</span>
      <span class="detail-value price">${window.fmt(part.sell_price || 0)} ج.م</span>
    </div>

    <div class="detail-row">
      <span class="detail-label">الكمية المتاحة</span>
      <span class="detail-value ${stockClass}">${part.qty || 0}</span>
    </div>

    <div class="detail-row">
      <span class="detail-label">الحد الأدنى</span>
      <span class="detail-value">${part.min_qty || 0}</span>
    </div>

    <div class="detail-row">
      <span class="detail-label">الحالة</span>
      <span class="detail-value ${stockClass}">${stockStatus}</span>
    </div>

    ${part.notes ? `
    <div class="detail-row">
      <span class="detail-label">ملاحظات</span>
      <span class="detail-value">${window.escapeHtml(part.notes)}</span>
    </div>
    ` : ''}
  `;

  modal.classList.add('active');

  // إضافة event listener للإغلاق
  const closeBtn = document.getElementById('partDetailsModalClose');
  if (closeBtn) {
    closeBtn.onclick = closePartDetailsModal;
  }

  // إغلاق عند الضغط على الخلفية
  modal.onclick = (e) => {
    if (e.target === modal) closePartDetailsModal();
  };
}

function closePartDetailsModal() {
  const modal = document.getElementById('partDetailsModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentDetailsPart = null;
}

function editFromDetails() {
  if (currentDetailsPart) {
    closePartDetailsModal();
    openEditPartModal(currentDetailsPart.id);
  }
}

function printFromDetails() {
  if (currentDetailsPart) {
    printPartBarcode(currentDetailsPart.id);
  }
}

// فتح تفاصيل القطعة من الجدول
function openPartDetails(partId) {
  const part = allParts.find(p => p.id === parseInt(partId));
  if (part) {
    showPartDetails(part);
  } else {
    if (typeof showToast === 'function') {
      showToast('القطعة غير موجودة', 'error');
    }
  }
}

// ═════════════════════════════════════
// ✅ SELECTION SYSTEM
// ═════════════════════════════════════
function toggleSelectAll(checked) {
  filteredParts.forEach(part => {
    if (checked) {
      selectedItems.add(part.id);
    } else {
      selectedItems.delete(part.id);
    }
  });

  // Update checkboxes
  document.querySelectorAll('.part-row-checkbox').forEach(cb => {
    cb.checked = checked;
    const row = cb.closest('tr');
    if (row) row.classList.toggle('selected-row', checked);
  });

  updateSelectionUI();
  Logger.log('[SELECTION] Select all:', checked, 'Total:', selectedItems.size);
}

function toggleRowSelection(id, checked) {
  const partId = parseInt(id);
  if (checked) {
    selectedItems.add(partId);
  } else {
    selectedItems.delete(partId);
  }

  // Update row visual
  const row = document.querySelector(`tr[data-id="${partId}"]`);
  if (row) row.classList.toggle('selected-row', checked);

  updateSelectAllCheckbox();
  updateSelectionUI();
  Logger.log('[SELECTION] Row', partId, checked ? 'selected' : 'deselected', 'Total:', selectedItems.size);
}

function updateSelectAllCheckbox() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.part-row-checkbox');
  const checkedCount = document.querySelectorAll('.part-row-checkbox:checked').length;

  if (selectAll) {
    selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }
}

function updateSelectionUI() {
  const count = selectedItems.size;
  const countEl = document.getElementById('selectionCount');
  const actionsEl = document.getElementById('selectionActions');
  const transferBtn = document.getElementById('btnBulkTransfer');
  const avgBtn = document.getElementById('btnAveragePrices');

  if (countEl) countEl.textContent = `تم تحديد: ${count}`;
  if (actionsEl) actionsEl.classList.toggle('visible', count > 0);
  if (transferBtn) transferBtn.disabled = count === 0;
  // زر توحيد الأسعار يظهر فقط إذا كان أكثر من صنف محدد
  if (avgBtn) avgBtn.disabled = count < 2;
  const printBarcodeBtn = document.getElementById('btnPrintBarcodesSelection');
  if (printBarcodeBtn) printBarcodeBtn.disabled = count === 0;
}

function clearSelection() {
  selectedItems.clear();

  document.querySelectorAll('.part-row-checkbox').forEach(cb => {
    cb.checked = false;
    const row = cb.closest('tr');
    if (row) row.classList.remove('selected-row');
  });

  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }

  updateSelectionUI();
  Logger.log('[SELECTION] Cleared');
}

/**
 * طباعة باركود للقطع المحددة — عدد النسخ = الكمية في المخزن لكل قطعة
 */
function printSelectedPartsBarcodes() {
  if (selectedItems.size === 0) {
    if (typeof showToast === 'function') showToast('حدد قطعاً أولاً', 'warning');
    return;
  }
  const selectedParts = allParts.filter(p => selectedItems.has(p.id));
  if (selectedParts.length === 0) {
    if (typeof showToast === 'function') showToast('لا توجد قطع محددة', 'warning');
    return;
  }
  const toPrint = [];
  let skipped = 0;
  for (const part of selectedParts) {
    const code = String(part.short_code || part.barcode || part.sku || '').trim();
    if (!code) {
      skipped++;
      continue;
    }
    const qty = Math.max(1, parseInt(part.quantity, 10) || 1);
    const base = {
      id: part.id,
      name: part.name,
      short_code: code,
      barcode: code,
      code: code,
      sku: code,
      sell_price: part.sell_price,
      sale_price: part.sell_price,
      unit_cost: part.unit_cost,
      quantity: part.quantity
    };
    for (let i = 0; i < qty; i++) toPrint.push({ ...base });
  }
  if (toPrint.length === 0) {
    if (typeof showToast === 'function') showToast(skipped ? 'القطع المحددة لا تحتوي على باركود' : 'لا يوجد ما يطبع', 'warning');
    return;
  }
  if (typeof BarcodeGenerator !== 'undefined' && BarcodeGenerator.printMultipleBarcodes) {
    BarcodeGenerator.printMultipleBarcodes(toPrint, { type: 'accessory', skipShortCodeGeneration: true }).then(() => {
      if (typeof showToast === 'function') showToast(`تم إرسال ${toPrint.length} باركود للطباعة`, 'success');
    }).catch(err => {
      Logger.error('[PRINT] printSelectedPartsBarcodes error:', err);
      if (typeof showToast === 'function') showToast('فشل في الطباعة', 'error');
    });
  } else {
    if (typeof showToast === 'function') showToast('نظام الباركود غير متاح', 'error');
  }
}

// ═════════════════════════════════════
// 🗑️ DELETE PART SYSTEM
// ═════════════════════════════════════
function confirmDeletePart(partId, partName, qty) {
  // عرض مودال التأكيد مع تحذير
  const modal = document.getElementById('deleteConfirmModal');
  const nameEl = document.getElementById('deletePartName');
  const qtyWarning = document.getElementById('deleteQtyWarning');
  const confirmBtn = document.getElementById('btnConfirmDelete');

  if (nameEl) nameEl.textContent = partName;

  // تحذير إذا كان هناك كمية
  if (qtyWarning) {
    if (qty > 0) {
      qtyWarning.innerHTML = `<span style="color: var(--danger);">⚠️ تحذير: هذه القطعة تحتوي على كمية (${qty}) سيتم حذفها نهائياً!</span>`;
      qtyWarning.style.display = 'block';
    } else {
      qtyWarning.style.display = 'none';
    }
  }

  // حفظ معرف القطعة للحذف
  if (confirmBtn) {
    confirmBtn.onclick = () => deletePart(partId);
  }

  if (modal) modal.classList.add('active');
  Logger.log('[DELETE] Confirm modal opened for:', partId, partName);
}

function closeDeleteConfirmModal() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.classList.remove('active');
}

async function deletePart(partId) {
  const btn = document.getElementById('btnConfirmDelete');
  const originalHtml = btn?.innerHTML;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> <span>جاري الحذف...</span>';
  }

  try {
    Logger.log('[DELETE] Deleting part:', partId);

    const response = await apiRequest(`repair-parts/${partId}`, {
      method: 'DELETE'
    });

    Logger.log('[DELETE] Success:', response);
    closeDeleteConfirmModal();
    showToast('تم حذف القطعة بنجاح', 'success');
    if (window.SoundFX) window.SoundFX.play('success');

    // إزالة من التحديد إن وجد
    selectedItems.delete(partId);
    updateSelectionUI();

    // إعادة تحميل البيانات
    await loadParts();

  } catch (error) {
    Logger.error('[DELETE] Error:', error);
    showToast('خطأ في الحذف: ' + error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// ═════════════════════════════════════
// 📦 BULK TRANSFER SYSTEM
// ═════════════════════════════════════
async function loadWarehouses() {
  try {
    const response = await apiRequest('warehouses');
    // الـ API بترجع { warehouses: [...] }
    allWarehouses = Array.isArray(response) ? response : (response?.warehouses || []);
    Logger.log('[WAREHOUSES] Loaded:', allWarehouses.length);
  } catch (error) {
    Logger.error('Failed to load warehouses:', error);
    allWarehouses = [];
  }
}

function openBulkTransferModal() {
  if (selectedItems.size === 0) {
    showToast('يرجى تحديد قطعة واحدة على الأقل', 'warning');
    return;
  }

  // Update count
  const countEl = document.getElementById('transferItemsCount');
  if (countEl) countEl.textContent = selectedItems.size;

  // Populate target warehouse dropdown
  const targetSelect = document.getElementById('targetWarehouse');
  if (targetSelect) {
    // Filter to only repair parts warehouses
    // storage_type يمكن يكون 'spare_parts' أو 'repair_parts'
    const repairPartsWarehouses = allWarehouses.filter(w => {
      if (w.id === parseInt(CURRENT_WAREHOUSE_ID)) return false;
      // المخزن الرئيسي لقطع الصيانة
      if (w.type === 'repair_parts') return true;
      // المخازن التخزينية (spare_parts أو repair_parts)
      if (w.is_storage_only === 1 && (w.storage_type === 'spare_parts' || w.storage_type === 'repair_parts')) return true;
      return false;
    });

    if (repairPartsWarehouses.length === 0) {
      targetSelect.innerHTML = '<option value="">-- لا توجد مخازن متاحة --</option>';
    } else {
      targetSelect.innerHTML = '<option value="">-- اختر المخزن الوجهة --</option>' +
        repairPartsWarehouses.map(w =>
          `<option value="${w.id}">${w.icon || '🔧'} ${window.escapeHtml(w.name)}</option>`
        ).join('');
    }
  }

  // Render selected items list
  renderTransferItemsList();

  // Clear notes
  const notesEl = document.getElementById('transferNotes');
  if (notesEl) notesEl.value = '';

  // Show modal
  const modal = document.getElementById('bulkTransferModal');
  if (modal) modal.classList.add('active');

  Logger.log('[TRANSFER] Modal opened with', selectedItems.size, 'items');
}

function closeBulkTransferModal() {
  const modal = document.getElementById('bulkTransferModal');
  if (modal) modal.classList.remove('active');
}

function renderTransferItemsList() {
  const listEl = document.getElementById('transferItemsList');
  if (!listEl) return;

  const selectedParts = allParts.filter(p => selectedItems.has(p.id));

  if (selectedParts.length === 0) {
    listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">لا توجد قطع محددة</div>';
    return;
  }

  listEl.innerHTML = selectedParts.map(part => `
    <div class="transfer-item" data-id="${part.id}">
      <span class="transfer-item-icon">🔧</span>
      <div class="transfer-item-info">
        <div class="transfer-item-name">${window.escapeHtml(part.name)}</div>
        <div class="transfer-item-meta">${window.escapeHtml(part.category || '-')} | ${window.escapeHtml(part.sku || part.barcode || '-')}</div>
      </div>
      <div class="transfer-item-qty" style="display: flex; flex-direction: column; gap: 6px; min-width: 140px;">
        <span>المتاح: ${part.qty || 0}</span>
        <input
          type="number"
          class="transfer-qty-input"
          data-id="${part.id}"
          min="1"
          max="${part.qty || 1}"
          value="${Math.min(1, part.qty || 1)}"
          style="width: 100%; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary);"
          title="كمية التحويل"
        />
      </div>
      <button class="transfer-item-remove" onclick="removeFromTransfer(${part.id})" title="إزالة">✕</button>
    </div>
  `).join('');

  // Bind quantity validation
  listEl.querySelectorAll('.transfer-qty-input').forEach(input => {
    input.addEventListener('input', () => clampTransferQty(input));
    clampTransferQty(input);
  });
}

function clampTransferQty(input) {
  const max = Number(input.max || input.dataset.max || 1);
  let value = parseInt(input.value, 10);
  if (!Number.isFinite(value) || value < 1) value = 1;
  if (Number.isFinite(max) && max > 0 && value > max) value = max;
  input.value = value;
}

function removeFromTransfer(id) {
  const partId = parseInt(id);
  selectedItems.delete(partId);

  // Update checkbox in table
  const checkbox = document.querySelector(`.part-row-checkbox[data-id="${partId}"]`);
  if (checkbox) {
    checkbox.checked = false;
    const row = checkbox.closest('tr');
    if (row) row.classList.remove('selected-row');
  }

  updateSelectAllCheckbox();
  updateSelectionUI();

  // Update modal
  const countEl = document.getElementById('transferItemsCount');
  if (countEl) countEl.textContent = selectedItems.size;
  renderTransferItemsList();

  if (selectedItems.size === 0) {
    closeBulkTransferModal();
    showToast('تم إزالة جميع القطع', 'info');
  }

  Logger.log('[TRANSFER] Removed item:', partId, 'Remaining:', selectedItems.size);
}

async function executeBulkTransfer() {
  const targetWarehouseId = document.getElementById('targetWarehouse')?.value;
  const notes = document.getElementById('transferNotes')?.value || '';

  if (!targetWarehouseId) {
    showToast('يرجى اختيار المخزن الوجهة', 'warning');
    return;
  }

  if (selectedItems.size === 0) {
    showToast('لا توجد قطع للتحويل', 'warning');
    return;
  }

  // Build items array with selected quantity per item
  const items = [];
  for (const id of selectedItems) {
    const part = allParts.find(p => p.id === id);
    if (part && part.qty > 0) {
      const qtyInput = document.querySelector(`.transfer-qty-input[data-id="${id}"]`);
      let qty = qtyInput ? parseInt(qtyInput.value, 10) : part.qty;
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      if (qty > part.qty) qty = part.qty;
      items.push({
        item_type: 'repair_part',
        item_id: id,
        quantity: qty
      });
    }
  }

  if (items.length === 0) {
    showToast('لا توجد قطع متاحة للتحويل (الكمية = 0)', 'warning');
    return;
  }

  // Determine source warehouse
  let sourceWarehouseId = CURRENT_WAREHOUSE_ID;
  if (!sourceWarehouseId) {
    const repairPartsWarehouse = allWarehouses.find(w => w.type === 'repair_parts' && !w.is_storage_only);
    if (repairPartsWarehouse) {
      sourceWarehouseId = repairPartsWarehouse.id;
    } else {
      showToast('لم يتم العثور على المخزن المصدر', 'error');
      return;
    }
  }

  // Disable button
  const btn = document.getElementById('btnExecuteTransfer');
  const originalHtml = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> <span>جاري التحويل...</span>';
  }

  try {
    Logger.log('[TRANSFER] Starting bulk transfer:', {
      from: sourceWarehouseId,
      to: targetWarehouseId,
      items: items.length
    });

    const response = await fetch('elos-db://warehouse-transfers/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_warehouse_id: parseInt(sourceWarehouseId),
        to_warehouse_id: parseInt(targetWarehouseId),
        items: items,
        notes: notes
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'فشل التحويل');
    }

    Logger.log('[TRANSFER] Success:', result);
    closeBulkTransferModal();
    showToast(result.message || `تم تحويل ${result.transfers?.length || items.length} قطعة بنجاح`, 'success');
    if (window.SoundFX) window.SoundFX.play('success');

    // Clear selection and reload
    clearSelection();
    await loadParts();

  } catch (error) {
    Logger.error('[TRANSFER] Error:', error);
    showToast('خطأ في التحويل: ' + error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// ═════════════════════════════════════
// 📊 AVERAGE PRICES - توحيد الأسعار
// ═════════════════════════════════════
function openAveragePricesModal() {
  Logger.log('[AVG_PRICES] Opening modal, selectedItems:', selectedItems.size);

  if (selectedItems.size < 2) {
    showToast('يرجى تحديد قطعتين على الأقل لتوحيد الأسعار', 'warning');
    return;
  }

  const modal = document.getElementById('averagePricesModal');
  Logger.log('[AVG_PRICES] Modal element:', modal);
  if (!modal) {
    Logger.error('[AVG_PRICES] Modal not found!');
    showToast('خطأ: لم يتم العثور على نافذة توحيد الأسعار', 'error');
    return;
  }

  // Get selected parts data
  const selectedParts = allParts.filter(p => selectedItems.has(p.id));

  if (selectedParts.length < 2) {
    showToast('يرجى تحديد قطعتين على الأقل', 'warning');
    return;
  }

  // Update count
  document.getElementById('avgPartsCount').textContent = selectedParts.length;

  // Render parts list
  const listEl = document.getElementById('avgPartsList');
  listEl.innerHTML = selectedParts.map(p => `
    <div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border-color);">
      <span style="font-size: 18px;">🔧</span>
      <div style="flex: 1;">
        <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${escapeHtml(p.name)}</div>
        <div style="font-size: 11px; color: var(--text-secondary);">${p.category || '-'} | الكمية: ${p.quantity}</div>
      </div>
      <div style="text-align: left; font-size: 12px;">
        <div style="color: var(--danger);">شراء: ${fmt(p.unit_cost || 0)}</div>
        <div style="color: var(--success);">بيع: ${fmt(p.sell_price || 0)}</div>
      </div>
    </div>
  `).join('');

  // Calculate statistics - في قطع الغيار اسم الـ field هو unit_cost وليس purchase_price
  const purchasePrices = selectedParts.map(p => Number(p.unit_cost || 0));
  const salePrices = selectedParts.map(p => Number(p.sell_price || 0));

  const avgPurchase = Math.round(purchasePrices.reduce((a, b) => a + b, 0) / purchasePrices.length);
  const avgSale = Math.round(salePrices.reduce((a, b) => a + b, 0) / salePrices.length);
  const minPurchase = Math.min(...purchasePrices);
  const maxPurchase = Math.max(...purchasePrices);
  const minSale = Math.min(...salePrices);
  const maxSale = Math.max(...salePrices);

  // Update UI
  document.getElementById('avgPartMinPurchase').textContent = fmt(minPurchase) + ' ج.م';
  document.getElementById('avgPartMaxPurchase').textContent = fmt(maxPurchase) + ' ج.م';
  document.getElementById('avgPartAvgPurchase').textContent = fmt(avgPurchase) + ' ج.م';

  document.getElementById('avgPartMinSale').textContent = fmt(minSale) + ' ج.م';
  document.getElementById('avgPartMaxSale').textContent = fmt(maxSale) + ' ج.م';
  document.getElementById('avgPartAvgSale').textContent = fmt(avgSale) + ' ج.م';

  const expectedProfit = avgSale - avgPurchase;
  document.getElementById('avgPartExpectedProfit').textContent = fmt(expectedProfit) + ' ج.م';
  document.getElementById('avgPartExpectedProfit').style.color = expectedProfit >= 0 ? 'var(--success)' : 'var(--danger)';

  // Store calculated values
  modal.dataset.avgPurchase = avgPurchase;
  modal.dataset.avgSale = avgSale;
  modal.dataset.itemIds = JSON.stringify(Array.from(selectedItems));

  modal.classList.add('active');
  Logger.log('[AVG_PRICES] Modal opened successfully');
}

function closeAveragePricesModal() {
  const modal = document.getElementById('averagePricesModal');
  if (modal) modal.classList.remove('active');
}

async function applyPartAveragePrices() {
  const modal = document.getElementById('averagePricesModal');
  const applyPurchase = document.getElementById('avgPartApplyPurchase')?.checked;
  const applySale = document.getElementById('avgPartApplySale')?.checked;

  if (!applyPurchase && !applySale) {
    showToast('يرجى اختيار خيار واحد على الأقل للتوحيد', 'warning');
    return;
  }

  const avgPurchase = Number(modal.dataset.avgPurchase || 0);
  const avgSale = Number(modal.dataset.avgSale || 0);
  const itemIds = JSON.parse(modal.dataset.itemIds || '[]');

  if (itemIds.length < 2) {
    showToast('لا توجد قطع كافية', 'warning');
    return;
  }

  // Confirmation
  const confirmMsg = `هل أنت متأكد من توحيد أسعار ${itemIds.length} قطعة؟\n\n` +
    (applyPurchase ? `✓ سعر الشراء الجديد: ${fmt(avgPurchase)} ج.م\n` : '') +
    (applySale ? `✓ سعر البيع الجديد: ${fmt(avgSale)} ج.م` : '');

  if (!confirm(confirmMsg)) return;

  // Disable button
  const btn = document.getElementById('btnApplyPartAveragePrices');
  const originalHtml = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>جاري التطبيق...</span>';
  }

  try {
    const response = await fetch('elos-db://repair-parts/average-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_ids: itemIds,
        avg_purchase_price: applyPurchase ? avgPurchase : null,
        avg_sale_price: applySale ? avgSale : null
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'فشل تطبيق المتوسط');
    }

    showToast(`✅ تم توحيد أسعار ${result.updated} قطعة بنجاح`, 'success');
    if (window.SoundFX) window.SoundFX.play('success');

    closeAveragePricesModal();
    clearSelection();
    await loadParts();

  } catch (error) {
    Logger.error('[AVERAGE_PRICES] Error:', error);
    showToast('خطأ: ' + error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// ═════════════════════════════════════
// 🌐 MAKE FUNCTIONS GLOBAL
// ═════════════════════════════════════
window.openEditPartModal = openEditPartModal;
window.openAdjustModal = openAdjustModal;
window.printPartBarcode = printPartBarcode;
window.closePartDetailsModal = closePartDetailsModal;
window.editFromDetails = editFromDetails;
window.printFromDetails = printFromDetails;
window.openPartDetails = openPartDetails;
window.toggleSelectAll = toggleSelectAll;
window.toggleRowSelection = toggleRowSelection;
window.clearSelection = clearSelection;
window.openBulkTransferModal = openBulkTransferModal;
window.closeBulkTransferModal = closeBulkTransferModal;
window.removeFromTransfer = removeFromTransfer;
window.executeBulkTransfer = executeBulkTransfer;
window.confirmDeletePart = confirmDeletePart;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;
window.deletePart = deletePart;
window.openAveragePricesModal = openAveragePricesModal;
window.closeAveragePricesModal = closeAveragePricesModal;
window.applyPartAveragePrices = applyPartAveragePrices;

// ═════════════════════════════════════
// 🚀 INITIALIZATION
// ═════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  Logger.log('🔧 Repair Parts page initialized');

  // استخراج warehouse_id و warehouse_name من URL أو SPA params
  const urlParams = new URLSearchParams(window.location.search);
  CURRENT_WAREHOUSE_ID = urlParams.get('warehouse_id') ||
                         (window.__SPA_PARAMS__ && window.__SPA_PARAMS__.warehouse_id) ||
                         null;
  CURRENT_WAREHOUSE_NAME = urlParams.get('warehouse_name') ||
                           (window.__SPA_PARAMS__ && window.__SPA_PARAMS__.warehouse_name) ||
                           null;

  if (CURRENT_WAREHOUSE_ID) {
    Logger.log('📦 Filtering by warehouse_id:', CURRENT_WAREHOUSE_ID);
    // جلب اسم المخزن إذا لم يكن موجوداً
    loadWarehouseInfo();
  }

  // Initialize barcode scanner
  initBarcodeScanner();
  Logger.log('📷 Barcode scanner ready');

  // Load data
  loadParts();
  loadWarehouses(); // تحميل المخازن للتحويل
  
  // Event listeners
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        filterParts();
      }, 300);
    });
  }
  
  const btnAddPart = document.getElementById('btnAddPart');
  if (btnAddPart) {
    btnAddPart.addEventListener('click', openAddPartModal);
  }
  
  const partModalClose = document.getElementById('partModalClose');
  const btnCancelPart = document.getElementById('btnCancelPart');
  if (partModalClose) partModalClose.addEventListener('click', closePartModal);
  if (btnCancelPart) btnCancelPart.addEventListener('click', closePartModal);
  
  const partForm = document.getElementById('partForm');
  if (partForm) {
    partForm.addEventListener('submit', handlePartSubmit);
  }
  
  const adjustModalClose = document.getElementById('adjustModalClose');
  const btnCancelAdjust = document.getElementById('btnCancelAdjust');
  if (adjustModalClose) adjustModalClose.addEventListener('click', closeAdjustModal);
  if (btnCancelAdjust) btnCancelAdjust.addEventListener('click', closeAdjustModal);
  
  const adjustForm = document.getElementById('adjustForm');
  if (adjustForm) {
    adjustForm.addEventListener('submit', handleAdjustSubmit);
  }
  
  // Close modals on overlay click
  const partModal = document.getElementById('partModal');
  const adjustModal = document.getElementById('adjustModal');
  const bulkTransferModal = document.getElementById('bulkTransferModal');

  if (partModal) {
    partModal.addEventListener('click', (e) => {
      if (e.target === partModal) closePartModal();
    });
  }

  if (adjustModal) {
    adjustModal.addEventListener('click', (e) => {
      if (e.target === adjustModal) closeAdjustModal();
    });
  }

  if (bulkTransferModal) {
    bulkTransferModal.addEventListener('click', (e) => {
      if (e.target === bulkTransferModal) closeBulkTransferModal();
    });
  }

  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  if (deleteConfirmModal) {
    deleteConfirmModal.addEventListener('click', (e) => {
      if (e.target === deleteConfirmModal) closeDeleteConfirmModal();
    });
  }

  // ═════════════════════════════════════
  // ✅ SELECTION EVENT LISTENERS
  // ═════════════════════════════════════
  // Select All checkbox
  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      toggleSelectAll(e.target.checked);
    });
  }

  // Row checkboxes - Event Delegation
  const partsTableBody = document.getElementById('partsTableBody');
  if (partsTableBody) {
    partsTableBody.addEventListener('change', (e) => {
      if (e.target.matches('.part-row-checkbox')) {
        toggleRowSelection(e.target.dataset.id, e.target.checked);
      }
    });
  }

  // Clear Selection button
  const btnClearSelection = document.getElementById('btnClearSelection');
  if (btnClearSelection) {
    btnClearSelection.addEventListener('click', clearSelection);
  }

  // Bulk Transfer button
  const btnBulkTransfer = document.getElementById('btnBulkTransfer');
  if (btnBulkTransfer) {
    btnBulkTransfer.addEventListener('click', openBulkTransferModal);
  }

  // Average Prices button
  const btnAveragePrices = document.getElementById('btnAveragePrices');
  if (btnAveragePrices) {
    btnAveragePrices.addEventListener('click', openAveragePricesModal);
  }
  const btnPrintBarcodesSelection = document.getElementById('btnPrintBarcodesSelection');
  if (btnPrintBarcodesSelection) {
    btnPrintBarcodesSelection.addEventListener('click', printSelectedPartsBarcodes);
  }

  Logger.log('✅ Selection system initialized');
});

