const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/umdb';

app.use(cors());

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    service: 'umdb-template-backend',
    mongo: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState
    }
  });
});

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Backend running on http://0.0.0.0:${PORT}`);
  });
}

start();
