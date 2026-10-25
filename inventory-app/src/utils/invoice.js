import { jsPDF } from 'jspdf';
import fontUrl from '../assets/DejaVuSans.ttf';
import fontBoldUrl from '../assets/DejaVuSans-Bold.ttf';

const M = 14;
const W = 210;
const CW = W - M * 2;
const COL_ITEM = M;
const COL_QTY = M + 96;
const COL_UNIT = M + 126;
const COL_SUB = W - M;

let fontData = null;
let fontPromise = null;
function ensureFonts() {
  if (fontPromise === null) {
    fontPromise = Promise.all([
      fetch(fontUrl).then(r => r.arrayBuffer()),
      fetch(fontBoldUrl).then(r => r.arrayBuffer())
    ]).then(([regular, bold]) => {
      const toB64 = buf => {
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
      };
      fontData = { regular: toB64(regular), bold: toB64(bold) };
    }).catch(err => { fontPromise = null; throw err; });
  }
  return fontPromise;
}

function attachFonts(doc) {
  doc.addFileToVFS('DejaVuSans.ttf', fontData.regular);
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', fontData.bold);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
}

const peso = n => `₱${Number(n || 0).toLocaleString()}`;

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'string') return new Date(v);
  return null;
}

function formatDate(v) {
  const d = toDate(v);
  if (!d || isNaN(d)) return '';
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

const itemName = it => {
  const name = it.ProductName || it.Name || it.ProductId || 'Item';
  return it.Pcs ? `${name} — ${it.Pcs} pcs` : name;
};
const itemQty = it => it.Quantity ?? 1;
const itemUnit = it => Number(it.UnitPrice ?? it.Price ?? 0);
const itemSub = it => Number(it.Subtotal ?? (itemUnit(it) * itemQty(it)));

function metaField(doc, y, label, value) {
  doc.setFontSize(7.5);
  doc.setTextColor(130, 136, 146);
  doc.text(label, M, y);
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text(String(value || '—'), M + 32, y);
  return y + 11;
}

function drawFooter(doc) {
  const y = 279;
  doc.setDrawColor(229, 231, 235);
  doc.line(M, y, W - M, y);
  doc.setFontSize(9.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Thank you for shopping with SCNT VAULT!', W / 2, y + 6, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('SCNT VAULT — scnt-vault.web.app', W / 2, y + 11, { align: 'center' });
}

export async function generateInvoice(sale, { orderId, orderNumber } = {}) {
  await ensureFonts();

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  attachFonts(doc);
  doc.setFont('DejaVu');

  doc.setFontSize(22);
  doc.setFont('DejaVu', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('SCNT VAULT', M, 22);
  doc.setFontSize(8.5);
  doc.setFont('DejaVu', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text('scnt-vault.web.app', M, 27);

  doc.setFontSize(26);
  doc.setFont('DejaVu', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('INVOICE', W - M, 27, { align: 'right' });

  doc.setDrawColor(229, 231, 235);
  doc.line(M, 33, W - M, 33);

  let y = 42;
  y = metaField(doc, y, 'Invoice No.', sale.InvoiceNumber || sale.id);
  if (orderId || orderNumber) y = metaField(doc, y, 'Order No.', orderNumber || orderId);
  y = metaField(doc, y, 'Date', formatDate(sale.SaleDate));
  y = metaField(doc, y, 'Payment', sale.PaymentMethod || '—');

  const billTo = sale.CustomerType === 'reseller' ? 'BILL TO (RESELLER)' : 'BILL TO';
  y += 4;
  doc.setFontSize(8);
  doc.setFont('DejaVu', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text(billTo, M, y);
  y += 6;
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(String(sale.CustomerName || 'Walk-in Customer'), M, y);
  y += 5.5;
  doc.setFontSize(9.5);
  doc.setFont('DejaVu', 'normal');
  doc.setTextColor(107, 114, 128);
  if (sale.CustomerPhone) { doc.text(String(sale.CustomerPhone), M, y); y += 5; }
  if (sale.CustomerAddress) {
    const addrLines = doc.splitTextToSize(String(sale.CustomerAddress), CW);
    doc.text(addrLines, M, y);
    y += addrLines.length * 5;
  }
  if (sale.CustomerNotes) {
    const noteLines = doc.splitTextToSize(String(sale.CustomerNotes), CW);
    doc.text(noteLines, M, y);
    y += noteLines.length * 5;
  }

  const items = Array.isArray(sale.Items) ? sale.Items : [];
  y += 12;

  const drawTableHeader = () => {
    doc.setFillColor(243, 244, 246);
    doc.rect(M, y - 5, CW, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('DejaVu', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('ITEM', COL_ITEM, y);
    doc.text('QTY', COL_QTY, y, { align: 'right' });
    doc.text('UNIT PRICE', COL_UNIT, y, { align: 'right' });
    doc.text('SUBTOTAL', COL_SUB, y, { align: 'right' });
    y += 5;
  };

  drawTableHeader();

  doc.setFontSize(9.5);
  doc.setFont('DejaVu', 'normal');
  items.forEach(it => {
    if (y > 258) {
      doc.addPage();
      y = 20;
      drawTableHeader();
      doc.setFontSize(9.5);
      doc.setFont('DejaVu', 'normal');
    }
    const lines = doc.splitTextToSize(itemName(it), COL_QTY - COL_ITEM - 8);
    const rowH = Math.max(lines.length * 4.8, 6);
    doc.setTextColor(31, 41, 55);
    doc.text(lines, COL_ITEM, y + rowH - 1.5);
    doc.text(String(itemQty(it)), COL_QTY, y + 3, { align: 'right' });
    doc.text(peso(itemUnit(it)), COL_UNIT, y + 3, { align: 'right' });
    doc.text(peso(itemSub(it)), COL_SUB, y + 3, { align: 'right' });
    doc.setDrawColor(229, 231, 235);
    doc.line(M, y + rowH + 1.5, W - M, y + rowH + 1.5);
    y += rowH + 4;
  });

  if (y > 235) { doc.addPage(); y = 20; }

  y += 8;
  const rightX = W - M;
  const totalW = 72;
  const labelX = rightX - totalW;

  doc.setFontSize(9.5);
  const row = (label, value, color, bold) => {
    doc.setFont('DejaVu', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(label, labelX, y);
    doc.text(value, rightX, y, { align: 'right' });
    y += 6.5;
  };

  row('Subtotal', peso(sale.Subtotal), [107, 114, 128], false);
  if (sale.Discount && sale.Discount > 0) row('Discount', `-${peso(sale.Discount)}`, [239, 68, 68], false);
  if (sale.ShippingFee && sale.ShippingFee > 0) row('Shipping Fee', peso(sale.ShippingFee), [107, 114, 128], false);

  doc.setDrawColor(209, 213, 219);
  doc.line(labelX, y - 2, rightX, y - 2);
  doc.setFontSize(13);
  doc.setFont('DejaVu', 'bold');
  doc.setTextColor(99, 102, 241);
  doc.text('Grand Total', labelX, y + 3);
  doc.text(peso(sale.Total ?? (Number(sale.Subtotal || 0) - Number(sale.Discount || 0))), rightX, y + 3, { align: 'right' });

  drawFooter(doc);

  doc.save(`Invoice-${sale.InvoiceNumber || sale.id}.pdf`);
}
