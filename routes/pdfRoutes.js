/**
 * pdfRoutes.js — PDF generation endpoint
 *
 * SECURITY FIX: All form fields AND uploaded files are sent together in ONE
 * multipart/form-data request. Files are stored in a unique per-request
 * temporary directory (os.tmpdir()/erikshaw/<uuid>/) and DELETED after the
 * PDF is generated and sent — regardless of success or failure (try/finally).
 *
 * This guarantees complete data isolation between concurrent users.
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const crypto   = require('crypto');
const { generatePDF } = require('../services/pdfService');

// ─── Allowed file types ───────────────────────────────────────────────────────
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_EXT  = ['.jpg', '.jpeg', '.png', '.pdf'];
const MAX_SIZE_MB  = 10;

// ─── Valid upload field names ─────────────────────────────────────────────────
const VALID_FIELDS = [
  'customer/aadhaar-front',
  'customer/aadhaar-back',
  'customer/pan',
  'guarantor/aadhaar-front',
  'guarantor/aadhaar-back',
  'guarantor/pan',
  'co-borrower/aadhaar-front',
  'co-borrower/aadhaar-back',
  'co-borrower/pan'
];

// ─── Multer: per-request isolated temp directory ──────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create a unique temp dir ONCE per request
    if (!req._tempDir) {
      const reqId  = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      req._tempDir = path.join(os.tmpdir(), 'erikshaw', reqId);
      fs.mkdirSync(req._tempDir, { recursive: true });
    }
    cb(null, req._tempDir);
  },
  filename: (req, file, cb) => {
    // Use fieldname as filename to make lookup easy
    const safeName = file.fieldname.replace(/\//g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const ext      = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${safeName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME.includes(file.mimetype) || ALLOWED_EXT.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.originalname}. Only JPG, PNG and PDF are accepted.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
    files: 9
  }
});

const uploadFields = VALID_FIELDS.map(f => ({ name: f, maxCount: 1 }));

// ─── Helper: recursively delete a directory ───────────────────────────────────
function deleteTempDir(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (e) {
    console.warn('[Cleanup] Could not delete temp dir:', dirPath, e.message);
  }
}

// ─── POST /api/generate-pdf ───────────────────────────────────────────────────
router.post('/generate-pdf', (req, res) => {
  // Run multer first to parse the multipart form
  upload.fields(uploadFields)(req, res, async (multerErr) => {
    if (multerErr instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: multerErr.code === 'LIMIT_FILE_SIZE'
          ? `File too large. Maximum size is ${MAX_SIZE_MB} MB.`
          : `Upload error: ${multerErr.message}`
      });
    }
    if (multerErr) {
      return res.status(400).json({ success: false, error: multerErr.message });
    }

    const tempDir = req._tempDir || null;

    try {
      const formData = req.body;

      // Basic server-side validation
      const errors = validateFormData(formData);
      if (errors.length > 0) {
        return res.status(400).json({ success: false, errors });
      }

      console.log(`[PDF] Generating for: ${formData.customerName} | tempDir: ${tempDir}`);

      // req.files is ONLY the files from THIS request — no global state
      const reqFiles = req.files || {};

      // Log which docs were uploaded in this request
      Object.entries(reqFiles).forEach(([field, arr]) => {
        if (arr && arr[0]) console.log(`  [Doc] Received: ${field} → ${arr[0].originalname}`);
      });

      // Generate PDF using only this request's files
      const { buffer, filename } = await generatePDF(formData, reqFiles);

      console.log(`[PDF] Generated: ${filename} (${buffer.length} bytes)`);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('X-Filename', filename);
      res.send(buffer);

    } catch (err) {
      console.error('[PDF] Generation error:', err);
      res.status(500).json({
        success: false,
        error: 'PDF generation failed. Please try again.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    } finally {
      // ALWAYS delete the temp dir — even on error
      if (tempDir) {
        deleteTempDir(tempDir);
        console.log(`[Cleanup] Deleted temp dir: ${tempDir}`);
      }
    }
  });
});

// ─── Server-side form validation ──────────────────────────────────────────────
function validateFormData(data) {
  const errors = [];
  if (!data.customerName  || !data.customerName.trim())                      errors.push('Customer Name is required');
  if (!data.customerPhone || !/^\d{10}$/.test(data.customerPhone.trim()))    errors.push('Customer Phone must be 10 digits');
  if (!data.customerDOB)                                                      errors.push('Customer Date of Birth is required');
  if (!data.customerPinCode || !/^\d{6}$/.test(data.customerPinCode.trim())) errors.push('Customer Pin Code must be 6 digits');
  if (data.loanAmount   && isNaN(Number(data.loanAmount)))   errors.push('Loan Amount must be numeric');
  if (data.vehiclePrice && isNaN(Number(data.vehiclePrice))) errors.push('Vehicle Price must be numeric');
  if (data.emi          && isNaN(Number(data.emi)))          errors.push('EMI must be numeric');
  if (data.tenure       && isNaN(Number(data.tenure)))       errors.push('Tenure must be numeric');
  if (!data.batteryVoltage)                                  errors.push('Battery Voltage is required');
  return errors;
}

module.exports = router;
