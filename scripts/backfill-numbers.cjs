const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id || 'scnt-vault'
});

const db = admin.firestore();

const pad = (n) => String(n).padStart(4, '0');

function yearOf(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? null : d.getFullYear();
}

async function assignNumbers(collectionName, numberField, prefix, dateFields, countersByYear, stats) {
  const snap = await db.collection(collectionName).get();
  stats.total = snap.size;
  const docs = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const hasNumber = typeof data[numberField] === 'string' && data[numberField].startsWith(prefix + '-');
    docs.push({ id: docSnap.id, data, hasNumber, number: hasNumber ? data[numberField] : null });
  });

  const seenNumbers = new Map();
  for (const d of docs) {
    if (!d.number) continue;
    const prev = seenNumbers.get(d.number);
    if (prev) {
      throw new Error(`DUPLICATE ${numberField}: "${d.number}" on ${collectionName}/${prev} and ${collectionName}/${d.id}`);
    }
    seenNumbers.set(d.number, d.id);
  }

  const missing = docs.filter((d) => !d.hasNumber);
  missing.sort((a, b) => {
    for (const f of dateFields) {
      const av = yearOf(a.data[f]?.toDate ? a.data[f].toDate() : a.data[f]);
      const bv = yearOf(b.data[f]?.toDate ? b.data[f].toDate() : b.data[f]);
      if (av !== bv) return (av || 0) - (bv || 0);
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const perYear = {};
  const lastByYear = {};
  const batchSize = 400;
  let batches = [];

  for (const d of missing) {
    let date = null;
    for (const f of dateFields) {
      const raw = d.data[f];
      const asDate = raw?.toDate ? raw.toDate() : raw;
      const y = yearOf(asDate);
      if (y !== null) { date = asDate; break; }
    }
    const year = date ? date.getFullYear() : null;
    const key = String(year);
    if (!perYear[key]) perYear[key] = [];
    let seq;
    if (countersByYear[key] !== undefined && countersByYear[key] !== null) {
      countersByYear[key] += 1;
      seq = countersByYear[key];
    } else {
      seq = 1;
      countersByYear[key] = 1;
    }
    lastByYear[key] = seq;
    const number = `${prefix}-${key}-${pad(seq)}`;
    perYear[key].push({ id: d.id, number });
    batches.push(db.collection(collectionName).doc(d.id).update({ [numberField]: number }));
    if (batches.length >= batchSize) {
      await Promise.all(batches.splice(0));
    }
  }
  await Promise.all(batches);

  stats.assigned = perYear;
  stats.lastByYear = lastByYear;
  return { perYear, lastByYear };
}

async function setCounter(type, year, seq) {
  if (year === null || year === undefined) return null;
  const existing = await db.collection('counters').doc(`${type}-${year}`).get();
  const current = existing.exists ? Number(existing.data().seq || 0) : 0;
  if (seq > current) {
    await db.collection('counters').doc(`${type}-${year}`).set({ seq }, { merge: true });
  }
  return Math.max(seq, current);
}

async function main() {
  const countersSnap = await db.collection('counters').get();
  const invoiceCounters = {};
  const orderCounters = {};
  countersSnap.forEach((c) => {
    const m = c.id.match(/^(invoice|order)-(\d{4})$/);
    if (m) (m[1] === 'invoice' ? invoiceCounters : orderCounters)[m[2]] = Number(c.data().seq || 0);
  });

  const stats = { sales: {}, orders: {} };

  const sales = await assignNumbers(
    'sales', 'InvoiceNumber', 'SCNT-INV', ['SaleDate'], invoiceCounters, stats.sales
  );

  const orders = await assignNumbers(
    'orders', 'OrderNumber', 'SCNT-ORDER', ['createdAt', 'updatedAt', 'orderDate'], orderCounters, stats.orders
  );

  for (const [year, seq] of Object.entries(sales.lastByYear)) {
    await setCounter('invoice', year, seq);
  }
  for (const [year, seq] of Object.entries(orders.lastByYear)) {
    await setCounter('order', year, seq);
  }

  console.log('=== BACKFILL REPORT ===');
  console.log('Sales total:', stats.sales.total, '| already numbered:', stats.sales.total - Object.values(stats.sales.assigned).flat().length);
  for (const [year, list] of Object.entries(stats.sales.assigned)) {
    console.log(`  sales ${year}: assigned ${list.length}`);
  }
  console.log('Orders total:', stats.orders.total, '| already numbered:', stats.orders.total - Object.values(stats.orders.assigned).flat().length);
  for (const [year, list] of Object.entries(stats.orders.assigned)) {
    console.log(`  orders ${year}: assigned ${list.length}`);
  }

  const allSales = await db.collection('sales').get();
  const seen = new Set();
  let dup = null;
  allSales.forEach((d) => {
    const n = d.data().InvoiceNumber;
    if (n && seen.has(n)) dup = dup || `${n} (sales/${d.id})`;
    if (n) seen.add(n);
  });
  const allOrders = await db.collection('orders').get();
  allOrders.forEach((d) => {
    const n = d.data().OrderNumber;
    if (n && seen.has(n)) dup = dup || `${n} (orders/${d.id})`;
    if (n) seen.add(n);
  });
  console.log('Duplicate check:', dup ? `FAIL: ${dup}` : 'PASS: no duplicates');

  const finalCounters = await db.collection('counters').get();
  console.log('=== FINAL COUNTERS ===');
  finalCounters.forEach((c) => {
    const m = c.id.match(/^(invoice|order)-(\d{4})$/);
    if (m) console.log(`  ${c.id}: seq=${c.data().seq}`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
