// ============================================================
// ELAHMED RETAIL OS — Invoice Printer
// 80mm thermal receipt printing with Arabic layout
// ============================================================

import { Sale } from '@/domain/types';

interface ShopInfo {
  nameAr: string;
  nameEn: string;
  address: string;
  phone: string;
}

const DEFAULT_SHOP_INFO: ShopInfo = {
  nameAr: 'الأحمد',
  nameEn: 'ELAHMED',
  address: 'للموبيلات والإكسسوارات',
  phone: '',
};

export function printInvoice(sale: Sale, shopInfo: ShopInfo = DEFAULT_SHOP_INFO) {
  const date = new Date(sale.date);
  const dateStr = date.toLocaleDateString('ar-EG');
  const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const paymentLabel = sale.paymentMethod === 'cash' ? 'نقدي' :
    sale.paymentMethod === 'card' ? 'بطاقة' : 'تقسيم';

  const html = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة - ${sale.invoiceNumber}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Arial', 'Noto Sans Arabic', sans-serif;
          width: 80mm;
          margin: 0 auto;
          padding: 5mm;
          font-size: 10pt;
          direction: rtl;
        }
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 5mm;
          margin-bottom: 5mm;
        }
        .logo { font-size: 20pt; font-weight: bold; margin-bottom: 2mm; }
        .shop-name-en { font-size: 18pt; font-weight: bold; color: #333; }
        .shop-info { font-size: 9pt; color: #666; margin-top: 2mm; }
        .invoice-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5mm;
          font-size: 9pt;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
        th {
          background-color: #f0f0f0;
          padding: 2mm;
          text-align: right;
          border-bottom: 1px solid #000;
          font-size: 9pt;
        }
        td {
          padding: 2mm;
          border-bottom: 1px dashed #ccc;
          font-size: 9pt;
        }
        .totals {
          border-top: 2px solid #000;
          padding-top: 3mm;
          margin-top: 3mm;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2mm;
          font-size: 10pt;
        }
        .grand-total {
          font-size: 14pt;
          font-weight: bold;
          border-top: 2px solid #000;
          padding-top: 3mm;
          margin-top: 3mm;
        }
        .footer {
          text-align: center;
          margin-top: 5mm;
          border-top: 2px dashed #000;
          padding-top: 5mm;
          font-size: 9pt;
        }
        @media print { body { width: 80mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">${shopInfo.nameAr}</div>
        <div class="shop-name-en">${shopInfo.nameEn}</div>
        <div class="shop-info">
          ${shopInfo.address}<br>
          ${shopInfo.phone ? `هاتف: ${shopInfo.phone}` : ''}
        </div>
      </div>

      <div class="invoice-info">
        <div>
          <strong>فاتورة رقم:</strong> ${sale.invoiceNumber}<br>
          <strong>التاريخ:</strong> ${dateStr}<br>
          <strong>الوقت:</strong> ${timeStr}
        </div>
        <div>
          <strong>الموظف:</strong> ${sale.employee}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${sale.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.qty}</td>
              <td>${item.price.toFixed(2)}</td>
              <td>${(item.price * item.qty - item.lineDiscount).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>المجموع الفرعي:</span>
          <span>${sale.subtotal.toFixed(2)}</span>
        </div>
        ${sale.discount > 0 ? `
          <div class="total-row">
            <span>الخصم:</span>
            <span>-${sale.discount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="total-row grand-total">
          <span>الإجمالي:</span>
          <span>${sale.total.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>طريقة الدفع:</span>
          <span>${paymentLabel}</span>
        </div>
      </div>

      <div class="footer">
        شكراً لزيارتكم<br>
        نتمنى لكم يوماً سعيداً<br>
        <small>لا يمكن استرجاع أو استبدال البضاعة إلا خلال 3 أيام</small>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '', 'width=800,height=600');
  if (!printWindow) {
    throw new Error('تعذر فتح نافذة الطباعة');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    setTimeout(() => printWindow.close(), 500);
  };
}
