/**
 * Stocktake Management - ELOS Accounting
 * إدارة الجرد
 */

(function() {
  'use strict';

  // ========================================
  // CONFIGURATION & STATE
  // ========================================
  const API_URL = 'elos-db://';

  let state = {
    stocktakes: [],
    warehouses: [],
    currentStocktake: null,
    currentItems: [],
    filters: {
      search: '',
      status: '',
      warehouse_id: ''
    }
  };

  // ========================================
  // INITIALIZATION
  // ========================================
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    console.log('[STOCKTAKE] Initializing...');

    setupEventListeners();
    setupBackButton();

    await Promise.all([
      loadWarehouses(),
      loadStocktakes()
    ]);

    console.log('[STOCKTAKE] Initialization complete');
  }

  // ========================================
  // EVENT LISTENERS
  // ========================================
  function setupEventListeners() {
    // List View
    document.getElementById('btnRefresh')?.addEventListener('click', loadStocktakes);
    document.getElementById('btnNewStocktake')?.addEventListener('click', openNewStocktakeModal);
    document.getElementById('btnNewStocktakeEmpty')?.addEventListener('click', openNewStocktakeModal);

    // Filters
    document.getElementById('searchInput')?.addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('filterStatus')?.addEventListener('change', applyFilters);
    document.getElementById('filterWarehouse')?.addEventListener('change', applyFilters);

    // New Stocktake Modal
    document.getElementById('btnCreateStocktake')?.addEventListener('click', createStocktake);
    document.getElementById('newWarehouse')?.addEventListener('change', onWarehouseChange);

    // Delete Modal
    document.getElementById('btnConfirmDelete')?.addEventListener('click', confirmDelete);

    // Counting View
    document.getElementById('btnBackToList')?.addEventListener('click', backToList);
    document.getElementById('btnSaveCounting')?.addEventListener('click', saveCounting);
    document.getElementById('btnCompleteCounting')?.addEventListener('click', openCompleteModal);
    document.getElementById('barcodeInput')?.addEventListener('keypress', onBarcodeKeypress);
    document.getElementById('btnScanBarcode')?.addEventListener('click', scanBarcode);

    // Complete Modal
    document.getElementById('btnConfirmComplete')?.addEventListener('click', confirmComplete);

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', function() {
        const modalId = this.dataset.closeModal;
        closeModal(modalId);
      });
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', function(e) {
        if (e.target === this) {
          this.classList.remove('active');
        }
      });
    });
  }

  function setupBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (window.parent && window.parent.router) {
          window.parent.router.navigate('warehouses');
        } else {
          window.location.href = 'app.html';
        }
      });
    }
  }

  // ========================================
  // API CALLS
  // ========================================
  async function apiCall(endpoint, options = {}) {
    // Remove leading slash if API_URL ends with protocol
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${API_URL}${cleanEndpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
      });

      // Try to parse as JSON, fallback to text for error messages
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Response is plain text (error message)
        if (!response.ok) {
          throw new Error(text || 'حدث خطأ في الاتصال');
        }
        data = { message: text };
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'حدث خطأ في الاتصال');
      }

      return data;
    } catch (error) {
      console.error('[API Error]', endpoint, error);
      throw error;
    }
  }

  // ========================================
  // LOAD DATA
  // ========================================
  async function loadWarehouses() {
    try {
      const data = await apiCall('/warehouses');
      // API returns { warehouses: [...] } not { data: [...] }
      state.warehouses = data.warehouses || data.data || [];

      // Populate warehouse dropdowns
      populateWarehouseDropdowns();
    } catch (error) {
      console.error('[STOCKTAKE] Failed to load warehouses:', error);
      showToast('فشل في تحميل المخازن', 'error');
    }
  }

  function populateWarehouseDropdowns() {
    const filterSelect = document.getElementById('filterWarehouse');
    const newSelect = document.getElementById('newWarehouse');

    const options = state.warehouses.map(w =>
      `<option value="${w.id}">${w.name}</option>`
    ).join('');

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">كل المخازن</option>' + options;
    }

    if (newSelect) {
      newSelect.innerHTML = '<option value="">-- اختر المخزن --</option>' + options;
    }
  }

  async function loadStocktakes() {
    showLoading(true);

    try {
      const params = new URLSearchParams();
      if (state.filters.status) params.append('status', state.filters.status);
      if (state.filters.warehouse_id) params.append('warehouse_id', state.filters.warehouse_id);

      const queryString = params.toString();
      const endpoint = '/stocktakes' + (queryString ? `?${queryString}` : '');

      const data = await apiCall(endpoint);
      // API returns { stocktakes: [...] } not { data: [...] }
      state.stocktakes = data.stocktakes || data.data || [];

      renderStocktakesList();
      updateStats();
    } catch (error) {
      console.error('[STOCKTAKE] Failed to load stocktakes:', error);
      showToast('فشل في تحميل عمليات الجرد', 'error');
    } finally {
      showLoading(false);
    }
  }

  // ========================================
  // RENDER FUNCTIONS
  // ========================================
  function renderStocktakesList() {
    const tbody = document.getElementById('stocktakeTableBody');
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('stocktakeTable');

    // Apply search filter
    let filtered = state.stocktakes;
    if (state.filters.search) {
      const search = state.filters.search.toLowerCase();
      filtered = filtered.filter(s =>
        s.stocktake_no?.toLowerCase().includes(search) ||
        s.warehouse_name?.toLowerCase().includes(search)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      table.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    tbody.innerHTML = filtered.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.stocktake_no)}</strong></td>
        <td>${escapeHtml(s.warehouse_name || 'غير محدد')}</td>
        <td>${getWarehouseTypeLabel(s.warehouse_type)}</td>
        <td>${getStatusBadge(s.status)}</td>
        <td>${s.total_items || 0}</td>
        <td>${s.counted_items || 0}</td>
        <td class="${getVarianceClass(s.variance_items)}">${s.variance_items || 0}</td>
        <td>${formatDate(s.created_at)}</td>
        <td>
          ${getActionButtons(s)}
        </td>
      </tr>
    `).join('');

    // Attach action event listeners
    tbody.querySelectorAll('.action-btn-view').forEach(btn => {
      btn.addEventListener('click', () => viewStocktake(parseInt(btn.dataset.id)));
    });

    tbody.querySelectorAll('.action-btn-count').forEach(btn => {
      btn.addEventListener('click', () => startCounting(parseInt(btn.dataset.id)));
    });

    tbody.querySelectorAll('.action-btn-delete').forEach(btn => {
      btn.addEventListener('click', () => openDeleteModal(parseInt(btn.dataset.id)));
    });
  }

  function getStatusBadge(status) {
    const labels = {
      'draft': '📝 مسودة',
      'in_progress': '🔄 قيد التنفيذ',
      'pending_review': '⏳ في انتظار المراجعة',
      'completed': '✅ مكتمل',
      'cancelled': '❌ ملغي'
    };
    return `<span class="status-badge status-${status}">${labels[status] || status}</span>`;
  }

  function getWarehouseTypeLabel(type) {
    const labels = {
      'devices': 'أجهزة',
      'accessories': 'إكسسوارات',
      'spare_parts': 'قطع غيار',
      'mixed': 'مختلط'
    };
    return labels[type] || type;
  }

  function getVarianceClass(variance) {
    if (!variance || variance === 0) return 'variance-zero';
    return variance > 0 ? 'variance-positive' : 'variance-negative';
  }

  function getActionButtons(stocktake) {
    const buttons = [];

    buttons.push(`<button class="action-btn action-btn-view" data-id="${stocktake.id}" title="عرض">👁️</button>`);

    if (['draft', 'in_progress'].includes(stocktake.status)) {
      buttons.push(`<button class="action-btn action-btn-count" data-id="${stocktake.id}" title="متابعة الجرد">📦</button>`);
    }

    if (stocktake.status === 'draft') {
      buttons.push(`<button class="action-btn action-btn-delete" data-id="${stocktake.id}" title="حذف">🗑️</button>`);
    }

    return buttons.join('');
  }

  function updateStats() {
    const total = state.stocktakes.length;
    const inProgress = state.stocktakes.filter(s => s.status === 'in_progress').length;
    const pending = state.stocktakes.filter(s => s.status === 'pending_review').length;
    const completed = state.stocktakes.filter(s => s.status === 'completed').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statInProgress').textContent = inProgress;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statCompleted').textContent = completed;
  }

  // ========================================
  // CREATE STOCKTAKE
  // ========================================
  function openNewStocktakeModal() {
    document.getElementById('newStocktakeForm').reset();
    openModal('newStocktakeModal');
  }

  function onWarehouseChange() {
    const warehouseId = parseInt(document.getElementById('newWarehouse').value);
    const warehouse = state.warehouses.find(w => w.id === warehouseId);

    if (warehouse) {
      // Auto-detect warehouse type
      const typeSelect = document.getElementById('newWarehouseType');
      if (warehouse.storage_type) {
        typeSelect.value = warehouse.storage_type;
      } else if (warehouse.name.includes('إكسسوار')) {
        typeSelect.value = 'accessories';
      } else if (warehouse.name.includes('جهاز') || warehouse.name.includes('أجهزة')) {
        typeSelect.value = 'devices';
      } else if (warehouse.name.includes('قطع غيار')) {
        typeSelect.value = 'spare_parts';
      }
    }
  }

  async function createStocktake() {
    const warehouseId = document.getElementById('newWarehouse').value;
    const warehouseType = document.getElementById('newWarehouseType').value;
    const notes = document.getElementById('newNotes').value;

    if (!warehouseId || !warehouseType) {
      showToast('الرجاء اختيار المخزن ونوعه', 'error');
      return;
    }

    showLoading(true);

    try {
      // Get current user from session
      const session = getSession();
      const createdBy = session?.user?.username || 'admin';

      const data = await apiCall('/stocktakes', {
        method: 'POST',
        body: JSON.stringify({
          warehouse_id: parseInt(warehouseId),
          warehouse_type: warehouseType,
          created_by: createdBy,
          notes: notes
        })
      });

      showToast('تم إنشاء الجرد بنجاح', 'success');
      closeModal('newStocktakeModal');

      // Start counting immediately
      // API returns { ok: true, stocktake_id: ... }
      await loadStocktakes();
      startCounting(data.stocktake_id);
    } catch (error) {
      showToast(error.message || 'فشل في إنشاء الجرد', 'error');
    } finally {
      showLoading(false);
    }
  }

  // ========================================
  // COUNTING VIEW
  // ========================================
  async function startCounting(stocktakeId) {
    showLoading(true);

    try {
      // Load stocktake details
      // API returns stocktake object directly (no wrapper)
      const stocktakeData = await apiCall(`/stocktakes/${stocktakeId}`);
      state.currentStocktake = stocktakeData;

      // Load items
      // API returns { items: [...], stats: {...} }
      const itemsData = await apiCall(`/stocktakes/${stocktakeId}/items`);
      state.currentItems = itemsData.items || [];

      // Update status to in_progress if draft
      if (state.currentStocktake.status === 'draft') {
        await apiCall(`/stocktakes/${stocktakeId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'in_progress' })
        });
        state.currentStocktake.status = 'in_progress';
      }

      // Switch to counting view
      showCountingView();
      renderCountingItems();
      updateCountingSummary();

      // Focus barcode input
      setTimeout(() => {
        document.getElementById('barcodeInput')?.focus();
      }, 100);

    } catch (error) {
      console.error('[STOCKTAKE] Failed to load stocktake:', error);
      showToast('فشل في تحميل بيانات الجرد', 'error');
    } finally {
      showLoading(false);
    }
  }

  function showCountingView() {
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('countingView').classList.add('active');

    // Update header
    const s = state.currentStocktake;
    document.getElementById('countingTitle').textContent = `جرد: ${s.warehouse_name || 'المخزن'}`;
    document.getElementById('countingStocktakeNo').textContent = `جرد رقم: ${s.stocktake_no}`;
    document.getElementById('countingWarehouseName').textContent = `المخزن: ${s.warehouse_name || 'غير محدد'}`;
  }

  function backToList() {
    document.getElementById('countingView').classList.remove('active');
    document.getElementById('listView').classList.remove('hidden');

    state.currentStocktake = null;
    state.currentItems = [];

    loadStocktakes();
  }

  function renderCountingItems() {
    const tbody = document.getElementById('countingItemsBody');

    tbody.innerHTML = state.currentItems.map((item, index) => {
      const variance = item.counted_quantity !== null
        ? item.counted_quantity - item.system_quantity
        : null;
      const varianceClass = variance === null ? '' : getVarianceClass(variance);
      const countedClass = item.counted_quantity !== null ? 'item-counted' : '';
      const inputClass = item.counted_quantity !== null ? 'counted' : '';

      return `
        <tr class="${countedClass}" data-item-id="${item.id}">
          <td>${escapeHtml(item.barcode || '-')}</td>
          <td>${escapeHtml(item.item_name || 'غير معروف')}</td>
          <td>${getItemTypeLabel(item.item_type)}</td>
          <td class="qty-col">${item.system_quantity}</td>
          <td class="qty-col">
            <input type="number"
                   class="qty-input ${inputClass}"
                   data-index="${index}"
                   value="${item.counted_quantity !== null ? item.counted_quantity : ''}"
                   placeholder="-"
                   min="0">
          </td>
          <td class="qty-col ${varianceClass}">
            ${variance !== null ? (variance > 0 ? '+' + variance : variance) : '-'}
          </td>
          <td>
            <input type="text"
                   class="qty-input"
                   style="width: 150px"
                   data-index="${index}"
                   data-field="notes"
                   value="${escapeHtml(item.notes || '')}"
                   placeholder="ملاحظات">
          </td>
        </tr>
      `;
    }).join('');

    // Attach input event listeners
    tbody.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('change', onItemInputChange);
    });
  }

  function getItemTypeLabel(type) {
    const labels = {
      'device': 'جهاز',
      'accessory': 'إكسسوار',
      'spare_part': 'قطعة غيار'
    };
    return labels[type] || type;
  }

  async function onItemInputChange(e) {
    const index = parseInt(e.target.dataset.index);
    const field = e.target.dataset.field;
    const item = state.currentItems[index];

    if (!item) return;

    if (field === 'notes') {
      item.notes = e.target.value;
    } else {
      const newValue = e.target.value === '' ? null : parseInt(e.target.value);
      item.counted_quantity = newValue;
    }

    // Update on server
    try {
      await apiCall(`/stocktakes/${state.currentStocktake.id}/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          counted_quantity: item.counted_quantity,
          notes: item.notes
        })
      });

      // Re-render to update variance display
      renderCountingItems();
      updateCountingSummary();
    } catch (error) {
      console.error('[STOCKTAKE] Failed to update item:', error);
      showToast('فشل في حفظ التعديل', 'error');
    }
  }

  function updateCountingSummary() {
    const items = state.currentItems;
    const total = items.length;
    const counted = items.filter(i => i.counted_quantity !== null).length;

    let positiveVariance = 0;
    let negativeVariance = 0;
    let totalVarianceValue = 0;

    items.forEach(item => {
      if (item.counted_quantity !== null) {
        const variance = item.counted_quantity - item.system_quantity;
        if (variance > 0) {
          positiveVariance += variance;
        } else if (variance < 0) {
          negativeVariance += Math.abs(variance);
        }
        totalVarianceValue += variance * (item.unit_cost || 0);
      }
    });

    // Update progress
    const percentage = total > 0 ? (counted / total * 100) : 0;
    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${counted} / ${total}`;

    // Update summary
    document.getElementById('summaryTotal').textContent = total;
    document.getElementById('summaryCounted').textContent = counted;
    document.getElementById('summaryPositive').textContent = `+${positiveVariance}`;
    document.getElementById('summaryNegative').textContent = `-${negativeVariance}`;
    document.getElementById('summaryVarianceValue').textContent = formatCurrency(totalVarianceValue);
  }

  // ========================================
  // BARCODE SCANNING
  // ========================================
  function onBarcodeKeypress(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      scanBarcode();
    }
  }

  async function scanBarcode() {
    const input = document.getElementById('barcodeInput');
    const barcode = input.value.trim();

    if (!barcode) return;

    try {
      const data = await apiCall(`/stocktakes/${state.currentStocktake.id}/count`, {
        method: 'POST',
        body: JSON.stringify({ barcode })
      });

      // Update local item
      // API returns { ok: true, item_id: ..., item_name: ..., counted_quantity: ... }
      const index = state.currentItems.findIndex(i => i.id === data.item_id);
      if (index !== -1) {
        state.currentItems[index].counted_quantity = data.counted_quantity;
      }

      renderCountingItems();
      updateCountingSummary();

      // Play success sound and clear input
      playSound('success');
      input.value = '';
      input.focus();

      showToast(`تم جرد: ${data.item_name}`, 'success');
    } catch (error) {
      playSound('error');
      showToast(error.message || 'الصنف غير موجود', 'error');
      input.select();
    }
  }

  // ========================================
  // SAVE & COMPLETE
  // ========================================
  async function saveCounting() {
    showToast('تم حفظ التغييرات', 'success');
  }

  function openCompleteModal() {
    // Calculate variances
    let positiveCount = 0;
    let negativeCount = 0;
    let totalValue = 0;

    state.currentItems.forEach(item => {
      if (item.counted_quantity !== null) {
        const variance = item.counted_quantity - item.system_quantity;
        if (variance > 0) positiveCount++;
        else if (variance < 0) negativeCount++;
        totalValue += variance * (item.unit_cost || 0);
      }
    });

    document.getElementById('completePositive').textContent = positiveCount;
    document.getElementById('completeNegative').textContent = negativeCount;
    document.getElementById('completeValue').textContent = formatCurrency(totalValue);
    document.getElementById('completeReason').value = '';

    openModal('completeModal');
  }

  async function confirmComplete() {
    const reason = document.getElementById('completeReason').value.trim();

    if (!reason) {
      showToast('الرجاء إدخال سبب التعديل', 'error');
      return;
    }

    showLoading(true);

    try {
      const session = getSession();
      const approvedBy = session?.user?.username || 'admin';

      await apiCall(`/stocktakes/${state.currentStocktake.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          approved_by: approvedBy,
          reason: reason
        })
      });

      showToast('تم إنهاء الجرد وتطبيق التعديلات بنجاح', 'success');
      closeModal('completeModal');
      backToList();
    } catch (error) {
      showToast(error.message || 'فشل في إنهاء الجرد', 'error');
    } finally {
      showLoading(false);
    }
  }

  // ========================================
  // VIEW STOCKTAKE
  // ========================================
  async function viewStocktake(stocktakeId) {
    // For now, just open counting view in read mode
    await startCounting(stocktakeId);
  }

  // ========================================
  // DELETE STOCKTAKE
  // ========================================
  let deleteTargetId = null;

  function openDeleteModal(stocktakeId) {
    const stocktake = state.stocktakes.find(s => s.id === stocktakeId);
    if (!stocktake) return;

    deleteTargetId = stocktakeId;
    document.getElementById('deleteStocktakeNo').textContent = stocktake.stocktake_no;
    openModal('deleteModal');
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;

    showLoading(true);

    try {
      await apiCall(`/stocktakes/${deleteTargetId}`, {
        method: 'DELETE'
      });

      showToast('تم حذف الجرد بنجاح', 'success');
      closeModal('deleteModal');
      deleteTargetId = null;
      await loadStocktakes();
    } catch (error) {
      showToast(error.message || 'فشل في حذف الجرد', 'error');
    } finally {
      showLoading(false);
    }
  }

  // ========================================
  // FILTERS
  // ========================================
  function applyFilters() {
    state.filters.search = document.getElementById('searchInput').value;
    state.filters.status = document.getElementById('filterStatus').value;
    state.filters.warehouse_id = document.getElementById('filterWarehouse').value;

    loadStocktakes();
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================
  function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('active');
  }

  function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.toggle('active', show);
    }
  }

  function showToast(message, type = 'info') {
    // Use shared toast if available
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
      alert(message);
    }
  }

  function playSound(type) {
    if (typeof window.playSound === 'function') {
      window.playSound(type);
    }
  }

  function getSession() {
    try {
      if (typeof window.getSession === 'function') {
        return window.getSession();
      }
      const sessionStr = localStorage.getItem('elos_session') || sessionStorage.getItem('elos_session');
      return sessionStr ? JSON.parse(sessionStr) : null;
    } catch (e) {
      return null;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function formatCurrency(amount) {
    const formatted = Math.abs(amount).toLocaleString('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const sign = amount < 0 ? '-' : (amount > 0 ? '+' : '');
    return `${sign}${formatted} ج.م`;
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

})();
