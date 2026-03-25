// ============================================================
// Invoice Service — فواتير PDF باستخدام jsPDF
// ============================================================

import jsPDF from 'jspdf';

export interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
  lineDiscount?: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  storeName?: string;
  storePhone?: string;
  customerName?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  employeeName: string;
  notes?: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'كاش',
  card: 'بطاقة',
  split: 'مقسم',
};

/**
 * Generates a PDF invoice and triggers download.
 * Note: Arabic text in jsPDF requires special font embedding for production.
 * This implementation uses a left-to-right layout with manual Arabic string handling.
 */
export function generateInvoicePDF(data: InvoiceData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  // ── Header ──
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.storeName || 'Al-Ahmed Store', pageWidth / 2, y, { align: 'center' });
  y += 8;

  if (data.storePhone) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.storePhone, pageWidth / 2, y, { align: 'center' });
    y += 6;
  }

  // ── Invoice Info ──
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice #${data.invoiceNumber}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${data.date}`, pageWidth - margin, y, { align: 'right' });
  y += 6;

  doc.text(`Employee: ${data.employeeName}`, margin, y);
  doc.text(`Payment: ${PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod}`, pageWidth - margin, y, { align: 'right' });
  y += 6;

  if (data.customerName) {
    doc.text(`Customer: ${data.customerName}`, margin, y);
    if (data.customerPhone) {
      doc.text(`Phone: ${data.customerPhone}`, pageWidth - margin, y, { align: 'right' });
    }
    y += 6;
  }

  y += 4;

  // ── Items Table ──
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');

  const col1 = margin + 2;
  const col2 = margin + 80;
  const col3 = margin + 100;
  const col4 = margin + 125;
  const col5 = pageWidth - margin - 2;

  doc.text('Product', col1, y);
  doc.text('Qty', col2, y);
  doc.text('Price', col3, y);
  doc.text('Disc.', col4, y);
  doc.text('Total', col5, y, { align: 'right' });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  for (const item of data.items) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    const truncatedName = item.name.length > 35 ? item.name.substring(0, 32) + '...' : item.name;
    doc.text(truncatedName, col1, y);
    doc.text(String(item.qty), col2, y);
    doc.text(item.price.toLocaleString(), col3, y);
    doc.text((item.lineDiscount || 0).toLocaleString(), col4, y);
    doc.text(item.total.toLocaleString(), col5, y, { align: 'right' });
    y += 6;
  }

  y += 4;
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Totals ──
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Subtotal:', margin, y);
  doc.text(data.subtotal.toLocaleString(), col5, y, { align: 'right' });
  y += 6;

  if (data.discount > 0) {
    doc.setTextColor(220, 50, 50);
    doc.text('Discount:', margin, y);
    doc.text(`-${data.discount.toLocaleString()}`, col5, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  doc.setFontSize(14);
  doc.setTextColor(0, 128, 0);
  doc.text('TOTAL:', margin, y);
  doc.text(data.total.toLocaleString(), col5, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // ── Notes ──
  if (data.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`Notes: ${data.notes}`, margin, y);
    y += 6;
  }

  // ── Footer ──
  y = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('Thank you for your business!', pageWidth / 2, y, { align: 'center' });

  // ── Download ──
  doc.save(`Invoice-${data.invoiceNumber}.pdf`);
}
