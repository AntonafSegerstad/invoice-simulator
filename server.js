const express = require('express');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'invoices.json');
const CURRENCIES = ['SEK', 'EUR', 'DKK', 'NOK'];

// Lifecycle (deterministic, derived from age so it survives restarts):
//   0.0s - 1.0s  CREATED
//   1.0s - 3.0s  PROCESSING
//   3.0s +       APPROVED
const PROCESSING_AFTER_MS = 1000;
const APPROVED_AFTER_MS = 3000;

let invoices = [];
let nextId = 1;

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    invoices = saved.invoices || [];
    nextId = saved.nextId || 1;
  } catch (e) { /* first start */ }
}
function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ invoices, nextId }));
  } catch (e) { console.error('Could not save data:', e.message); }
}

function statusOf(inv) {
  const age = Date.now() - inv.createdAt;
  if (age >= APPROVED_AFTER_MS) return 'APPROVED';
  if (age >= PROCESSING_AFTER_MS) return 'PROCESSING';
  return 'CREATED';
}
function view(inv) {
  return {
    id: inv.id, customer: inv.customer, invoiceNumber: inv.invoiceNumber,
    amount: inv.amount, currency: inv.currency, dueDate: inv.dueDate,
    status: statusOf(inv), createdAt: new Date(inv.createdAt).toISOString()
  };
}

// Accepts "10000", "10,000", "10 000", "10000.50", "10000,50"
function parseAmount(raw) {
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

function validate(body) {
  const errors = {};
  const customer = String(body.customer ?? '').trim();
  const invoiceNumber = String(body.invoiceNumber ?? '').trim();
  const currency = String(body.currency ?? '').trim();
  const dueDate = String(body.dueDate ?? '').trim();
  const rawAmount = body.amount ?? '';

  if (!customer) errors.customer = 'Customer is required.';
  if (!invoiceNumber) errors.invoiceNumber = 'Invoice number is required.';
  let amount = null;
  if (String(rawAmount).trim() === '') errors.amount = 'Amount is required.';
  else {
    amount = parseAmount(rawAmount);
    if (Number.isNaN(amount)) errors.amount = 'Amount must be a number.';
    else if (amount <= 0) errors.amount = 'Amount must be greater than 0.';
  }
  if (!currency) errors.currency = 'Currency is required.';
  else if (!CURRENCIES.includes(currency)) errors.currency = 'Currency must be one of: ' + CURRENCIES.join(', ') + '.';
  if (!dueDate) errors.dueDate = 'Due date is required.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) errors.dueDate = 'Due date must be a valid date (YYYY-MM-DD).';

  return { errors, values: { customer, invoiceNumber, amount, currency, dueDate } };
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/invoices', (req, res) => res.json(invoices.map(view)));

app.get('/api/invoices/:id', (req, res) => {
  const inv = invoices.find((i) => String(i.id) === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found.' });
  res.json(view(inv));
});

app.post('/api/invoices', (req, res) => {
  const { errors, values } = validate(req.body || {});
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Validation failed. Please fix the errors below.', errors });
  }
  const exists = invoices.some((i) => i.invoiceNumber.toLowerCase() === values.invoiceNumber.toLowerCase());
  if (exists) {
    const msg = `Invoice number ${values.invoiceNumber} already exists.`;
    return res.status(409).json({ error: msg, errors: { invoiceNumber: msg } });
  }
  const inv = { id: nextId++, ...values, createdAt: Date.now() };
  invoices.push(inv);
  save();
  res.status(201).json(view(inv));
});

app.delete('/api/invoices/:id', (req, res) => {
  const idx = invoices.findIndex((i) => String(i.id) === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Invoice not found.' });
  invoices.splice(idx, 1);
  save();
  res.json({ success: true });
});

app.post('/api/test/reset', (req, res) => {
  invoices = [];
  nextId = 1;
  save();
  res.json({ success: true });
});

load();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Invoice Simulator running on http://localhost:${PORT}`));
