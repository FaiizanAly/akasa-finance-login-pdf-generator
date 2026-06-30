/**
 * uploadRoutes.js — Document upload API endpoint
 *
 * POST /api/upload-documents
 * Accepts multipart/form-data with document files.
 * Stores files in organized folder structure under /uploads/
 *
 * Folder structure:
 *   uploads/
 *   ├── customer/
 *   │   ├── aadhaar-front/
 *   │   ├── aadhaar-back/
 *   │   └── pan/
 *   ├── guarantor/
 *   │   ├── aadhaar-front/
 *   │   ├── aadhaar-back/
 *   │   └── pan/
 *   └── co-borrower/
 *       ├── aadhaar-front/
 *       ├── aadhaar-back/
 *       └── pan/
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

// ─── Allowed file types ───────────────────────────────────────────────────────
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_EXT  = ['.jpg', '.jpeg', '.png', '.pdf'];
const MAX_SIZE_MB  = 10;

// ─── Valid upload field keys (matching frontend fileKeyMap) ───────────────────
const VALID_FIELD_PATHS = [
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

// ─── Base upload directory ────────────────────────────────────────────────────
const BASE_UPLOAD_DIR = path.join(__dirname, '../uploads');

/**
 * Ensure all required upload subdirectories exist.
 */
function ensureUploadDirs() {
  VALID_FIELD_PATHS.forEach(p => {
    const dir = path.join(BASE_UPLOAD_DIR, p);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}
ensureUploadDirs();

// ─── Multer storage — custom destination + unique filename ────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // fieldname is the path key like "customer/aadhaar-front"
    const fieldPath = file.fieldname;

    // Security: only allow known field paths (prevent path traversal)
    if (!VALID_FIELD_PATHS.includes(fieldPath)) {
      return cb(new Error(`Invalid field name: ${fieldPath}`));
    }

    const dir = path.join(BASE_UPLOAD_DIR, fieldPath);
    ensureUploadDirs(); // ensure exists
    cb(null, dir);
  },

  filename: (req, file, cb) => {
    // Generate: CustomerName_timestamp_randomhex.ext
    const ext         = path.extname(file.originalname).toLowerCase() || '.bin';
    const safeName    = (req.body.customerName || 'doc')
                          .replace(/[^a-zA-Z0-9]/g, '')
                          .substring(0, 20);
    const timestamp   = Date.now();
    const randomBytes = crypto.randomBytes(4).toString('hex');
    cb(null, `${safeName}_${timestamp}_${randomBytes}${ext}`);
  }
});

// ─── File filter ──────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const ext  = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (ALLOWED_MIME.includes(mime) || ALLOWED_EXT.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.originalname}. Only JPG, PNG and PDF are accepted.`), false);
  }
};

// ─── Multer instance ──────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  MAX_SIZE_MB * 1024 * 1024, // 10 MB per file
    files:     9                           // max 9 files total (3 per person × 3)
  }
});

// Accept all valid field names dynamically
const uploadFields = VALID_FIELD_PATHS.map(p => ({ name: p, maxCount: 1 }));

// ─── POST /api/upload-documents ───────────────────────────────────────────────
router.post('/upload-documents', (req, res) => {
  upload.fields(uploadFields)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: `File too large. Maximum size is ${MAX_SIZE_MB} MB.` });
      }
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Build summary of saved files
    const savedFiles = [];
    const files = req.files || {};

    Object.entries(files).forEach(([fieldname, fileArr]) => {
      fileArr.forEach(f => {
        savedFiles.push({
          field:    fieldname,
          filename: f.filename,
          path:     f.path,
          size:     f.size,
          mimetype: f.mimetype
        });
        console.log(`  [Upload] Saved: ${fieldname}/${f.filename} (${(f.size/1024).toFixed(1)} KB)`);
      });
    });

    if (savedFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'No files were uploaded.' });
    }

    console.log(`[Upload] Total files saved: ${savedFiles.length} for "${req.body.customerName || 'unknown'}"`);

    res.json({
      success: true,
      message: `${savedFiles.length} document(s) uploaded successfully.`,
      savedFiles: savedFiles.map(f => ({
        field:    f.field,
        filename: f.filename,
        size:     f.size
      }))
    });
  });
});

module.exports = router;
