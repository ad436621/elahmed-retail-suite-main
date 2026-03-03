// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

const rows = document.getElementById('rows');
const form = document.getElementById('form');
const desc = document.getElementById('desc');
const amt  = document.getElementById('amt');
const type = document.getElementById('type');
const search = document.getElementById('search');
const summaryEl = document.getElementById('summary');

function esc(s){ return (s||'').toString().replace(/[&<>\"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m])); }

async function refresh() {
  const list = await window.api.list(search.value.trim());
  const sum  = await window.api.summary();
  summaryEl.textContent = `إيرادات: ${fmt(sum.income)} • مصروفات: ${fmt(sum.expense)} • صافي: ${fmt(sum.balance)}`;

  rows.innerHTML = list.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${esc(t.description)}</td>
      <td class="${t.trx_type}">${t.trx_type === 'income' ? 'إيراد' : 'مصروف'}</td>
      <td>${fmt(t.amount)}</td>
      <td>${t.created_at.replace('T',' ')}</td>
      <td>
        <button class="link danger" data-del="${t.id}">حذف</button>
      </td>
    </tr>
  `).join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    description: desc.value.trim(),
    amount: parseFloat(amt.value),
    trx_type: type.value
  };
  if (!data.description || isNaN(data.amount)) return;
  await window.api.add(data);
  form.reset();
  await refresh();
});

rows.addEventListener('click', async (e) => {
  const id = e.target?.dataset?.del;
  if (id) {
    // ✅ استخدام showConfirm بدلاً من confirm
    const confirmed = await showConfirm('تأكيد الحذف؟', 'حذف', 'إلغاء', 'danger');
    if (confirmed) {
      await window.api.remove(Number(id));
      await refresh();
    }
  }
});

search.addEventListener('input', () => refresh());

refresh();