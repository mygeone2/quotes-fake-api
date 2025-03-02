const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const { v4: uuidv4, validate: uuidValidate } = require('uuid');

const app = express();
app.use(bodyParser.json());

// Global counter for GET /v1/quote responses.
let quoteCounter = 1;

// Initialize SQLite database (stored in db.sqlite)
const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables if they do not exist.
// The quotes table now uses a sequential INTEGER primary key.
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    quoteId INTEGER,
    side TEXT,
    valuta INTEGER,
    createdAt TEXT
  )`);

  // Insert a sample quote if no quote exists
  db.get(`SELECT * FROM quotes LIMIT 1`, (err, row) => {
    if (err) {
      console.error(err.message);
    }
    if (!row) {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO quotes (symbol, offer, bid, last, timestamp, lowPrice, highPrice, openPrice, closePrice)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'USD',
          150.50,
          149.50,
          150.00,
          now,
          148.00,
          151.00,
          149.00,
          150.50
        ],
        function(err) {
          if (err) {
            console.error('Error inserting sample quote:', err.message);
          } else {
            console.log('Sample quote inserted with id:', this.lastID);
          }
        }
      );
    }
  });
});

// Helper function: returns either -1 or +1 randomly.
function randomOffset() {
  return Math.random() < 0.5 ? -1 : 1;
}

// GET /v1/quote - returns the latest quote with random modifications (+/-1) on currency values.
// Overrides the quote id with an in-memory sequential counter.
app.get('/v1/quote', (req, res) => {
  db.get(`SELECT * FROM quotes ORDER BY timestamp DESC LIMIT 1`, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'No quotes available' });
    }
    // Create a modified quote with random offsets.
    const modifiedQuote = {
      ...row,
      offer: Number(row.offer) + randomOffset(),
      bid: Number(row.bid) + randomOffset(),
      last: Number(row.last) + randomOffset(),
      lowPrice: Number(row.lowPrice) + randomOffset(),
      highPrice: Number(row.highPrice) + randomOffset(),
      openPrice: Number(row.openPrice) + randomOffset(),
      closePrice: Number(row.closePrice) + randomOffset(),
      // Overwrite the id with our sequential counter.
      id: quoteCounter
    };

    // Increment the counter for the next call.
    quoteCounter++;

    res.json(modifiedQuote);
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

// PUT /v1/order/:id - creates an order using a provided UUID (v4) for the order id.
// The quoteId is a sequential integer referencing the quote.
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

// Start the server on port 8001
const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`Fake API server running on port ${PORT}`);
});
