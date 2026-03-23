// ═══════════════════════════════════════════════════════════════
// ✏️ INVOICE EDIT MODULE - تعديل فاتورة بيع (مدير فقط)
// ═══════════════════════════════════════════════════════════════
// يتضمن: Modal HTML + Logic + API calls
// يستخدم في: pos.html + reports.html
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── State ───
  let editInvoiceData = null;    // بيانات الفاتورة المحملة
  let editOriginalValues = {};   // القيم الأصلية لكل عنصر { saleId: { price, discount, paid } }
  let editCurrentValues = {};    // القيم الحالية (المعدلة)

  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ─── Inject Modal HTML ───
  function ensureEditModalExists() {
    if (document.getElementById('editInvoiceModal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = `
      <div id="editInvoiceModal" class="modal" style="display:none; position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.5); align-items:center; justify-content:center;">
        <div style="background:var(--bg-primary, #fff); border-radius:16px; max-width:750px; width:95%; max-height:90vh; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.3); animation: modalSlideIn 0.3s ease;">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8); padding:18px 24px; display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0; color:#fff; font-size:17px; display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">&#9997;</span> تعديل فاتورة
            </h3>
            <button onclick="closeEditInvoiceModal()" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center;">&times;</button>
          </div>

          <!-- Body -->
          <div style="padding:20px; overflow-y:auto; flex:1;">
            <!-- Invoice Info -->
            <div id="editInvoiceInfo" style="padding:14px; background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.08)); border:1px solid rgba(59,130,246,0.2); border-radius:10px; margin-bottom:16px;"></div>

            <!-- Items -->
            <div id="editInvoiceItems" style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px;"></div>

            <!-- Summary -->
            <div id="editInvoiceSummary" style="display:none; padding:12px; background:linear-gradient(135deg,rgba(16,185,129,0.08),rgba(59,130,246,0.08)); border:1px solid rgba(16,185,129,0.2); border-radius:10px; margin-bottom:16px;"></div>

            <!-- Edit Reason -->
            <div style="margin-bottom:14px;">
              <label style="font-size:13px; font-weight:600; color:var(--text-secondary,#666); margin-bottom:6px; display:block;">
                <span style="margin-left:4px;">&#128221;</span> سبب التعديل <span style="color:#ef4444;">*</span>
              </label>
              <input type="text" id="editInvoiceReason" placeholder="مثال: تفاوض مع العميل، خطأ في السعر..."
                style="width:100%; padding:10px 14px; border:1px solid var(--border,#ddd); border-radius:8px; font-size:13px; direction:rtl; box-sizing:border-box;">
            </div>

            <!-- Admin Password -->
            <div style="padding:14px; background:rgba(139,92,246,0.06); border:1px solid rgba(139,92,246,0.2); border-radius:10px;">
              <div style="font-size:12px; color:#7c3aed; font-weight:700; margin-bottom:8px; display:flex; align-items:center; gap:4px;">
                <span>&#128272;</span> تصريح مدير مطلوب
              </div>
              <input type="password" id="editInvoiceAdminPassword" placeholder="أدخل كلمة مرور المدير..."
                style="width:100%; padding:10px 14px; border:1px solid var(--border,#ddd); border-radius:8px; font-size:13px; direction:rtl; box-sizing:border-box;">
            </div>
          </div>

          <!-- Footer -->
          <div style="padding:14px 24px; border-top:1px solid var(--border,#eee); display:flex; justify-content:flex-end; gap:10px; background:var(--bg-secondary, #f9fafb);">
            <button onclick="closeEditInvoiceModal()"
              style="padding:10px 20px; border:1px solid var(--border,#ddd); border-radius:8px; background:var(--bg-primary,#fff); color:var(--text,#333); cursor:pointer; font-size:13px; font-weight:600;">
              إلغاء
            </button>
            <button id="editInvoiceSaveBtn" onclick="saveInvoiceEdits()" disabled
              style="padding:10px 24px; border:none; border-radius:8px; background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; cursor:pointer; font-size:13px; font-weight:700; opacity:0.5; transition:opacity 0.2s;">
              &#128190; حفظ التعديلات
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalDiv.firstElementChild);
  }

  // ─── Open Edit Modal ───
  // ─── Helper: Get current user role ───
  function getCurrentUserRole() {
    const user = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    return (user.role || '').toLowerCase();
  }

  function isAdminUser() {
    const role = getCurrentUserRole();
    return role === 'admin' || role === 'manager';
  }

  // Expose for use in other scripts
  window.isAdminForEdit = isAdminUser;

  window.openEditInvoiceModal = async function (invoiceNumber) {
    // Check admin
    if (!isAdminUser()) {
      if (typeof showToast === 'function') showToast('هذه العملية مخصصة للمديرين فقط', 'error');
      return;
    }

    ensureEditModalExists();

    try {
      // Show loading
      const modal = document.getElementById('editInvoiceModal');
      modal.style.display = 'flex';
      document.getElementById('editInvoiceItems').innerHTML = '<div style="text-align:center; padding:30px; color:var(--muted,#999);">جاري التحميل...</div>';

      // Fetch invoice
      const response = await fetch(`elos-db://invoice/${invoiceNumber}`);
      if (!response.ok) throw new Error('فشل تحميل الفاتورة');
      const invoice = await response.json();

      if (invoice.status === 'returned') {
        if (typeof showToast === 'function') showToast('لا يمكن تعديل فاتورة مرتجعة بالكامل', 'error');
        modal.style.display = 'none';
        return;
      }

      editInvoiceData = invoice;
      editOriginalValues = {};
      editCurrentValues = {};

      // Render info
      renderEditInvoiceInfo(invoice);

      // Render editable items
      renderEditableItems(invoice.items);

      // Reset form
      document.getElementById('editInvoiceReason').value = '';
      document.getElementById('editInvoiceAdminPassword').value = '';
      updateSaveButton();

    } catch (error) {
      console.error('[EDIT-INVOICE] Error:', error);
      if (typeof showToast === 'function') showToast('فشل تحميل الفاتورة: ' + error.message, 'error');
      document.getElementById('editInvoiceModal').style.display = 'none';
    }
  };

  // ─── Close Modal ───
  window.closeEditInvoiceModal = function () {
    const modal = document.getElementById('editInvoiceModal');
    if (modal) modal.style.display = 'none';
    editInvoiceData = null;
    editOriginalValues = {};
    editCurrentValues = {};
  };

  // ─── Render Invoice Info Banner ───
  function renderEditInvoiceInfo(invoice) {
    const infoDiv = document.getElementById('editInvoiceInfo');
    const date = new Date(invoice.created_at).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const itemsCount = (invoice.devices_count || 0) + (invoice.accessories_count || 0) + (invoice.repair_parts_count || 0);

    let statusHtml = '';
    if (invoice.status === 'partially_returned') {
      statusHtml = '<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; margin-right:8px;">مرتجع جزئي</span>';
    }

    infoDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <div style="font-weight:700; font-size:15px; color:var(--text);">
            ${invoice.invoice_number} ${statusHtml}
          </div>
          <div style="font-size:12px; color:var(--muted,#999); margin-top:4px;">
            &#128100; ${invoice.customer_name || 'عميل نقدي'} &bull; &#128197; ${date} &bull; ${itemsCount} عنصر
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:12px; color:var(--muted,#999);">إجمالي الفاتورة</div>
          <div style="font-weight:700; font-size:16px; color:var(--success,#10b981);">${fmt(invoice.total_amount)} ج.م</div>
        </div>
      </div>
    `;
  }

  // ─── Render Editable Items ───
  function renderEditableItems(items) {
    const container = document.getElementById('editInvoiceItems');
    if (!items || items.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted);">لا توجد عناصر</div>';
      return;
    }

    container.innerHTML = items.map(item => {
      const isReturned = item.status === 'returned';
      const isDevice = item.item_type === 'device';
      const isAccessory = item.item_type === 'accessory';
      const isRepairPart = item.item_type === 'repair_part';
      const quantity = Number(item.quantity || 1);

      // For devices: price = sell_price, for others: we show unit_price
      let currentPrice, currentDiscount, currentPaid;
      if (isDevice) {
        currentPrice = Number(item.price || 0);
        currentDiscount = Number(item.discount || 0);
        currentPaid = Number(item.paid_now || 0);
      } else {
        // Accessories & repair parts: unit_price editable, discount on total
        currentPrice = Number(item.unit_price || item.price || 0);
        currentDiscount = Number(item.discount || 0);
        currentPaid = Number(item.paid_now || 0);
      }

      // Store original values
      editOriginalValues[item.sale_id] = {
        price: currentPrice,
        discount: currentDiscount,
        paid: currentPaid,
        item_type: item.item_type,
        quantity: quantity
      };
      editCurrentValues[item.sale_id] = { ...editOriginalValues[item.sale_id] };

      const typeBadge = isDevice
        ? '<span style="background:#dbeafe; color:#1d4ed8; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">جهاز</span>'
        : isAccessory
        ? '<span style="background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">إكسسوار</span>'
        : '<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">قطع غيار</span>';

      const returnedBadge = isReturned
        ? '<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:600; margin-right:6px;">مرتجع</span>'
        : '';

      const qtyLabel = quantity > 1 ? ` (${quantity} قطعة)` : '';
      const netTotal = isDevice ? (currentPrice - currentDiscount) : ((currentPrice * quantity) - currentDiscount);
      const remaining = netTotal - currentPaid;

      return `
        <div id="editItem_${item.sale_id}" style="padding:14px; border:1px solid ${isReturned ? '#fecaca' : 'var(--border,#e5e7eb)'}; border-radius:10px; ${isReturned ? 'opacity:0.5; pointer-events:none;' : ''} background:var(--bg-primary,#fff);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            ${typeBadge} ${returnedBadge}
            <span style="font-weight:600; font-size:13px; color:var(--text);">${item.item_name || 'منتج'}${qtyLabel}</span>
          </div>

          ${isReturned ? '<div style="text-align:center; padding:10px; color:#991b1b; font-size:12px;">لا يمكن تعديل عنصر مرتجع</div>' : `
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
            <!-- سعر البيع -->
            <div>
              <label style="font-size:11px; color:var(--muted,#999); margin-bottom:4px; display:block;">
                ${isDevice ? 'سعر البيع' : 'سعر الوحدة'}
              </label>
              <input type="number" step="0.01" min="0" value="${currentPrice}"
                id="editPrice_${item.sale_id}"
                oninput="onEditFieldChanged(${item.sale_id})"
                style="width:100%; padding:8px 10px; border:1px solid var(--border,#ddd); border-radius:6px; font-size:13px; text-align:center; box-sizing:border-box;">
              <div id="editPriceOrig_${item.sale_id}" style="font-size:10px; color:var(--muted); margin-top:2px; text-align:center; display:none;"></div>
            </div>

            <!-- الخصم -->
            <div>
              <label style="font-size:11px; color:var(--muted,#999); margin-bottom:4px; display:block;">الخصم</label>
              <input type="number" step="0.01" min="0" value="${currentDiscount}"
                id="editDiscount_${item.sale_id}"
                oninput="onEditFieldChanged(${item.sale_id})"
                style="width:100%; padding:8px 10px; border:1px solid var(--border,#ddd); border-radius:6px; font-size:13px; text-align:center; box-sizing:border-box;">
              <div id="editDiscountOrig_${item.sale_id}" style="font-size:10px; color:var(--muted); margin-top:2px; text-align:center; display:none;"></div>
            </div>

            <!-- المدفوع -->
            <div>
              <label style="font-size:11px; color:var(--muted,#999); margin-bottom:4px; display:block;">المدفوع</label>
              <input type="number" step="0.01" min="0" value="${currentPaid}"
                id="editPaid_${item.sale_id}"
                oninput="onEditFieldChanged(${item.sale_id})"
                style="width:100%; padding:8px 10px; border:1px solid var(--border,#ddd); border-radius:6px; font-size:13px; text-align:center; box-sizing:border-box;">
              <div id="editPaidOrig_${item.sale_id}" style="font-size:10px; color:var(--muted); margin-top:2px; text-align:center; display:none;"></div>
            </div>
          </div>

          <!-- Computed row -->
          <div style="display:flex; justify-content:space-between; margin-top:10px; padding:8px 12px; background:var(--bg-secondary,#f9fafb); border-radius:6px; font-size:12px;">
            <span>الصافي: <strong id="editNet_${item.sale_id}" style="color:var(--text);">${fmt(netTotal)}</strong></span>
            <span>المتبقي: <strong id="editRemaining_${item.sale_id}" style="color:${remaining > 0 ? '#ef4444' : '#10b981'};">${fmt(remaining)}</strong></span>
          </div>
          <div id="editError_${item.sale_id}" style="display:none; margin-top:6px; padding:6px 10px; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; font-size:11px; color:#991b1b;"></div>
          `}
        </div>
      `;
    }).join('');
  }

  // ─── On Field Changed ───
  window.onEditFieldChanged = function (saleId) {
    const orig = editOriginalValues[saleId];
    if (!orig) return;

    const priceEl = document.getElementById(`editPrice_${saleId}`);
    const discountEl = document.getElementById(`editDiscount_${saleId}`);
    const paidEl = document.getElementById(`editPaid_${saleId}`);

    const newPrice = Number(priceEl.value) || 0;
    const newDiscount = Number(discountEl.value) || 0;
    const newPaid = Number(paidEl.value) || 0;
    const quantity = orig.quantity || 1;
    const isDevice = orig.item_type === 'device';

    // Update current values
    editCurrentValues[saleId] = { ...orig, price: newPrice, discount: newDiscount, paid: newPaid };

    // Calculate net
    const maxTotal = isDevice ? newPrice : (newPrice * quantity);
    const net = maxTotal - newDiscount;
    const remaining = net - newPaid;

    // Update display
    const netEl = document.getElementById(`editNet_${saleId}`);
    const remainingEl = document.getElementById(`editRemaining_${saleId}`);
    if (netEl) netEl.textContent = fmt(net);
    if (remainingEl) {
      remainingEl.textContent = fmt(remaining);
      remainingEl.style.color = remaining > 0 ? '#ef4444' : '#10b981';
    }

    // Show original value hints for changed fields
    showOrigHint('editPriceOrig', saleId, orig.price, newPrice);
    showOrigHint('editDiscountOrig', saleId, orig.discount, newDiscount);
    showOrigHint('editPaidOrig', saleId, orig.paid, newPaid);

    // Highlight changed inputs
    highlightInput(priceEl, orig.price, newPrice);
    highlightInput(discountEl, orig.discount, newDiscount);
    highlightInput(paidEl, orig.paid, newPaid);

    // Validate
    const errorEl = document.getElementById(`editError_${saleId}`);
    let errorMsg = '';
    if (newPrice < 0) errorMsg = 'سعر البيع لا يمكن أن يكون سالب';
    else if (newDiscount < 0) errorMsg = 'الخصم لا يمكن أن يكون سالب';
    else if (newDiscount > maxTotal) errorMsg = 'الخصم لا يمكن أن يتجاوز إجمالي السعر';
    else if (newPaid < 0) errorMsg = 'المدفوع لا يمكن أن يكون سالب';
    else if (newPaid > net) errorMsg = 'المدفوع لا يمكن أن يتجاوز الصافي';

    if (errorEl) {
      errorEl.style.display = errorMsg ? 'block' : 'none';
      errorEl.textContent = errorMsg;
    }

    // Update summary & save button
    updateEditSummary();
    updateSaveButton();
  };

  function showOrigHint(prefix, saleId, origVal, newVal) {
    const el = document.getElementById(`${prefix}_${saleId}`);
    if (!el) return;
    if (Math.abs(origVal - newVal) > 0.001) {
      el.style.display = 'block';
      el.innerHTML = `<s style="color:#ef4444;">${fmt(origVal)}</s>`;
    } else {
      el.style.display = 'none';
    }
  }

  function highlightInput(el, origVal, newVal) {
    if (Math.abs(origVal - newVal) > 0.001) {
      el.style.borderColor = '#3b82f6';
      el.style.background = 'rgba(59,130,246,0.05)';
    } else {
      el.style.borderColor = '';
      el.style.background = '';
    }
  }

  // ─── Get Changed Items ───
  function getChangedItems() {
    const changed = [];
    for (const saleId of Object.keys(editOriginalValues)) {
      const orig = editOriginalValues[saleId];
      const curr = editCurrentValues[saleId];
      if (!orig || !curr) continue;

      const priceChanged = Math.abs(orig.price - curr.price) > 0.001;
      const discountChanged = Math.abs(orig.discount - curr.discount) > 0.001;
      const paidChanged = Math.abs(orig.paid - curr.paid) > 0.001;

      if (priceChanged || discountChanged || paidChanged) {
        // Validate
        const isDevice = orig.item_type === 'device';
        const maxTotal = isDevice ? curr.price : (curr.price * orig.quantity);
        const net = maxTotal - curr.discount;
        if (curr.price < 0 || curr.discount < 0 || curr.discount > maxTotal || curr.paid < 0 || curr.paid > net) {
          continue; // skip invalid items
        }
        changed.push({ saleId: Number(saleId), ...curr });
      }
    }
    return changed;
  }

  // ─── Update Summary ───
  function updateEditSummary() {
    const summaryEl = document.getElementById('editInvoiceSummary');
    if (!summaryEl) return;
    const changed = getChangedItems();
    if (changed.length === 0) {
      summaryEl.style.display = 'none';
      return;
    }

    summaryEl.style.display = 'block';
    summaryEl.innerHTML = `
      <div style="font-size:12px; font-weight:700; color:var(--text); margin-bottom:6px;">&#128202; ملخص التعديلات (${changed.length} عنصر)</div>
      ${changed.map(c => {
        const orig = editOriginalValues[c.saleId];
        const isDevice = orig.item_type === 'device';
        const oldNet = isDevice ? (orig.price - orig.discount) : ((orig.price * orig.quantity) - orig.discount);
        const newNet = isDevice ? (c.price - c.discount) : ((c.price * c.quantity) - c.discount);
        const diff = newNet - oldNet;
        return `<div style="font-size:11px; color:var(--muted); padding:2px 0;">
          #${c.saleId}: الصافي ${fmt(oldNet)} &rarr; ${fmt(newNet)}
          <span style="color:${diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : 'var(--muted)'};">(${diff >= 0 ? '+' : ''}${fmt(diff)})</span>
        </div>`;
      }).join('')}
    `;
  }

  // ─── Update Save Button ───
  function updateSaveButton() {
    const btn = document.getElementById('editInvoiceSaveBtn');
    if (!btn) return;
    const changed = getChangedItems();
    const hasChanges = changed.length > 0;
    btn.disabled = !hasChanges;
    btn.style.opacity = hasChanges ? '1' : '0.5';
  }

  // ─── Save Edits ───
  window.saveInvoiceEdits = async function () {
    const reason = (document.getElementById('editInvoiceReason')?.value || '').trim();
    const password = (document.getElementById('editInvoiceAdminPassword')?.value || '').trim();

    if (!reason) {
      if (typeof showToast === 'function') showToast('يرجى إدخال سبب التعديل', 'error');
      document.getElementById('editInvoiceReason')?.focus();
      return;
    }
    if (!password) {
      if (typeof showToast === 'function') showToast('يرجى إدخال كلمة مرور المدير', 'error');
      document.getElementById('editInvoiceAdminPassword')?.focus();
      return;
    }

    const changed = getChangedItems();
    if (changed.length === 0) {
      if (typeof showToast === 'function') showToast('لا توجد تعديلات', 'warning');
      return;
    }

    const saveBtn = document.getElementById('editInvoiceSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ...';
    }

    let successCount = 0;
    let errors = [];

    for (const item of changed) {
      try {
        const res = await fetch('elos-db://edit-invoice-item', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sale_id: item.saleId,
            item_type: item.item_type,
            invoice_number: editInvoiceData.invoice_number,
            admin_password: password,
            new_sell_price: item.price,
            new_discount: item.discount,
            new_paid_amount: item.paid,
            edit_reason: reason
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          let errorMsg;
          try { errorMsg = JSON.parse(errorText).error || errorText; } catch (e) { errorMsg = errorText; }
          throw new Error(errorMsg);
        }

        successCount++;
      } catch (error) {
        errors.push(`#${item.saleId}: ${error.message}`);
      }
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '&#128190; حفظ التعديلات';
    }

    if (successCount > 0 && errors.length === 0) {
      if (typeof showToast === 'function') showToast(`تم تعديل ${successCount} عنصر بنجاح`, 'success');
      closeEditInvoiceModal();

      // Refresh data in POS or Reports
      if (typeof window.loadInvoicesForReturn === 'function') {
        try { window.loadInvoicesForReturn(); } catch (e) { }
      }
      if (typeof window.loadInvoicesReport === 'function') {
        try { window.loadInvoicesReport(); } catch (e) { }
      }
      // Refresh sales pages if available
      if (typeof window.boot === 'function' && document.getElementById('salesTableBody')) {
        try { window.boot(false); } catch (e) { }
      }
    } else if (successCount > 0 && errors.length > 0) {
      if (typeof showToast === 'function') showToast(`تم تعديل ${successCount} عنصر، فشل ${errors.length}: ${errors[0]}`, 'warning');
      closeEditInvoiceModal();
    } else {
      if (typeof showToast === 'function') showToast('فشل التعديل: ' + errors[0], 'error');
    }
  };

})();
