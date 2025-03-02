const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const { v4: uuidv4, validate: uuidValidate } = require('uuid');

const app = express();
app.use(bodyParser.json());

// Initialize SQLite database (stored in db.sqlite)
const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables if they do not exist and seed a fake quote
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    symbol TEXT,
    offer REAL,
    bid REAL,
    last REAL,
    timestamp TEXT,
    lowPrice REAL,
    highPrice REAL,
    openPrice REAL,
    closePrice REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    amount REAL,
    currency TEXT,
    quoteId TEXT,
    side TEXT,
    valuta INTEGER,
    createdAt TEXT
  )`);

  // Insert a sample quote if it doesn't exist
  db.get(`SELECT * FROM quotes WHERE id = ?`, ['f4a1fc00-545d-498b-bc3c-da404b89b584'], (err, row) => {
    if (err) {
      console.error(err.message);
    }
    if (!row) {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO quotes (id, symbol, offer, bid, last, timestamp, lowPrice, highPrice, openPrice, closePrice)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'f4a1fc00-545d-498b-bc3c-da404b89b584',
          'USD',
          150.50,
          149.50,
          150.00,
          now,
          148.00,
          151.00,
          149.00,
          150.50
        ]
      );
    }
  });
});

// GET /v1/quote - returns the latest quote
app.get('/v1/quote', (req, res) => {
  db.get(`SELECT * FROM quotes ORDER BY timestamp DESC LIMIT 1`, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'No quotes available' });
    }
    res.json(row);
  });
});

// Simple middleware for API key authentication
function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const apiSecret = req.headers['x-api-secret'];
  if (!apiKey || !apiSecret) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  // In a real application, validate the tokens here.
  next();
}

// PUT /v1/order/:id - creates an order using a provided UUID (v4)
app.put('/v1/order/:id', authenticate, (req, res) => {
  const orderId = req.params.id;
  if (!uuidValidate(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID. Must be a UUID v4.' });
  }

  const { amount, currency, quoteId, side, valuta } = req.body;

  // Check for missing parameters
  if (
    amount === undefined ||
    !currency ||
    !quoteId ||
    !side ||
    (valuta === undefined)
  ) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Validate that the quote exists
  db.get(`SELECT * FROM quotes WHERE id = ?`, [quoteId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(400).json({ error: 'Quote not found or expired' });
    }

    const createdAt = new Date().toISOString();
    db.run(
      `INSERT INTO orders (id, amount, currency, quoteId, side, valuta, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, amount, currency, quoteId, side, valuta, createdAt],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        return res.status(201).json({ message: 'Order created successfully' });
      }
    );
  });
});

// Start the server
const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`Fake API server running on port ${PORT}`);
});
