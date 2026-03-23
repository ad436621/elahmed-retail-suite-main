// ═══════════════════════════════════════════════════════════════════════════
// ELOS ACCESSORIES INVENTORY SYSTEM - Clean Rebuild v2.0
// ═══════════════════════════════════════════════════════════════════════════
// Features:
// - Idempotent initialization with global guard
// - AbortController for fetch cancellation
// - Event delegation to prevent listener leaks
// - Bulk selection with Set-based tracking
// - Bulk transfer workflow
// - Clean SPA navigation support
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ═══════════════════════════════════════
  // INIT GUARD - Prevent double execution
  // ═══════════════════════════════════════
  if (window.__ELOS_ACCESSORIES_INIT__) {
    console.log('[ACCESSORIES] Already initialized, skipping');
    return;
  }
  window.__ELOS_ACCESSORIES_INIT__ = true;

  console.log('[ACCESSORIES] Initializing Accessories Inventory System v2.0');

  // ═══════════════════════════════════════
  // GLOBAL STATE
  // ═══════════════════════════════════════
  let currentWarehouseId = null;
  let currentWarehouseIsMain = false; // مخزن رئيسي: نعرض أيضاً الأصناف ذات warehouse_id = null
  let allAccessories = [];      // Current page accessories
  let fullAccessoriesList = []; // All accessories for client-side pagination
  let allSuppliers = [];
  let allWarehouses = [];
  let selectedItems = new Set(); // Keyed by accessory ID

  // Pagination State
  let currentPage = 1;
  let rowsPerPage = 25;  // تصغير عدد الصفوف لكل صفحة
  let totalItems = 0;
  let totalPages = 0;
  let useClientPagination = false; // true when API returns all data at once

  // Sorting State
  let sortColumn = 'created_at';
  let sortDirection = 'DESC';

  // AbortController for fetch cancellation
  let fetchController = null;

  // ═══════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════
  const Logger = window.Logger || {
    log: (...args) => console.log('[ACCESSORIES]', ...args),
    warn: (...args) => console.warn('[ACCESSORIES]', ...args),
    error: (...args) => console.error('[ACCESSORIES]', ...args),
    debug: (...args) => console.debug('[ACCESSORIES]', ...args)
  };

  const fmt = window.fmt || ((n, decimals = 2) =>
    Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  );

  const escapeHtml = window.escapeHtml || ((text) => {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  });

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0) + ' EGP';
  }

  function debounce(func, delay = 300) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  // ═══════════════════════════════════════
  // WAREHOUSE DETECTION
  // ═══════════════════════════════════════
  async function detectWarehouseId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlWid = urlParams.get('warehouse_id') || urlParams.get('id');
    const savedWid = localStorage.getItem('currentWarehouseId');

    Logger.log('[WAREHOUSE] URL warehouse_id:', urlWid);
    Logger.log('[WAREHOUSE] Saved warehouse_id:', savedWid);

    // Priority 1: URL parameter (MOST IMPORTANT - for storage warehouses)
    // This allows opening specific storage warehouses instead of always using the main one
    if (urlWid) {
      const parsed = parseInt(urlWid);
      if (!isNaN(parsed) && parsed > 0) {
        try {
          // Validate the warehouse exists
          const response = await fetch('elos-db://warehouses');
          const data = await response.json();
          const warehouses = data.warehouses || data || [];
          const urlWarehouse = warehouses.find(w => w.id === parsed && w.is_active !== 0);

          if (urlWarehouse) {
            currentWarehouseId = parsed;
            currentWarehouseIsMain = urlWarehouse.type === 'accessories' && !urlWarehouse.is_storage_only;
            localStorage.setItem('currentWarehouseId', String(parsed));
            Logger.log('[WAREHOUSE] ✅ Using warehouse from URL:', parsed, urlWarehouse.name, 'type:', urlWarehouse.type, 'storage_type:', urlWarehouse.storage_type, 'isMain:', currentWarehouseIsMain);
            return;
          }
        } catch (e) {
          Logger.error('[WAREHOUSE] Error validating URL warehouse:', e);
        }

        // Even if API fails, trust the URL parameter
        currentWarehouseId = parsed;
        currentWarehouseIsMain = false;
        localStorage.setItem('currentWarehouseId', String(parsed));
        Logger.log('[WAREHOUSE] Using warehouse_id from URL (validation skipped):', parsed);
        return;
      }
    }

    // Priority 2: Find the default accessories warehouse from API
    try {
      const response = await fetch('elos-db://warehouses');
      const data = await response.json();
      const warehouses = data.warehouses || data || [];
      Logger.log('[WAREHOUSE] Loaded warehouses:', warehouses.map(w => ({id: w.id, name: w.name, type: w.type})));

      const accessoriesWh = warehouses.find(w => w.type === 'accessories' && w.is_active !== 0);
      if (accessoriesWh) {
        currentWarehouseId = accessoriesWh.id;
        currentWarehouseIsMain = !accessoriesWh.is_storage_only;
        localStorage.setItem('currentWarehouseId', String(accessoriesWh.id));
        Logger.log('[WAREHOUSE] Found default accessories warehouse:', accessoriesWh.id, accessoriesWh.name, 'isMain:', currentWarehouseIsMain);
        return;
      }

      // If we have warehouses but none match, just show all accessories
      if (warehouses.length > 0) {
        Logger.log('[WAREHOUSE] No specific accessories warehouse found, will show all accessories');
        currentWarehouseId = null;
        currentWarehouseIsMain = false;
        return;
      }
    } catch (e) {
      Logger.error('[WAREHOUSE] Error finding accessories warehouse:', e);
    }

    // Priority 3: localStorage fallback
    if (savedWid && savedWid !== 'null' && savedWid !== '') {
      const parsed = parseInt(savedWid);
      if (!isNaN(parsed) && parsed > 0) {
        currentWarehouseId = parsed;
        currentWarehouseIsMain = false;
        Logger.log('[WAREHOUSE] Using warehouse_id from localStorage:', parsed);
        return;
      }
    }

    // Default: null (will show all accessories - the API handles this)
    Logger.warn('[WAREHOUSE] No warehouse ID found, showing all accessories');
    currentWarehouseId = null;
    currentWarehouseIsMain = false;
  }

  // ═══════════════════════════════════════
  // API FUNCTIONS
  // ═══════════════════════════════════════
  async function fetchWithAbort(url, options = {}) {
    // Cancel previous request
    if (fetchController) {
      fetchController.abort();
    }
    fetchController = new AbortController();

    try {
      const response = await fetch(url, {
        ...options,
        signal: fetchController.signal
      });
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        Logger.debug('[FETCH] Request aborted:', url);
        return null;
      }
      throw err;
    }
  }

  async function loadAccessories() {
    showLoading(true);

    const search = document.getElementById('qSearch')?.value.trim().toLowerCase() || '';
    const category = document.getElementById('fCategory')?.value || '';
    const condition = document.getElementById('fCondition')?.value || '';
    const quantityFilter = document.getElementById('fQuantity')?.value || '';

    Logger.log('[FETCH] Loading accessories, page:', currentPage, 'rowsPerPage:', rowsPerPage);

    try {
      // Fetch all data from API (it returns all accessories)
      const response = await fetchWithAbort(`elos-db://accessories`);
      if (!response) return; // Aborted

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load accessories');
      }

      // Store all accessories
      let allData = Array.isArray(data) ? data : (data.accessories || []);

      // Filter by is_active
      allData = allData.filter(a => a.is_active !== 0);

      Logger.log('[FETCH] Total accessories from API:', allData.length);
      Logger.log('[FETCH] Current warehouse_id:', currentWarehouseId);

      // ✅ Filter by warehouse_id: مخزن رئيسي → نعرض أيضاً warehouse_id = null؛ تخزيني → مطابقة فقط
      if (currentWarehouseId) {
        const wid = Number(currentWarehouseId);
        allData = allData.filter(a => {
          const aw = a.warehouse_id == null ? null : Number(a.warehouse_id);
          if (currentWarehouseIsMain) return aw === wid || aw === null;
          return aw === wid;
        });
        Logger.log('[FETCH] After warehouse filter:', allData.length, 'accessories for warehouse', currentWarehouseId, '(isMain:', currentWarehouseIsMain + ')');
      }

      // Apply client-side filters
      let filtered = allData;

      if (search) {
        filtered = filtered.filter(a =>
          (a.name || '').toLowerCase().includes(search) ||
          (a.barcode || '').toLowerCase().includes(search) ||
          (a.short_code || '').toLowerCase().includes(search) ||
          (a.category || '').toLowerCase().includes(search)
        );
      }

      if (category) {
        filtered = filtered.filter(a => a.category === category);
      }

      if (condition) {
        filtered = filtered.filter(a => a.condition === condition);
      }

      if (quantityFilter === 'available') {
        filtered = filtered.filter(a => (a.quantity || 0) > 5);
      } else if (quantityFilter === 'low') {
        filtered = filtered.filter(a => (a.quantity || 0) > 0 && (a.quantity || 0) <= 5);
      } else if (quantityFilter === 'out') {
        filtered = filtered.filter(a => (a.quantity || 0) === 0);
      }

      // Apply client-side sorting
      filtered.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        // Handle nulls
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        // Numeric comparison for certain columns
        if (['quantity', 'purchase_price', 'sale_price', 'id'].includes(sortColumn)) {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        }

        let cmp = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          cmp = valA - valB;
        } else {
          cmp = String(valA).localeCompare(String(valB), 'ar');
        }

        return sortDirection === 'DESC' ? -cmp : cmp;
      });

      // Store for pagination
      fullAccessoriesList = filtered;
      totalItems = filtered.length;
      totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
      useClientPagination = true;

      // Get current page slice
      const startIndex = (currentPage - 1) * rowsPerPage;
      const endIndex = startIndex + rowsPerPage;
      allAccessories = filtered.slice(startIndex, endIndex);

      Logger.log('[PAGINATION] Page', currentPage, 'of', totalPages, '- Showing', allAccessories.length, 'of', totalItems);

      // Extract unique categories for filter dropdown
      const categories = [...new Set(allData.map(a => a.category).filter(Boolean))].sort();
      updateFilterDropdowns({ categories });

      // Calculate stats from all filtered data
      const totalCost = filtered.reduce((sum, a) => sum + ((a.quantity || 0) * (a.purchase_price || 0)), 0);
      const totalSaleValue = filtered.reduce((sum, a) => sum + ((a.quantity || 0) * (a.sale_price || a.sell_price || 0)), 0);
      updateStats({
        total_items: totalItems,
        available_qty: filtered.reduce((sum, a) => sum + (a.quantity || 0), 0),
        total_value: totalCost,
        low_stock_count: filtered.filter(a => a.quantity > 0 && a.quantity <= 5).length,
        out_of_stock_count: filtered.filter(a => a.quantity === 0).length
      });
      const totalQty = filtered.reduce((sum, a) => sum + (a.quantity || 0), 0);
      updateKpiCards({ count: totalItems, totalQty, totalCost, totalSaleValue });

      renderTable();
      updatePagination();
      updateSelectionUI();

      Logger.log('[TABLE] Rendered', allAccessories.length, 'rows');

    } catch (error) {
      Logger.error('[TABLE] Error loading accessories:', error);
      showToast('خطأ في تحميل البيانات: ' + error.message, 'error');
      allAccessories = [];
      fullAccessoriesList = [];
      totalItems = 0;
      totalPages = 1;
      renderTable();
      updateKpiCards({ count: 0, totalCost: 0, totalSaleValue: 0 });
    } finally {
      showLoading(false);
    }
  }

  async function loadWarehouses() {
    try {
      const response = await fetch('elos-db://warehouses');
      const data = await response.json();
      allWarehouses = (data.warehouses || data || []).filter(w => w.is_active !== 0);
      Logger.log('[WAREHOUSE] Loaded', allWarehouses.length, 'warehouses');

      // Update warehouse name in header
      if (currentWarehouseId) {
        const currentWarehouse = allWarehouses.find(w => w.id === currentWarehouseId);
        if (currentWarehouse) {
          const titleEl = document.getElementById('warehouseName');
          if (titleEl) titleEl.textContent = currentWarehouse.name;
        }
      }

    } catch (error) {
      Logger.error('[WAREHOUSE] Error loading warehouses:', error);
    }
  }

  async function loadSuppliers() {
    try {
      const response = await fetch('elos-db://suppliers');
      const data = await response.json();
      allSuppliers = data.suppliers || data || [];
      Logger.log('[SUPPLIERS] Loaded', allSuppliers.length, 'suppliers');

      // Update supplier dropdowns
      updateSupplierDropdowns();

    } catch (error) {
      Logger.error('[SUPPLIERS] Error loading suppliers:', error);
    }
  }

  // ═══════════════════════════════════════
  // UI UPDATE FUNCTIONS
  // ═══════════════════════════════════════
  function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.toggle('visible', show);
    }
  }

  function updateStats(stats) {
    const totalEl = document.getElementById('statTotalItems');
    const qtyEl = document.getElementById('statAvailableQty');
    const valueEl = document.getElementById('statTotalValue');

    if (totalEl) {
      totalEl.textContent = stats.total_items || 0;
      totalEl.classList.remove('loading');
    }
    if (qtyEl) {
      qtyEl.textContent = stats.available_qty || 0;
      qtyEl.classList.remove('loading');
    }
    if (valueEl) {
      valueEl.textContent = fmt(stats.total_value || 0) + ' ج.م';
      valueEl.classList.remove('loading');
    }
  }

  function updateFilterDropdowns(filterOptions) {
    const categorySelect = document.getElementById('fCategory');
    if (categorySelect && filterOptions.categories) {
      const currentValue = categorySelect.value;
      categorySelect.innerHTML = '<option value="">كل الفئات</option>' +
        filterOptions.categories.map(c =>
          `<option value="${escapeHtml(c)}"${c === currentValue ? ' selected' : ''}>${escapeHtml(c)}</option>`
        ).join('');
    }
  }

  function updateSupplierDropdowns() {
    const selects = ['editSupplier', 'addSupplier'];
    selects.forEach(id => {
      const select = document.getElementById(id);
      if (select) {
        select.innerHTML = '<option value="">بدون مورد</option>' +
          allSuppliers.map(s =>
            `<option value="${s.id}">${escapeHtml(s.name)}</option>`
          ).join('');
      }
    });

    // Update category datalists
    const categories = [...new Set(allAccessories.map(a => a.category).filter(Boolean))];
    const datalists = ['categoryList', 'addCategoryList'];
    datalists.forEach(id => {
      const datalist = document.getElementById(id);
      if (datalist) {
        datalist.innerHTML = categories.map(c => `<option value="${escapeHtml(c)}">`).join('');
      }
    });
  }

  function updatePagination() {
    const infoEl = document.getElementById('paginationInfo');
    const currentEl = document.getElementById('currentPageDisplay');
    const totalPagesEl = document.getElementById('totalPagesDisplay');
    const prevBtn = document.getElementById('btnPrevPage');
    const nextBtn = document.getElementById('btnNextPage');

    const start = totalItems === 0 ? 0 : ((currentPage - 1) * rowsPerPage) + 1;
    const end = Math.min(currentPage * rowsPerPage, totalItems);

    if (infoEl) infoEl.textContent = `عرض ${start} - ${end} من ${totalItems}`;
    if (currentEl) currentEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    Logger.log('[PAGINATION] Updated: page', currentPage, 'of', totalPages, 'totalItems:', totalItems);
  }

  // ═══════════════════════════════════════
  // TABLE RENDERING
  // ═══════════════════════════════════════
  function renderTable() {
    const tbody = document.getElementById('accessoriesTableBody');
    if (!tbody) {
      Logger.error('[TABLE] tbody element not found!');
      return;
    }

    Logger.log('[TABLE] renderTable called, accessories count:', allAccessories?.length || 0);

    if (!allAccessories || allAccessories.length === 0) {
      const hasFilters = document.getElementById('qSearch')?.value ||
                         document.getElementById('fCategory')?.value ||
                         document.getElementById('fCondition')?.value ||
                         document.getElementById('fQuantity')?.value;

      const emptyText = hasFilters
        ? 'لا توجد أصناف تطابق البحث'
        : 'لا توجد أصناف - اضغط "إضافة صنف" لإضافة صنف جديد';

      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="elos-acc-empty-state">
            <div class="elos-acc-empty-icon">📦</div>
            <div class="elos-acc-empty-text">${emptyText}</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = allAccessories.map(acc => renderRow(acc)).join('');

    // Update select all checkbox state
    updateSelectAllCheckbox();

    Logger.log('[TABLE] Rendered', allAccessories.length, 'rows');
  }

  // ═══════════════════════════════════════
  // KPI CARDS (بطاقات الملخص - مثل مخزن الأجهزة)
  // ═══════════════════════════════════════
  function updateKpiCards({ count, totalQty, totalCost, totalSaleValue }) {
    const kpiCount = document.getElementById('kpiCount');
    const kpiTotalQty = document.getElementById('kpiTotalQty');
    const kpiCost = document.getElementById('kpiCost');
    const kpiSale = document.getElementById('kpiSale');
    if (kpiCount) kpiCount.textContent = (count ?? 0).toLocaleString('ar-EG');
    if (kpiTotalQty) kpiTotalQty.textContent = (totalQty ?? 0).toLocaleString('ar-EG');
    if (kpiCost) kpiCost.textContent = fmt(totalCost ?? 0);
    if (kpiSale) kpiSale.textContent = fmt(totalSaleValue ?? 0);
  }

  function renderRow(acc) {
    const isSelected = selectedItems.has(acc.id);
    const qty = acc.quantity || 0;
    const minStock = acc.min_stock || 5;

    // Quantity status
    let qtyClass = 'elos-acc-qty-available';
    let qtyBadge = '';
    if (qty === 0) {
      qtyClass = 'elos-acc-qty-out';
      qtyBadge = '<span class="elos-acc-qty-badge elos-acc-qty-badge-out">غير متوفر</span>';
    } else if (qty <= minStock) {
      qtyClass = 'elos-acc-qty-low';
      qtyBadge = '<span class="elos-acc-qty-badge elos-acc-qty-badge-low">كمية قليلة</span>';
    }

    // Get supplier name
    const supplierName = acc.supplier_name || '-';

    // Get warehouse name
    const warehouseName = allWarehouses.find(w => w.id === acc.warehouse_id)?.name || '-';

    return `
      <tr class="elos-acc-row ${isSelected ? 'selected-row' : ''}" data-id="${acc.id}">
        <td class="elos-acc-td-checkbox">
          <input type="checkbox"
                 class="elos-acc-checkbox elos-acc-row-checkbox"
                 data-id="${acc.id}"
                 ${isSelected ? 'checked' : ''}>
        </td>
        <td class="elos-acc-cell-mono">${escapeHtml(acc.short_code || acc.barcode || '-')}</td>
        <td>
          <div class="elos-acc-cell-name">
            <span class="elos-acc-cell-name-text">${escapeHtml(acc.name || '-')}</span>
            ${acc.brand ? `<span class="elos-acc-cell-name-sub">${escapeHtml(acc.brand)}</span>` : ''}
          </div>
        </td>
        <td>
          ${acc.category ? `<span class="elos-acc-badge elos-acc-badge-category">${escapeHtml(acc.category)}</span>` : '-'}
        </td>
        <td class="elos-acc-cell-price elos-acc-cell-price-purchase">${fmt(acc.purchase_price || 0)} ج.م</td>
        <td class="elos-acc-cell-price elos-acc-cell-price-sale">${fmt(acc.sale_price || acc.sell_price || 0)} ج.م</td>
        <td>
          <div class="elos-acc-cell-qty">
            <span class="elos-acc-qty-value ${qtyClass}">${qty}</span>
            ${qtyBadge}
          </div>
        </td>
        <td>${escapeHtml(warehouseName)}</td>
        <td class="elos-acc-cell-date">${formatDate(acc.updated_at || acc.created_at)}</td>
        <td class="elos-acc-td-actions">
          <div class="elos-acc-actions">
            <button class="elos-acc-action-btn elos-acc-action-btn-view" data-action="view" data-id="${acc.id}" title="عرض التفاصيل">👁️</button>
            <button class="elos-acc-action-btn elos-acc-action-btn-edit" data-action="edit" data-id="${acc.id}" title="تعديل">✏️</button>
            <button class="elos-acc-action-btn elos-acc-action-btn-print" data-action="print" data-id="${acc.id}" title="طباعة الباركود">🖨️</button>
            <button class="elos-acc-action-btn elos-acc-action-btn-delete" data-action="delete" data-id="${acc.id}" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }

  // ═══════════════════════════════════════
  // SELECTION SYSTEM
  // ═══════════════════════════════════════
  function toggleSelectAll(checked) {
    allAccessories.forEach(acc => {
      if (checked) {
        selectedItems.add(acc.id);
      } else {
        selectedItems.delete(acc.id);
      }
    });

    // Update checkboxes
    document.querySelectorAll('.elos-acc-row-checkbox').forEach(cb => {
      cb.checked = checked;
      const row = cb.closest('tr');
      if (row) row.classList.toggle('selected-row', checked);
    });

    updateSelectionUI();
    Logger.log('[SELECTION] Select all:', checked, 'Total:', selectedItems.size);
  }

  function toggleRowSelection(id, checked) {
    const accId = parseInt(id);
    if (checked) {
      selectedItems.add(accId);
    } else {
      selectedItems.delete(accId);
    }

    // Update row visual
    const row = document.querySelector(`tr[data-id="${accId}"]`);
    if (row) row.classList.toggle('selected-row', checked);

    updateSelectAllCheckbox();
    updateSelectionUI();
    Logger.log('[SELECTION] Row', accId, checked ? 'selected' : 'deselected', 'Total:', selectedItems.size);
  }

  function updateSelectAllCheckbox() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.elos-acc-row-checkbox');
    const checkedCount = document.querySelectorAll('.elos-acc-row-checkbox:checked').length;

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
    const printBarcodeBtn = document.getElementById('btnPrintBarcodesSelection');

    if (countEl) countEl.textContent = `تم تحديد: ${count}`;
    if (actionsEl) actionsEl.classList.toggle('visible', count > 0);
    if (transferBtn) transferBtn.disabled = count === 0;
    // زر توحيد الأسعار يظهر فقط إذا كان أكثر من صنف محدد
    if (avgBtn) avgBtn.disabled = count < 2;
    if (printBarcodeBtn) printBarcodeBtn.disabled = count === 0;
  }

  function clearSelection() {
    selectedItems.clear();

    document.querySelectorAll('.elos-acc-row-checkbox').forEach(cb => {
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
   * طباعة باركود للأصناف المحددة — عدد النسخ = الكمية في المخزن لكل صنف
   */
  function printSelectedAccessoriesBarcodes() {
    if (selectedItems.size === 0) {
      if (typeof showToast === 'function') showToast('حدد أصنافاً أولاً', 'warning');
      return;
    }
    const list = useClientPagination ? fullAccessoriesList : allAccessories;
    const selectedAccessories = list.filter(a => selectedItems.has(a.id));
    if (selectedAccessories.length === 0) {
      if (typeof showToast === 'function') showToast('لا توجد أصناف محددة في القائمة الحالية', 'warning');
      return;
    }
    const toPrint = [];
    let skipped = 0;
    for (const acc of selectedAccessories) {
      const code = String(acc.short_code || acc.barcode || acc.code || '').trim();
      if (!code) {
        skipped++;
        continue;
      }
      const qty = Math.max(1, parseInt(acc.quantity, 10) || 1);
      const base = {
        ...acc,
        short_code: code,
        barcode: code,
        code: code
      };
      for (let i = 0; i < qty; i++) toPrint.push({ ...base });
    }
    if (toPrint.length === 0) {
      if (typeof showToast === 'function') showToast(skipped ? 'الأصناف المحددة لا تحتوي على باركود' : 'لا يوجد ما يطبع', 'warning');
      return;
    }
    if (typeof BarcodeGenerator !== 'undefined' && BarcodeGenerator.printMultipleBarcodes) {
      BarcodeGenerator.printMultipleBarcodes(toPrint, { type: 'accessory', skipShortCodeGeneration: true }).then(() => {
        if (typeof showToast === 'function') showToast(`تم إرسال ${toPrint.length} باركود للطباعة`, 'success');
      }).catch(err => {
        Logger.error('[PRINT] printSelectedAccessoriesBarcodes error:', err);
        if (typeof showToast === 'function') showToast('فشل في الطباعة', 'error');
      });
    } else {
      if (typeof showToast === 'function') showToast('نظام الباركود غير متاح', 'error');
    }
  }

  // ═══════════════════════════════════════
  // MODAL SYSTEM
  // ═══════════════════════════════════════
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('visible');
      Logger.log('[MODAL] Opened:', modalId);
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('visible');
      Logger.log('[MODAL] Closed:', modalId);
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.elos-acc-modal-overlay.visible').forEach(modal => {
      modal.classList.remove('visible');
    });
  }

  // ═══════════════════════════════════════
  // VIEW DETAILS
  // ═══════════════════════════════════════
  async function viewAccessoryDetails(id) {
    try {
      const response = await fetch(`elos-db://accessories/${id}`);
      const data = await response.json();

      if (!response.ok || !data.accessory) {
        throw new Error(data.error || 'Failed to load accessory details');
      }

      const acc = data.accessory;
      const contentEl = document.getElementById('viewDetailsContent');

      if (contentEl) {
        contentEl.innerHTML = `
          <div class="elos-acc-details-grid">
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">الاسم</span>
              <span class="elos-acc-details-value">${escapeHtml(acc.name || '-')}</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">التصنيف</span>
              <span class="elos-acc-details-value">${escapeHtml(acc.category || '-')}</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">الباركود</span>
              <span class="elos-acc-details-value">${escapeHtml(acc.short_code || acc.barcode || '-')}</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">الماركة</span>
              <span class="elos-acc-details-value">${escapeHtml(acc.brand || '-')}</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">الحالة</span>
              <span class="elos-acc-details-value">${escapeHtml(acc.condition || 'جديد')}</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">سعر الشراء</span>
              <span class="elos-acc-details-value">${fmt(acc.purchase_price || 0)} ج.م</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">سعر البيع</span>
              <span class="elos-acc-details-value">${fmt(acc.sale_price || acc.sell_price || 0)} ج.م</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">الكمية الحالية</span>
              <span class="elos-acc-details-value">${acc.quantity || 0}</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">حد التنبيه</span>
              <span class="elos-acc-details-value">${acc.min_stock || 5}</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">المورد</span>
              <span class="elos-acc-details-value">${escapeHtml(acc.supplier_name || '-')}</span>
            </div>
            <div class="elos-acc-details-item">
              <span class="elos-acc-details-label">تاريخ الإضافة</span>
              <span class="elos-acc-details-value">${formatDate(acc.created_at)}</span>
            </div>
            ${acc.notes ? `
              <div class="elos-acc-details-item full-width">
                <span class="elos-acc-details-label">ملاحظات</span>
                <span class="elos-acc-details-value">${escapeHtml(acc.notes)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      openModal('viewDetailsModal');

    } catch (error) {
      Logger.error('[VIEW] Error:', error);
      showToast('خطأ في تحميل تفاصيل الصنف', 'error');
    }
  }

  // ═══════════════════════════════════════
  // EDIT ACCESSORY
  // ═══════════════════════════════════════
  async function openEditModal(id) {
    try {
      const response = await fetch(`elos-db://accessories/${id}`);
      const data = await response.json();

      if (!response.ok || !data.accessory) {
        throw new Error(data.error || 'Failed to load accessory');
      }

      const acc = data.accessory;

      document.getElementById('editId').value = acc.id;
      document.getElementById('editName').value = acc.name || '';
      document.getElementById('editCategory').value = acc.category || '';
      document.getElementById('editBarcode').value = acc.short_code || acc.barcode || '';
      // إعادة ضبط خيار الباركود للحالي
      const keepRadio = document.querySelector('input[name="editBarcodeType"][value="keep"]');
      if (keepRadio) keepRadio.checked = true;
      const barcodeInput = document.getElementById('editBarcode');
      barcodeInput.readOnly = true;
      barcodeInput.style.background = 'var(--bg-tertiary)';
      barcodeInput.style.cursor = 'not-allowed';
      document.getElementById('editPurchasePrice').value = acc.purchase_price || 0;
      document.getElementById('editSalePrice').value = acc.sale_price || acc.sell_price || 0;
      document.getElementById('editQuantity').value = acc.quantity || 0;
      document.getElementById('editMinStock').value = acc.min_stock || 5;
      document.getElementById('editCondition').value = acc.condition || 'جديد';
      document.getElementById('editSupplier').value = acc.supplier_id || '';
      document.getElementById('editNotes').value = acc.notes || '';

      document.getElementById('editModalTitle').textContent = 'تعديل: ' + (acc.name || 'صنف');

      openModal('editModal');

    } catch (error) {
      Logger.error('[EDIT] Error:', error);
      showToast('خطأ في تحميل بيانات الصنف', 'error');
    }
  }

  async function saveEdit() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value.trim();

    if (!name) {
      showToast('اسم الصنف مطلوب', 'warning');
      return;
    }

    const editedBarcode = document.getElementById('editBarcode').value.trim();
    const data = {
      name,
      category: document.getElementById('editCategory').value.trim(),
      barcode: editedBarcode || null,
      short_code: editedBarcode || null,
      purchase_price: parseFloat(document.getElementById('editPurchasePrice').value) || 0,
      sale_price: parseFloat(document.getElementById('editSalePrice').value) || 0,
      quantity: parseInt(document.getElementById('editQuantity').value) || 0,
      min_stock: parseInt(document.getElementById('editMinStock').value) || 5,
      condition: document.getElementById('editCondition').value,
      supplier_id: document.getElementById('editSupplier').value || null,
      notes: document.getElementById('editNotes').value.trim()
    };

    try {
      const response = await fetch(`elos-db://accessories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update accessory');
      }

      closeModal('editModal');
      showToast('تم تحديث الصنف بنجاح', 'success');
      if (window.SoundFX) window.SoundFX.play('save');

      await loadAccessories();

    } catch (error) {
      Logger.error('[EDIT] Save error:', error);
      showToast('خطأ في حفظ التغييرات: ' + error.message, 'error');
    }
  }

  // ═══════════════════════════════════════
  // BARCODE GENERATION (5-6 أرقام)
  // ═══════════════════════════════════════
  // نطاق الإكسسوارات: 10000 - 99999 (5 أرقام)
  const ACCESSORY_BARCODE_MIN = 10000;
  const ACCESSORY_BARCODE_MAX = 99999;

  async function generateAccessoryBarcode() {
    try {
      // جلب جميع الإكسسوارات للحصول على الأكواد المستخدمة
      const response = await fetch('elos-db://accessories');
      const data = await response.json();
      const accessories = Array.isArray(data) ? data : (data.accessories || []);

      // جمع جميع الأكواد المستخدمة
      const usedCodes = new Set();
      accessories.forEach(acc => {
        // short_code
        if (acc.short_code) {
          const num = parseInt(String(acc.short_code).replace(/\D/g, ''));
          if (!isNaN(num)) usedCodes.add(num);
        }
        // barcode
        if (acc.barcode) {
          const num = parseInt(String(acc.barcode).replace(/\D/g, ''));
          if (!isNaN(num) && num >= ACCESSORY_BARCODE_MIN && num <= ACCESSORY_BARCODE_MAX) {
            usedCodes.add(num);
          }
        }
      });

      // البحث عن أول رقم متاح
      for (let code = ACCESSORY_BARCODE_MIN; code <= ACCESSORY_BARCODE_MAX; code++) {
        if (!usedCodes.has(code)) {
          Logger.log('[BARCODE] Generated new code:', code);
          return String(code); // 5 أرقام
        }
      }

      // إذا امتلأ النطاق، استخدم 6 أرقام
      const extended = new Set(usedCodes);
      for (let code = 100000; code <= 999999; code++) {
        if (!extended.has(code)) {
          Logger.log('[BARCODE] Generated extended code:', code);
          return String(code); // 6 أرقام
        }
      }

      throw new Error('نفذت جميع الأكواد المتاحة');
    } catch (error) {
      Logger.error('[BARCODE] Generation error:', error);
      // Fallback: توليد رقم عشوائي
      const fallback = ACCESSORY_BARCODE_MIN + Math.floor(Math.random() * (ACCESSORY_BARCODE_MAX - ACCESSORY_BARCODE_MIN));
      return String(fallback);
    }
  }

  // ═══════════════════════════════════════
  // ADD ACCESSORY
  // ═══════════════════════════════════════

  // دالة تبديل حقل الباركود اليدوي/التلقائي
  window.toggleAccBarcodeField = function() {
    const barcodeType = document.querySelector('input[name="addBarcodeType"]:checked')?.value;
    const manualField = document.getElementById('addBarcodeManualField');
    const barcodeInput = document.getElementById('addBarcode');

    if (barcodeType === 'manual') {
      manualField.style.display = 'block';
      if (barcodeInput) {
        barcodeInput.value = '';
        setTimeout(() => barcodeInput.focus(), 100);
      }
    } else {
      manualField.style.display = 'none';
      if (barcodeInput) barcodeInput.value = '';
    }
  };

  // دالة تبديل حقل الباركود في نافذة التعديل
  window.toggleEditBarcodeField = function() {
    const barcodeType = document.querySelector('input[name="editBarcodeType"]:checked')?.value;
    const barcodeInput = document.getElementById('editBarcode');

    if (barcodeType === 'keep') {
      // إبقاء الباركود الحالي - للقراءة فقط
      barcodeInput.readOnly = true;
      barcodeInput.style.background = 'var(--bg-tertiary)';
      barcodeInput.style.cursor = 'not-allowed';
    } else if (barcodeType === 'auto') {
      // توليد باركود تلقائي جديد
      barcodeInput.readOnly = true;
      barcodeInput.style.background = 'var(--bg-tertiary)';
      barcodeInput.style.cursor = 'not-allowed';
      generateAccessoryBarcode().then(code => {
        barcodeInput.value = code;
      });
    } else if (barcodeType === 'manual') {
      // إدخال يدوي
      barcodeInput.readOnly = false;
      barcodeInput.style.background = '';
      barcodeInput.style.cursor = '';
      barcodeInput.value = '';
      setTimeout(() => barcodeInput.focus(), 100);
    }
  };

  async function openAddModal() {
    document.getElementById('addForm').reset();
    document.getElementById('addQuantity').value = 0;
    document.getElementById('addMinStock').value = 5;

    // إعادة ضبط خيار الباركود للتلقائي
    const autoRadio = document.querySelector('input[name="addBarcodeType"][value="auto"]');
    if (autoRadio) autoRadio.checked = true;
    const manualField = document.getElementById('addBarcodeManualField');
    if (manualField) manualField.style.display = 'none';
    const barcodeInput = document.getElementById('addBarcode');
    if (barcodeInput) barcodeInput.value = '';

    openModal('addModal');
  }

  async function saveAdd() {
    const name = document.getElementById('addName').value.trim();

    if (!name) {
      showToast('اسم الصنف مطلوب', 'warning');
      return;
    }

    // التحقق من نوع الباركود (يدوي/تلقائي)
    const barcodeType = document.querySelector('input[name="addBarcodeType"]:checked')?.value || 'auto';
    let barcode = '';

    if (barcodeType === 'manual') {
      barcode = document.getElementById('addBarcode')?.value?.trim() || '';
      if (!barcode) {
        showToast('يرجى إدخال الباركود أو اختيار التوليد التلقائي', 'warning');
        return;
      }
    } else {
      // توليد تلقائي
      try {
        barcode = await generateAccessoryBarcode();
      } catch (e) {
        showToast('خطأ في توليد الباركود', 'error');
        return;
      }
    }

    const data = {
      name,
      warehouse_id: currentWarehouseId,
      category: document.getElementById('addCategory').value.trim(),
      barcode: barcode,
      short_code: barcode, // نفس القيمة للتوافق
      purchase_price: parseFloat(document.getElementById('addPurchasePrice').value) || 0,
      sale_price: parseFloat(document.getElementById('addSalePrice').value) || 0,
      quantity: parseInt(document.getElementById('addQuantity').value) || 0,
      min_stock: parseInt(document.getElementById('addMinStock').value) || 5,
      condition: document.getElementById('addCondition').value,
      supplier_id: document.getElementById('addSupplier').value || null,
      notes: document.getElementById('addNotes').value.trim()
    };

    try {
      const response = await fetch('elos-db://accessories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to add accessory');
      }

      closeModal('addModal');
      showToast(`تمت إضافة الصنف بنجاح - الباركود: ${barcode}`, 'success');
      if (window.SoundFX) window.SoundFX.play('add');

      await loadAccessories();

    } catch (error) {
      Logger.error('[ADD] Save error:', error);
      showToast('خطأ في إضافة الصنف: ' + error.message, 'error');
    }
  }

  // ═══════════════════════════════════════
  // DELETE ACCESSORY
  // ═══════════════════════════════════════
  let deleteTargetId = null;

  function openDeleteModal(id) {
    deleteTargetId = id;
    const acc = allAccessories.find(a => a.id === parseInt(id));
    const nameEl = document.getElementById('deleteItemName');
    if (nameEl && acc) {
      nameEl.textContent = acc.name || 'صنف غير معروف';
    }
    openModal('deleteModal');
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;

    try {
      const response = await fetch(`elos-db://accessories/${deleteTargetId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete accessory');
      }

      closeModal('deleteModal');
      showToast('تم حذف الصنف بنجاح', 'success');
      if (window.SoundFX) window.SoundFX.play('delete');

      // Remove from selection if selected
      selectedItems.delete(parseInt(deleteTargetId));
      deleteTargetId = null;

      await loadAccessories();

    } catch (error) {
      Logger.error('[DELETE] Error:', error);
      showToast('خطأ في حذف الصنف: ' + error.message, 'error');
    }
  }

  // ═══════════════════════════════════════
  // PRINT BARCODE
  // ═══════════════════════════════════════
  let printTargetId = null;
  let printTargetAccessory = null;

  function openPrintBarcodeModal(id) {
    printTargetId = id;
    // البحث في كل الإكسسوارات (fullAccessoriesList للبحث الكامل)
    printTargetAccessory = fullAccessoriesList.find(a => a.id === parseInt(id)) ||
                           allAccessories.find(a => a.id === parseInt(id));

    if (!printTargetAccessory) {
      showToast('الصنف غير موجود', 'error');
      return;
    }

    // ✅ استخدام نفس مودل نقطة البيع من BarcodeGenerator
    if (typeof BarcodeGenerator !== 'undefined' && BarcodeGenerator.showBarcodePreviewModal) {
      Logger.log('[PRINT] Using BarcodeGenerator.showBarcodePreviewModal for accessory:', printTargetAccessory.id);
      BarcodeGenerator.showBarcodePreviewModal(printTargetAccessory, 'accessory');
      return;
    }

    // Fallback: استخدام المودل المخصص إذا لم يكن BarcodeGenerator متاحاً
    Logger.warn('[PRINT] BarcodeGenerator not available, using custom modal');
    const acc = printTargetAccessory;
    const barcodeValue = acc.short_code || acc.barcode || String(acc.id);
    const price = acc.sale_price || acc.price || 0;

    // تحديث معلومات الصنف
    const nameEl = document.getElementById('printAccessoryName');
    const barcodeEl = document.getElementById('printBarcodeValue');
    const priceEl = document.getElementById('printPriceValue');

    if (nameEl) nameEl.textContent = acc.name || '-';
    if (barcodeEl) barcodeEl.textContent = barcodeValue;
    if (priceEl) priceEl.textContent = formatCurrency(price);

    // توليد معاينة الملصق
    generateLabelPreview(acc, barcodeValue, price);

    // إعادة تعيين الإعدادات
    const copiesEl = document.getElementById('printCopies');
    const showPriceEl = document.getElementById('printShowPrice');
    if (copiesEl) copiesEl.value = 1;
    if (showPriceEl) showPriceEl.value = 'yes';

    openModal('printBarcodeModal');
  }

  function generateLabelPreview(acc, barcodeValue, price) {
    const container = document.getElementById('labelPreviewContainer');
    if (!container) return;

    const showPrice = document.getElementById('printShowPrice')?.value !== 'no';
    const shopName = 'ELOS';

    // إنشاء الملصق
    const label = document.createElement('div');
    label.className = 'elos-acc-barcode-label';

    // اسم المحل
    const shopDiv = document.createElement('div');
    shopDiv.className = 'elos-acc-barcode-label-shop';
    shopDiv.textContent = shopName;
    label.appendChild(shopDiv);

    // منطقة الباركود SVG
    const svgContainer = document.createElement('div');
    svgContainer.className = 'elos-acc-barcode-label-svg';
    const svgEl = document.createElement('svg');
    svgEl.id = 'previewBarcodeOutput';
    svgContainer.appendChild(svgEl);
    label.appendChild(svgContainer);

    // اسم الصنف
    const nameDiv = document.createElement('div');
    nameDiv.className = 'elos-acc-barcode-label-name';
    nameDiv.textContent = acc.name || '-';
    nameDiv.title = acc.name || '';
    label.appendChild(nameDiv);

    // السعر (إذا تم تفعيله)
    if (showPrice && price > 0) {
      const priceDiv = document.createElement('div');
      priceDiv.className = 'elos-acc-barcode-label-price';
      priceDiv.textContent = formatCurrency(price);
      label.appendChild(priceDiv);
    }

    // مسح المحتوى القديم وإضافة الملصق
    container.innerHTML = '';
    container.appendChild(label);

    // توليد الباركود باستخدام JsBarcode
    // V24.13: عرض أكبر للخطوط لسهولة القراءة بالاسكانر على الطابعة الحرارية
    if (typeof JsBarcode !== 'undefined') {
      try {
        JsBarcode('#previewBarcodeOutput', barcodeValue, {
          format: 'CODE128',
          width: 2.5,      // عرض أكبر للخطوط - سهولة القراءة
          height: 35,
          displayValue: true,
          fontSize: 10,
          margin: 5,       // هامش لضمان القراءة
          background: 'transparent',
          lineColor: '#000000'
        });
      } catch (e) {
        Logger.error('[PRINT] Barcode generation error:', e);
        svgContainer.innerHTML = `<span style="font-size:12px;color:#333;">${escapeHtml(barcodeValue)}</span>`;
      }
    }
  }

  function refreshLabelPreview() {
    if (!printTargetAccessory) return;
    const acc = printTargetAccessory;
    const barcodeValue = acc.short_code || acc.barcode || String(acc.id);
    const price = acc.sale_price || acc.price || 0;
    generateLabelPreview(acc, barcodeValue, price);
  }

  async function executePrint() {
    if (!printTargetAccessory) {
      showToast('لم يتم تحديد الصنف للطباعة', 'error');
      return;
    }

    const copies = parseInt(document.getElementById('printCopies')?.value) || 1;
    const showPrice = document.getElementById('printShowPrice')?.value !== 'no';

    // استخدام printBarcodeLabels من barcode-generator.js إذا كانت متاحة
    if (typeof printBarcodeLabels === 'function') {
      try {
        await printBarcodeLabels([printTargetAccessory], {
          type: 'accessory',
          labelType: 'single',
          copies: copies,
          showPrice: showPrice,
          skipShortCodeGeneration: true // الباركود موجود مسبقاً
        });
        closeModal('printBarcodeModal');
        showToast('تم إرسال الطباعة بنجاح', 'success');
        if (window.SoundFX) window.SoundFX.play('print');
        return;
      } catch (error) {
        Logger.error('[PRINT] printBarcodeLabels error:', error);
        // fallback للطريقة القديمة
      }
    }

    // Fallback: طباعة بسيطة إذا لم تكن printBarcodeLabels متاحة
    const barcodeValue = printTargetAccessory.short_code || printTargetAccessory.barcode ||
                         String(printTargetAccessory.id);
    const price = printTargetAccessory.sale_price || printTargetAccessory.price || 0;

    const printWindow = window.open('', '_blank', 'width=400,height=400');
    if (printWindow) {
      let content = '';
      for (let i = 0; i < copies; i++) {
        content += `
          <div style="width: 38mm; height: 25mm; border: 1px solid #ccc; margin: 2mm;
                      display: flex; flex-direction: column; align-items: center;
                      justify-content: center; padding: 2mm; page-break-after: always;">
            <div style="font-size: 7pt; font-weight: bold;">ELOS</div>
            <svg id="barcode${i}"></svg>
            <div style="font-size: 6pt; max-width: 100%; overflow: hidden;
                        text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(printTargetAccessory.name || '')}
            </div>
            ${showPrice && price > 0 ? `<div style="font-size: 8pt; font-weight: bold;">${formatCurrency(price)}</div>` : ''}
          </div>
        `;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <title>طباعة الباركود</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
          <style>
            @page { size: 38mm 25mm; margin: 0; }
            body { font-family: Arial, sans-serif; padding: 0; margin: 0; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() {
              ${Array.from({length: copies}, (_, i) => `
                JsBarcode("#barcode${i}", "${barcodeValue}", {
                  format: "CODE128", width: 1.5, height: 30,
                  displayValue: true, fontSize: 8, margin: 0
                });
              `).join('')}
              setTimeout(function() { window.print(); window.close(); }, 300);
            };
          <\/script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }

    closeModal('printBarcodeModal');
    if (window.SoundFX) window.SoundFX.play('print');
  }

  // ═══════════════════════════════════════
  // BULK TRANSFER
  // ═══════════════════════════════════════
  function openBulkTransferModal() {
    if (selectedItems.size === 0) {
      showToast('يرجى تحديد صنف واحد على الأقل', 'warning');
      return;
    }

    // Update count
    document.getElementById('transferItemsCount').textContent = selectedItems.size;

    // Populate target warehouse dropdown
    const targetSelect = document.getElementById('targetWarehouse');
    if (targetSelect) {
      // Filter to only accessories warehouses
      const accessoriesWarehouses = allWarehouses.filter(w => {
        if (w.id === currentWarehouseId) return false;
        if (w.type === 'accessories') return true;
        if (w.is_storage_only === 1 && w.storage_type === 'accessories') return true;
        return false;
      });

      if (accessoriesWarehouses.length === 0) {
        targetSelect.innerHTML = '<option value="">-- لا توجد مخازن متاحة --</option>';
      } else {
        targetSelect.innerHTML = '<option value="">-- اختر المخزن الوجهة --</option>' +
          accessoriesWarehouses.map(w =>
            `<option value="${w.id}">${w.icon || '📦'} ${escapeHtml(w.name)}</option>`
          ).join('');
      }
    }

    // Render selected items list
    renderTransferItemsList();

    // Clear notes
    document.getElementById('transferNotes').value = '';

    openModal('bulkTransferModal');
    Logger.log('[TRANSFER] Modal opened with', selectedItems.size, 'items');
  }

  function renderTransferItemsList() {
    const listEl = document.getElementById('transferItemsList');
    if (!listEl) return;

    const selectedAccessories = allAccessories.filter(a => selectedItems.has(a.id));

    if (selectedAccessories.length === 0) {
      listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">لا توجد أصناف محددة</div>';
      return;
    }

    listEl.innerHTML = selectedAccessories.map(acc => `
      <div class="elos-acc-transfer-item" data-id="${acc.id}">
        <span class="elos-acc-transfer-item-icon">📦</span>
        <div class="elos-acc-transfer-item-info">
          <div class="elos-acc-transfer-item-name">${escapeHtml(acc.name)}</div>
          <div class="elos-acc-transfer-item-meta">${escapeHtml(acc.category || '-')} | ${escapeHtml(acc.short_code || acc.barcode || '-')}</div>
        </div>
        <div class="elos-acc-transfer-item-qty" style="display: flex; flex-direction: column; gap: 6px; min-width: 140px;">
          <span>المتاح: ${acc.quantity || 0}</span>
          <input
            type="number"
            class="elos-acc-transfer-qty-input"
            data-id="${acc.id}"
            min="1"
            max="${acc.quantity || 1}"
            value="${Math.min(1, acc.quantity || 1)}"
            style="width: 100%; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary);"
            title="كمية التحويل"
          />
        </div>
        <button class="elos-acc-transfer-item-remove" data-remove-id="${acc.id}" title="إزالة">✕</button>
      </div>
    `).join('');

    // Bind quantity validation
    listEl.querySelectorAll('.elos-acc-transfer-qty-input').forEach(input => {
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
    const accId = parseInt(id);
    selectedItems.delete(accId);

    // Update checkbox in table
    const checkbox = document.querySelector(`.elos-acc-row-checkbox[data-id="${accId}"]`);
    if (checkbox) {
      checkbox.checked = false;
      const row = checkbox.closest('tr');
      if (row) row.classList.remove('selected-row');
    }

    updateSelectAllCheckbox();
    updateSelectionUI();

    // Update modal
    document.getElementById('transferItemsCount').textContent = selectedItems.size;
    renderTransferItemsList();

    if (selectedItems.size === 0) {
      closeModal('bulkTransferModal');
      showToast('تم إزالة جميع الأصناف', 'info');
    }

    Logger.log('[TRANSFER] Removed item:', accId, 'Remaining:', selectedItems.size);
  }

  async function executeBulkTransfer() {
    const targetWarehouseId = document.getElementById('targetWarehouse')?.value;
    const notes = document.getElementById('transferNotes')?.value || '';

    if (!targetWarehouseId) {
      showToast('يرجى اختيار المخزن الوجهة', 'warning');
      return;
    }

    if (selectedItems.size === 0) {
      showToast('لا توجد أصناف للتحويل', 'warning');
      return;
    }

    // Build items array with selected quantity per item
    const items = [];
    for (const id of selectedItems) {
      const acc = allAccessories.find(a => a.id === id);
      if (acc && acc.quantity > 0) {
        const qtyInput = document.querySelector(`.elos-acc-transfer-qty-input[data-id="${id}"]`);
        let qty = qtyInput ? parseInt(qtyInput.value, 10) : acc.quantity;
        if (!Number.isFinite(qty) || qty < 1) qty = 1;
        if (qty > acc.quantity) qty = acc.quantity;
        items.push({
          item_type: 'accessory',
          item_id: id,
          quantity: qty
        });
      }
    }

    if (items.length === 0) {
      showToast('لا توجد أصناف متاحة للتحويل (الكمية = 0)', 'warning');
      return;
    }

    // Determine source warehouse
    let sourceWarehouseId = currentWarehouseId;
    if (!sourceWarehouseId) {
      const accessoriesWarehouse = allWarehouses.find(w => w.type === 'accessories' && !w.is_storage_only);
      if (accessoriesWarehouse) {
        sourceWarehouseId = accessoriesWarehouse.id;
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
      closeModal('bulkTransferModal');
      showToast(result.message || `تم تحويل ${result.transfers?.length || items.length} صنف بنجاح`, 'success');
      if (window.SoundFX) window.SoundFX.play('success');

      // Clear selection and reload
      clearSelection();
      await loadAccessories();

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

  // ═══════════════════════════════════════
  // AVERAGE PRICES - توحيد الأسعار
  // ═══════════════════════════════════════
  function openAveragePricesModal() {
    if (selectedItems.size < 2) {
      showToast('يرجى تحديد صنفين على الأقل لتوحيد الأسعار', 'warning');
      return;
    }

    const modal = document.getElementById('averagePricesModal');
    if (!modal) return;

    // Get selected accessories data
    const selectedAccessories = allAccessories.filter(a => selectedItems.has(a.id));

    if (selectedAccessories.length < 2) {
      showToast('يرجى تحديد صنفين على الأقل', 'warning');
      return;
    }

    // Update count
    document.getElementById('avgAccessoriesCount').textContent = selectedAccessories.length;

    // Render accessories list
    const listEl = document.getElementById('avgAccessoriesList');
    listEl.innerHTML = selectedAccessories.map(a => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--line, #333);">
        <span style="font-size: 18px;">🎧</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--ink, #fff); font-size: 13px;">${escapeHtml(a.name)}</div>
          <div style="font-size: 11px; color: var(--muted, #888);">${a.category || '-'} | الكمية: ${a.quantity}</div>
        </div>
        <div style="text-align: left; font-size: 12px;">
          <div style="color: var(--danger, #ef4444);">شراء: ${fmt(a.purchase_price || 0)}</div>
          <div style="color: var(--success, #10b981);">بيع: ${fmt(a.sale_price || a.sell_price || 0)}</div>
        </div>
      </div>
    `).join('');

    // Calculate statistics
    const purchasePrices = selectedAccessories.map(a => Number(a.purchase_price || 0));
    const salePrices = selectedAccessories.map(a => Number(a.sale_price || a.sell_price || 0));

    const avgPurchase = Math.round(purchasePrices.reduce((a, b) => a + b, 0) / purchasePrices.length);
    const avgSale = Math.round(salePrices.reduce((a, b) => a + b, 0) / salePrices.length);
    const minPurchase = Math.min(...purchasePrices);
    const maxPurchase = Math.max(...purchasePrices);
    const minSale = Math.min(...salePrices);
    const maxSale = Math.max(...salePrices);

    // Update UI
    document.getElementById('avgAccMinPurchase').textContent = fmt(minPurchase) + ' ج.م';
    document.getElementById('avgAccMaxPurchase').textContent = fmt(maxPurchase) + ' ج.م';
    document.getElementById('avgAccAvgPurchase').textContent = fmt(avgPurchase) + ' ج.م';

    document.getElementById('avgAccMinSale').textContent = fmt(minSale) + ' ج.م';
    document.getElementById('avgAccMaxSale').textContent = fmt(maxSale) + ' ج.م';
    document.getElementById('avgAccAvgSale').textContent = fmt(avgSale) + ' ج.م';

    const expectedProfit = avgSale - avgPurchase;
    document.getElementById('avgAccExpectedProfit').textContent = fmt(expectedProfit) + ' ج.م';
    document.getElementById('avgAccExpectedProfit').style.color = expectedProfit >= 0 ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)';

    // Store calculated values
    modal.dataset.avgPurchase = avgPurchase;
    modal.dataset.avgSale = avgSale;
    modal.dataset.itemIds = JSON.stringify(Array.from(selectedItems));

    openModal('averagePricesModal');
  }

  async function applyAccessoryAveragePrices() {
    const modal = document.getElementById('averagePricesModal');
    const applyPurchase = document.getElementById('avgAccApplyPurchase')?.checked;
    const applySale = document.getElementById('avgAccApplySale')?.checked;

    if (!applyPurchase && !applySale) {
      showToast('يرجى اختيار خيار واحد على الأقل للتوحيد', 'warning');
      return;
    }

    const avgPurchase = Number(modal.dataset.avgPurchase || 0);
    const avgSale = Number(modal.dataset.avgSale || 0);
    const itemIds = JSON.parse(modal.dataset.itemIds || '[]');

    if (itemIds.length < 2) {
      showToast('لا توجد أصناف كافية', 'warning');
      return;
    }

    // Confirmation
    const confirmMsg = `هل أنت متأكد من توحيد أسعار ${itemIds.length} صنف؟\n\n` +
      (applyPurchase ? `✓ سعر الشراء الجديد: ${fmt(avgPurchase)} ج.م\n` : '') +
      (applySale ? `✓ سعر البيع الجديد: ${fmt(avgSale)} ج.م` : '');

    if (!confirm(confirmMsg)) return;

    // Disable button
    const btn = document.getElementById('btnApplyAccAveragePrices');
    const originalHtml = btn?.innerHTML;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span><span>جاري التطبيق...</span>';
    }

    try {
      const response = await fetch('elos-db://accessories/average-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          avg_purchase_price: applyPurchase ? avgPurchase : null,
          avg_sale_price: applySale ? avgSale : null,
          warehouse_id: currentWarehouseId
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'فشل تطبيق المتوسط');
      }

      showToast(`✅ تم توحيد أسعار ${result.updated} صنف بنجاح`, 'success');
      if (window.SoundFX) window.SoundFX.play('success');

      closeModal('averagePricesModal');
      clearSelection();
      await loadAccessories();

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

  // ═══════════════════════════════════════
  // ADD QUANTITY
  // ═══════════════════════════════════════
  function openAddQuantityModal() {
    // Populate accessories dropdown
    const select = document.getElementById('aqAccessory');
    if (select) {
      select.innerHTML = '<option value="">-- اختر الصنف --</option>' +
        allAccessories.map(acc =>
          `<option value="${acc.id}" data-qty="${acc.quantity}" data-price="${acc.purchase_price || 0}">${escapeHtml(acc.name)} (الكمية: ${acc.quantity})</option>`
        ).join('');
    }

    // Populate suppliers
    const supplierSelect = document.getElementById('aqSupplier');
    if (supplierSelect) {
      supplierSelect.innerHTML = '<option value="">بدون مورد</option>' +
        allSuppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    }

    // Reset form
    document.getElementById('addQuantityForm')?.reset();
    document.getElementById('aqSelectedInfo').style.display = 'none';

    // Add change handler for accessory selection
    select?.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      const infoEl = document.getElementById('aqSelectedInfo');

      if (this.value) {
        document.getElementById('aqItemName').textContent = selectedOption.text.split(' (')[0];
        document.getElementById('aqCurrentQty').textContent = selectedOption.dataset.qty || 0;
        document.getElementById('aqPurchasePrice').value = selectedOption.dataset.price || 0;
        infoEl.style.display = 'block';
      } else {
        infoEl.style.display = 'none';
      }
    }, { once: true });

    openModal('addQuantityModal');
  }

  async function saveAddQuantity() {
    const accessoryId = document.getElementById('aqAccessory')?.value;
    const quantity = parseInt(document.getElementById('aqQuantity')?.value) || 0;
    const purchasePrice = parseFloat(document.getElementById('aqPurchasePrice')?.value) || 0;
    const supplierId = document.getElementById('aqSupplier')?.value || null;
    const notes = document.getElementById('aqNotes')?.value || '';

    if (!accessoryId) {
      showToast('يرجى اختيار الصنف', 'warning');
      return;
    }

    if (quantity <= 0) {
      showToast('الكمية يجب أن تكون أكبر من صفر', 'warning');
      return;
    }

    try {
      const response = await fetch(`elos-db://accessories/${accessoryId}/add-quantity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity,
          purchase_price: purchasePrice,
          supplier_id: supplierId,
          notes,
          type: 'purchase'
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'فشلت إضافة الكمية');
      }

      closeModal('addQuantityModal');
      showToast(`تمت إضافة ${quantity} وحدة بنجاح`, 'success');
      if (window.SoundFX) window.SoundFX.play('add');

      await loadAccessories();

    } catch (error) {
      Logger.error('[ADD_QTY] Error:', error);
      showToast('خطأ في إضافة الكمية: ' + error.message, 'error');
    }
  }

  // ═══════════════════════════════════════
  // MOVEMENTS
  // ═══════════════════════════════════════
  async function openMovementsModal() {
    openModal('movementsModal');
    await loadMovements();
  }

  async function loadMovements() {
    const type = document.getElementById('mvFilterType')?.value || '';
    const dateFrom = document.getElementById('mvFilterDateFrom')?.value || '';
    const dateTo = document.getElementById('mvFilterDateTo')?.value || '';

    const params = new URLSearchParams();
    if (currentWarehouseId) params.append('warehouse_id', currentWarehouseId);
    if (type) params.append('type', type);
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    params.append('limit', '100');

    try {
      const response = await fetch(`elos-db://accessory-movements?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشل تحميل الحركات');
      }

      renderMovementsTable(data.movements || data || []);

    } catch (error) {
      Logger.error('[MOVEMENTS] Error:', error);
      showToast('خطأ في تحميل الحركات', 'error');
    }
  }

  function renderMovementsTable(movements) {
    const tbody = document.getElementById('movementsTableBody');
    if (!tbody) return;

    if (!movements || movements.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px;">لا توجد حركات</td></tr>';
      return;
    }

    const typeLabels = {
      'purchase': 'شراء',
      'sale': 'بيع',
      'transfer_in': 'تحويل وارد',
      'transfer_out': 'تحويل صادر',
      'adjustment': 'تسوية',
      'return': 'مرتجع'
    };

    tbody.innerHTML = movements.map(mv => `
      <tr>
        <td class="elos-acc-cell-date">${formatDate(mv.created_at)}</td>
        <td>${escapeHtml(mv.accessory_name || mv.name || '-')}</td>
        <td><span class="elos-acc-mv-type elos-acc-mv-type-${mv.type}">${typeLabels[mv.type] || mv.type}</span></td>
        <td style="text-align: center; font-weight: 700; color: ${mv.quantity > 0 ? 'var(--success)' : 'var(--danger)'}">
          ${mv.quantity > 0 ? '+' : ''}${mv.quantity}
        </td>
        <td style="text-align: center;">${mv.quantity_before || 0}</td>
        <td style="text-align: center;">${mv.quantity_after || 0}</td>
        <td style="text-align: center;">${fmt(mv.unit_price || 0)} ج.م</td>
        <td>${escapeHtml(mv.notes || '-')}</td>
      </tr>
    `).join('');
  }

  // ═══════════════════════════════════════
  // EXPORT TO EXCEL
  // ═══════════════════════════════════════
  function exportToExcel() {
    if (allAccessories.length === 0) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    // Create CSV content
    const headers = ['الاسم', 'التصنيف', 'الباركود', 'سعر الشراء', 'سعر البيع', 'الكمية', 'حد التنبيه', 'الحالة', 'المورد', 'ملاحظات'];
    const rows = allAccessories.map(acc => [
      acc.name || '',
      acc.category || '',
      acc.short_code || acc.barcode || '',
      acc.purchase_price || 0,
      acc.sale_price || acc.sell_price || 0,
      acc.quantity || 0,
      acc.min_stock || 5,
      acc.condition || 'جديد',
      acc.supplier_name || '',
      acc.notes || ''
    ]);

    const csvContent = '\ufeff' + // BOM for Arabic support
      headers.join(',') + '\n' +
      rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `accessories_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showToast(`تم تصدير ${allAccessories.length} صنف`, 'success');
    if (window.SoundFX) window.SoundFX.play('success');
  }

  // ═══════════════════════════════════════
  // IMPORT TEMPLATE
  // ═══════════════════════════════════════
  function downloadImportTemplate() {
    const headers = ['الاسم', 'التصنيف', 'الباركود', 'سعر الشراء', 'سعر البيع', 'الكمية', 'حد التنبيه', 'الحالة', 'ملاحظات'];
    const sampleRow = ['اكسسوار تجريبي', 'فئة 1', '500001', '100', '150', '10', '5', 'جديد', 'ملاحظة'];

    const csvContent = '\ufeff' + headers.join(',') + '\n' + sampleRow.join(',');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'accessories_import_template.csv';
    link.click();

    showToast('تم تحميل قالب الاستيراد', 'success');
  }

  // ═══════════════════════════════════════
  // IMPORT FROM FILE
  // ═══════════════════════════════════════
  let importData = []; // Store parsed import data

  function handleImportFileChange(file) {
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = function(e) {
      try {
        let rows = [];

        if (fileName.endsWith('.csv')) {
          // Parse CSV
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter(line => line.trim());
          rows = lines.map(line => {
            // Handle CSV with potential commas in values
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          });
        } else {
          // Parse Excel using SheetJS if available
          if (typeof XLSX !== 'undefined') {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          } else {
            showToast('مكتبة Excel غير متاحة، يرجى استخدام ملف CSV', 'error');
            return;
          }
        }

        if (rows.length < 2) {
          showToast('الملف فارغ أو لا يحتوي على بيانات', 'error');
          return;
        }

        // Parse header and data
        const header = rows[0];
        const dataRows = rows.slice(1).filter(row => row.some(cell => cell && cell.toString().trim()));

        // Map headers to our expected format (الباركود = نحافظ عليه عند الاستيراد)
        const headerMap = {
          'الاسم': 'name',
          'name': 'name',
          'التصنيف': 'category',
          'category': 'category',
          'الباركود': 'barcode',
          'barcode': 'barcode',
          'سعر الشراء': 'purchase_price',
          'purchase_price': 'purchase_price',
          'سعر البيع': 'sale_price',
          'sale_price': 'sale_price',
          'الكمية': 'quantity',
          'quantity': 'quantity',
          'حد التنبيه': 'min_stock',
          'min_stock': 'min_stock',
          'الحالة': 'condition',
          'condition': 'condition',
          'ملاحظات': 'notes',
          'notes': 'notes'
        };

        const columnIndices = {};
        header.forEach((h, i) => {
          const key = h?.toString().trim().toLowerCase();
          const mappedKey = headerMap[key] || headerMap[h?.toString().trim()];
          if (mappedKey) {
            columnIndices[mappedKey] = i;
          }
        });

        if (columnIndices.name === undefined) {
          showToast('لم يتم العثور على عمود "الاسم" في الملف', 'error');
          return;
        }

        // Parse data rows (الباركود إن وُجد يُرسل للسيرفر لعدم توليد باركود جديد)
        importData = dataRows.map(row => ({
          name: row[columnIndices.name]?.toString().trim() || '',
          category: row[columnIndices.category]?.toString().trim() || '',
          barcode: (row[columnIndices.barcode]?.toString() || '').trim(),
          purchase_price: parseFloat(row[columnIndices.purchase_price]) || 0,
          sale_price: parseFloat(row[columnIndices.sale_price]) || 0,
          quantity: parseInt(row[columnIndices.quantity]) || 0,
          min_stock: parseInt(row[columnIndices.min_stock]) || 5,
          condition: row[columnIndices.condition]?.toString().trim() || 'جديد',
          notes: row[columnIndices.notes]?.toString().trim() || ''
        })).filter(item => item.name); // Filter out empty rows

        if (importData.length === 0) {
          showToast('لا توجد بيانات صالحة للاستيراد', 'error');
          return;
        }

        // Show preview
        const previewDiv = document.getElementById('importPreview');
        const previewContent = document.getElementById('importPreviewContent');

        if (previewDiv && previewContent) {
          previewDiv.style.display = 'block';
          previewContent.innerHTML = `
            <p>عدد الأصناف: <strong>${importData.length}</strong></p>
            <table class="elos-acc-tbl" style="font-size: 12px;">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>التصنيف</th>
                  <th>سعر الشراء</th>
                  <th>سعر البيع</th>
                  <th>الكمية</th>
                </tr>
              </thead>
              <tbody>
                ${importData.slice(0, 5).map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.category}</td>
                    <td>${item.purchase_price}</td>
                    <td>${item.sale_price}</td>
                    <td>${item.quantity}</td>
                  </tr>
                `).join('')}
                ${importData.length > 5 ? `<tr><td colspan="5" style="text-align:center;">... و ${importData.length - 5} صنف آخر</td></tr>` : ''}
              </tbody>
            </table>
          `;
        }

        // Enable import button
        const importBtn = document.getElementById('btnExecuteImport');
        if (importBtn) {
          importBtn.disabled = false;
        }

        showToast(`تم قراءة ${importData.length} صنف من الملف`, 'success');
      } catch (error) {
        console.error('[IMPORT] Parse error:', error);
        showToast('خطأ في قراءة الملف: ' + error.message, 'error');
      }
    };

    if (fileName.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  async function executeImport() {
    if (!importData || importData.length === 0) {
      showToast('لا توجد بيانات للاستيراد', 'error');
      return;
    }

    const importBtn = document.getElementById('btnExecuteImport');
    if (importBtn) {
      importBtn.disabled = true;
      importBtn.innerHTML = '<span>⏳</span><span>جاري الاستيراد...</span>';
    }

    // تجهيز كل الأصناف لإرسالها دفعة واحدة
    const items = importData.map(item => {
      const part = {
        name: item.name || '',
        category: item.category || '',
        purchase_price: parseFloat(item.purchase_price) || 0,
        sale_price: parseFloat(item.sale_price) || 0,
        quantity: parseInt(item.quantity) || 0,
        min_stock: parseInt(item.min_stock) || 5,
        condition: item.condition || 'جديد',
        notes: item.notes || '',
        brand: item.brand || '',
        sku: item.sku || '',
        code: item.code || ''
      };
      if (item.barcode && item.barcode.trim()) {
        part.barcode = item.barcode.trim();
        part.short_code = item.barcode.trim();
      }
      return part;
    });

    try {
      const payload = { items };
      if (currentWarehouseId) payload.warehouse_id = parseInt(currentWarehouseId);

      const response = await fetch('elos-db://accessories-bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل في الاستيراد');
      }

      const result = await response.json();

      // Reset import state
      importData = [];
      const previewDiv = document.getElementById('importPreview');
      if (previewDiv) previewDiv.style.display = 'none';
      const fileInput = document.getElementById('importFile');
      if (fileInput) fileInput.value = '';

      if (importBtn) {
        importBtn.disabled = true;
        importBtn.innerHTML = '<span>📥</span><span>استيراد</span>';
      }

      closeModal('importModal');
      loadAccessories();

      if (result.added > 0) {
        showToast(`تم استيراد ${result.added} صنف بنجاح${result.failed > 0 ? ` (${result.failed} فشل)` : ''}`, result.failed > 0 ? 'warning' : 'success');
        if (window.SoundFX && result.failed === 0) window.SoundFX.play('success');

        if (result.errors && result.errors.length > 0) {
          setTimeout(() => {
            const errorList = result.errors.slice(0, 10).map(e =>
              `سطر ${e.index + 2}: ${e.name || 'بدون اسم'} — ${e.error}`
            ).join('\n');
            showToast(`الأصناف التي فشلت:\n${errorList}`, 'error', 8000);
          }, 500);
        }
      } else {
        showToast('فشل في استيراد البيانات', 'error');
      }
    } catch (error) {
      console.error('[IMPORT] Bulk import error:', error);
      showToast('خطأ في الاستيراد: ' + error.message, 'error');
      if (importBtn) {
        importBtn.disabled = false;
        importBtn.innerHTML = '<span>📥</span><span>إعادة المحاولة</span>';
      }
    }
  }

  // ═══════════════════════════════════════
  // SORTING
  // ═══════════════════════════════════════
  function handleSort(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
      sortColumn = column;
      sortDirection = 'ASC';
    }

    // Update UI
    document.querySelectorAll('.elos-acc-th.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.column === column) {
        th.classList.add(sortDirection === 'ASC' ? 'sorted-asc' : 'sorted-desc');
      }
    });

    currentPage = 1;
    loadAccessories();

    Logger.log('[SORT] Column:', column, 'Direction:', sortDirection);
  }

  // ═══════════════════════════════════════
  // TOAST WRAPPER
  // ═══════════════════════════════════════
  function showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[TOAST][${type.toUpperCase()}]`, message);
    }
  }

  // ═══════════════════════════════════════
  // EVENT DELEGATION SETUP
  // ═══════════════════════════════════════
  function setupEventListeners() {
    // Use event delegation on document body
    document.body.addEventListener('click', handleClick);
    document.body.addEventListener('change', handleChange);

    // Search input with debounce
    const searchInput = document.getElementById('qSearch');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        currentPage = 1;
        loadAccessories();
      }, 300));
    }

    // Filter selects
    ['fCategory', 'fCondition', 'fQuantity', 'rowsPerPage'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          if (id === 'rowsPerPage') {
            rowsPerPage = parseInt(el.value) || 50;
          }
          currentPage = 1;
          loadAccessories();
        });
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeydown);

    // Import drop zone drag and drop
    const dropZone = document.getElementById('importDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleImportFileChange(e.dataTransfer.files[0]);
        }
      });
    }

    Logger.log('[EVENTS] Event listeners attached');
  }

  function handleClick(e) {
    const target = e.target;

    // Modal close buttons
    if (target.matches('[data-close-modal]')) {
      closeModal(target.dataset.closeModal);
      return;
    }

    // Modal overlay click (close on background click)
    if (target.matches('.elos-acc-modal-overlay')) {
      closeAllModals();
      return;
    }

    // Action buttons
    if (target.matches('[data-action]') || target.closest('[data-action]')) {
      const btn = target.matches('[data-action]') ? target : target.closest('[data-action]');
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'view':
          viewAccessoryDetails(id);
          break;
        case 'edit':
          openEditModal(id);
          break;
        case 'print':
          openPrintBarcodeModal(id);
          break;
        case 'delete':
          openDeleteModal(id);
          break;
      }
      return;
    }

    // Remove from transfer
    if (target.matches('[data-remove-id]')) {
      removeFromTransfer(target.dataset.removeId);
      return;
    }

    // Sortable headers
    if (target.matches('.elos-acc-th.sortable') || target.closest('.elos-acc-th.sortable')) {
      const th = target.matches('.elos-acc-th.sortable') ? target : target.closest('.elos-acc-th.sortable');
      if (th.dataset.column) {
        handleSort(th.dataset.column);
      }
      return;
    }

    // Header buttons
    if (target.matches('#btnRefresh') || target.closest('#btnRefresh')) {
      loadAccessories();
      return;
    }

    if (target.matches('#btnAddAccessory') || target.closest('#btnAddAccessory')) {
      openAddModal();
      return;
    }

    if (target.matches('#btnClearSearch')) {
      const searchInput = document.getElementById('qSearch');
      if (searchInput) {
        searchInput.value = '';
        currentPage = 1;
        loadAccessories();
      }
      return;
    }

    // Selection actions
    if (target.matches('#btnClearSelection') || target.closest('#btnClearSelection')) {
      clearSelection();
      return;
    }

    if (target.matches('#btnBulkTransfer') || target.closest('#btnBulkTransfer')) {
      openBulkTransferModal();
      return;
    }

    // New Header Buttons (both original and duplicate IDs for iframe support)
    if (target.matches('#btnAddQuantity, #btnAddQuantity2') || target.closest('#btnAddQuantity, #btnAddQuantity2')) {
      openAddQuantityModal();
      return;
    }

    if (target.matches('#btnMovements, #btnMovements2') || target.closest('#btnMovements, #btnMovements2')) {
      openMovementsModal();
      return;
    }

    if (target.matches('#btnImport, #btnImport2') || target.closest('#btnImport, #btnImport2')) {
      openModal('importModal');
      return;
    }

    if (target.matches('#btnExport, #btnExport2') || target.closest('#btnExport, #btnExport2')) {
      exportToExcel();
      return;
    }

    if (target.matches('#btnAddAccessory2') || target.closest('#btnAddAccessory2')) {
      openAddModal();
      return;
    }

    if (target.matches('#btnSelectFile') || target.closest('#btnSelectFile')) {
      document.getElementById('importFile')?.click();
      return;
    }

    if (target.matches('#btnDownloadTemplate')) {
      downloadImportTemplate();
      return;
    }

    if (target.matches('#btnExecuteImport') || target.closest('#btnExecuteImport')) {
      executeImport();
      return;
    }

    if (target.matches('#btnSaveAddQuantity') || target.closest('#btnSaveAddQuantity')) {
      saveAddQuantity();
      return;
    }

    if (target.matches('#btnFilterMovements')) {
      loadMovements();
      return;
    }

    // Modal buttons
    if (target.matches('#btnSaveEdit')) {
      saveEdit();
      return;
    }

    if (target.matches('#btnSaveAdd')) {
      saveAdd();
      return;
    }

    if (target.matches('#btnConfirmDelete')) {
      confirmDelete();
      return;
    }

    if (target.matches('#btnExecuteTransfer') || target.closest('#btnExecuteTransfer')) {
      executeBulkTransfer();
      return;
    }

    if (target.matches('#btnAveragePrices') || target.closest('#btnAveragePrices')) {
      openAveragePricesModal();
      return;
    }

    if (target.matches('#btnPrintBarcodesSelection') || target.closest('#btnPrintBarcodesSelection')) {
      printSelectedAccessoriesBarcodes();
      return;
    }

    if (target.matches('#btnApplyAccAveragePrices') || target.closest('#btnApplyAccAveragePrices')) {
      applyAccessoryAveragePrices();
      return;
    }

    if (target.matches('#btnPrintBarcode') || target.closest('#btnPrintBarcode')) {
      executePrint();
      return;
    }

    // Print modal buttons
    if (target.matches('#btnDoPrint') || target.closest('#btnDoPrint')) {
      executePrint();
      return;
    }

    if (target.matches('#btnRefreshPreview') || target.closest('#btnRefreshPreview')) {
      refreshLabelPreview();
      return;
    }

    // Pagination
    if (target.matches('#btnPrevPage')) {
      if (currentPage > 1) {
        currentPage--;
        loadAccessories();
      }
      return;
    }

    if (target.matches('#btnNextPage')) {
      if (currentPage < totalPages) {
        currentPage++;
        loadAccessories();
      }
      return;
    }

    // Back button
    if (target.matches('#backBtn') || target.closest('#backBtn')) {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'app.html';
      }
      return;
    }
  }

  function handleChange(e) {
    const target = e.target;

    // Select all checkbox
    if (target.matches('#selectAll')) {
      toggleSelectAll(target.checked);
      return;
    }

    // Row checkboxes
    if (target.matches('.elos-acc-row-checkbox')) {
      toggleRowSelection(target.dataset.id, target.checked);
      return;
    }

    // Print modal - update preview when show price option changes
    if (target.matches('#printShowPrice')) {
      refreshLabelPreview();
      return;
    }

    // Import file selection
    if (target.matches('#importFile')) {
      if (target.files && target.files[0]) {
        handleImportFileChange(target.files[0]);
      }
      return;
    }
  }

  function handleKeydown(e) {
    // Escape closes modals
    if (e.key === 'Escape') {
      closeAllModals();
      return;
    }

    // Ctrl+F focuses search
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      const searchInput = document.getElementById('qSearch');
      if (searchInput) searchInput.focus();
      return;
    }
  }

  // ═══════════════════════════════════════
  // CLEANUP ON SPA NAVIGATION
  // ═══════════════════════════════════════
  function cleanup() {
    // Cancel pending fetches
    if (fetchController) {
      fetchController.abort();
      fetchController = null;
    }

    // Remove event listeners
    document.body.removeEventListener('click', handleClick);
    document.body.removeEventListener('change', handleChange);
    document.removeEventListener('keydown', handleKeydown);

    // Clear state
    selectedItems.clear();
    allAccessories = [];
    allWarehouses = [];
    allSuppliers = [];

    // Remove init guard
    delete window.__ELOS_ACCESSORIES_INIT__;

    Logger.log('[CLEANUP] Accessories module cleaned up');
  }

  // Listen for SPA navigation events
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);

  // ═══════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════
  async function init() {
    Logger.log('[INIT] Starting initialization...');

    // Detect warehouse FIRST (must await since it's async now)
    await detectWarehouseId();
    Logger.log('[INIT] Warehouse ID resolved:', currentWarehouseId);

    // Setup event listeners
    setupEventListeners();

    // Load data in parallel
    await Promise.all([
      loadWarehouses(),
      loadSuppliers()
    ]);

    // Load accessories after warehouses (for warehouse name display)
    await loadAccessories();

    Logger.log('[INIT] Initialization complete');
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for external access if needed
  window.ElosAccessories = {
    loadAccessories,
    clearSelection,
    cleanup
  };

})();
