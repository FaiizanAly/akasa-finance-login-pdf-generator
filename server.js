/**
 * server.js - Main Express server for E-Rikshaw Finance PDF Application
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const pdfRoutes    = require('./routes/pdfRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api', pdfRoutes);
app.use('/api', uploadRoutes);

// Serve uploaded documents (static, for admin review if needed)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve index.html for all other routes (SPA support)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error Handler ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     E-RIKSHAW FINANCE PDF GENERATOR - RUNNING        ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Server: http://localhost:${PORT}                      ║`);
  console.log(`║  API:    http://localhost:${PORT}/api/generate-pdf     ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
