/**
 * pdfService.js — Production PDF generator for E-Rikshaw Finance Application
 *
 * Features:
 *  1. Fills exact coordinates on templates/form.pdf using remeasured positions
 *  2. Address Proof → draws ✓ checkmark inside the correct box (no text)
 *  3. DOB is split DD / MM / YYYY to fit the printed format
 *  4. Address is split across two available lines
 *  5. Battery Details → appended as a clean second page (not on main form)
 *  6. Uploaded documents → each appended as a full A4 page after the form
 *     (images scaled proportionally, PDFs merged page-by-page)
 */

'use strict';

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs   = require('fs');
const path = require('path');

const COORDS   = require('../config/pdfCoordinates');
const TEMPLATE = path.join(__dirname, '../templates/form.pdf');

// ─── Colour ───────────────────────────────────────────────────────────────────
const INK = rgb(0, 0, 0);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Truncate text so it fits within maxWidth using the given font and fontSize.
 */
function fitText(text, font, fontSize, maxWidth) {
  if (!text) return '';
  let t = text;
  while (t.length > 0 && font.widthOfTextAtSize(t, fontSize) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t;
}

/**
 * Draw text at exact PDF coordinates.
 */
function drawText(page, font, text, coords) {
  if (!text || !text.trim()) return;
  const { x, y, fontSize = 9, maxWidth } = coords;
  const finalText = maxWidth ? fitText(String(text), font, fontSize, maxWidth) : String(text);
  if (!finalText.trim()) return;
  page.drawText(finalText, {
    x, y,
    size: fontSize,
    font,
    color: INK
  });
}

/**
 * Draw a compact vector checkmark (✓) centered on the blank character slot.
 *
 * Analysis confirmed NO actual rectangle/box graphics exist in the PDF.
 * The "checkboxes" are blank CID font characters (~3pt wide) before each label.
 *
 * Strategy: draw a small but clear tick (4pt wide × 3.5pt tall) starting
 * exactly at x (left edge of the blank char slot). This overprints the blank
 * and makes the selection clearly visible without touching adjacent text.
 *
 * Tick geometry:  left-down stroke + right-up stroke forming ✓
 *   Point A: (x+0.5, y+2.5)   — top of left arm
 *   Point B: (x+1.8, y+0.5)   — bottom of tick
 *   Point C: (x+4.0, y+4.5)   — top of right arm
 *
 * @param {object} page - pdf-lib PDFPage
 * @param {number} x    - x of blank char slot (Tm x position)
 * @param {number} y    - y baseline of the row
 */
function drawCheck(page, x, y) {
  const A = { x: x + 0.5,  y: y + 2.5 };
  const B = { x: x + 1.8,  y: y + 0.5 };
  const C = { x: x + 4.0,  y: y + 4.5 };

  page.drawLine({ start: A, end: B, thickness: 1.0, color: INK });
  page.drawLine({ start: B, end: C, thickness: 1.0, color: INK });
}

/**
 * Resolve address-proof checkmark for a row.
 * @param {string} proof - 'Aadhaar' | 'Voter ID' | 'DL' | 'Driving License'
 * @returns {{ aadhaar, voter, dl }} booleans
 */
function resolveAddressProof(proof) {
  if (!proof) return { aadhaar: false, voter: false, dl: false };
  const p = proof.toLowerCase();
  return {
    aadhaar: p.includes('aadhaar') || p.includes('aadhar'),
    voter:   p.includes('voter'),
    dl:      p.includes('dl') || p.includes('driving') || p.includes('license')
  };
}

/**
 * Split address into two lines respecting maxWidth.
 */
function splitAddress(address, font, fontSize, maxWidth) {
  if (!address) return ['', ''];
  const words = address.trim().split(' ');
  let line1 = '', line2 = '';
  for (const word of words) {
    const test = line1 ? line1 + ' ' + word : word;
    if (line1 === '' || font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      line1 = test;
    } else {
      line2 = line2 ? line2 + ' ' + word : word;
    }
  }
  return [line1, fitText(line2, font, fontSize, maxWidth)];
}

/**
 * Parse date string (YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY)
 * Returns { dd, mm, yyyy }
 */
function parseDate(dob) {
  if (!dob) return { dd: '', mm: '', yyyy: '' };
  let dd = '', mm = '', yyyy = '';
  if (dob.includes('-')) {
    const p = dob.split('-');
    if (p[0].length === 4) { yyyy = p[0]; mm = p[1]; dd = p[2]; }
    else                   { dd = p[0]; mm = p[1]; yyyy = p[2]; }
  } else if (dob.includes('/')) {
    const p = dob.split('/');
    if (p[0].length === 4) { yyyy = p[0]; mm = p[1]; dd = p[2]; }
    else                   { dd = p[0]; mm = p[1]; yyyy = p[2]; }
  } else {
    yyyy = dob;
  }
  return { dd: (dd||'').padStart(2,'0'), mm: (mm||'').padStart(2,'0'), yyyy };
}

/**
 * Create a battery-details page from scratch (second page).
 */
async function createBatteryPage(pdfDoc, font, boldFont, data) {
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const margin = 72;
  let y = height - margin;

  // Title
  page.drawText('Battery Details', {
    x: margin, y,
    size: 14, font: boldFont, color: INK
  });
  y -= 30;

  // Draw a simple table
  const fields = [
    ['Battery Type',          data.batteryType   || '—'],
    ['Battery Voltage',       data.batteryVoltage || '—'],
    ['Battery Brand',         data.batteryBrand   || '—'],
    ['Battery Serial Number', data.batterySerial  || '—'],
  ];

  for (const [label, value] of fields) {
    page.drawText(`${label}:`, { x: margin, y, size: 10, font: boldFont, color: INK });
    page.drawText(value,       { x: margin + 160, y, size: 10, font, color: INK });
    y -= 22;
  }

  return page;
}

/**
 * Load image bytes and embed them in a PDF page (full A4, proportionally scaled).
 */
async function embedImagePage(pdfDoc, imageBytes, mimeType) {
  let image;
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('png')) {
    image = await pdfDoc.embedPng(imageBytes);
  } else {
    image = await pdfDoc.embedJpg(imageBytes);
  }

  const pageW = 595, pageH = 842; // A4
  const page = pdfDoc.addPage([pageW, pageH]);
  const margin = 36;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;

  const imgW = image.width, imgH = image.height;
  const scaleX = availW / imgW, scaleY = availH / imgH;
  const scale  = Math.min(scaleX, scaleY, 1); // never upscale

  const drawW = imgW * scale, drawH = imgH * scale;
  const drawX = margin + (availW - drawW) / 2;
  const drawY = margin + (availH - drawH) / 2;

  page.drawImage(image, { x: drawX, y: drawY, width: drawW, height: drawH });
}

/**
 * Append an uploaded file (image or PDF) to the target PDF document.
 */
async function appendDocument(targetDoc, filePath, mimeType) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const bytes = fs.readFileSync(filePath);
  const mime  = (mimeType || path.extname(filePath).toLowerCase()).toLowerCase();

  if (mime.includes('pdf') || mime === '.pdf') {
    // Merge all pages from the uploaded PDF
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageIdxs = srcDoc.getPageIndices();
    const copiedPages = await targetDoc.copyPages(srcDoc, pageIdxs);
    copiedPages.forEach(p => targetDoc.addPage(p));
  } else {
    // Image (jpg/jpeg/png)
    await embedImagePage(targetDoc, bytes, mime);
  }
}

// ─── Document field name → logical key mapping ───────────────────────────────
// Maps the multipart field names (as sent by the browser) to logical doc keys.
// Used to iterate in document order when appending pages to the PDF.
const DOC_ORDER = [
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

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * generatePDF(data, reqFiles) → { buffer, filename }
 *
 * @param {object} data     - Form data from the current HTTP request
 * @param {object} reqFiles - req.files from multer (THIS request only, never cached)
 *                            Format: { 'customer/aadhaar-front': [{ path, mimetype }], ... }
 * @returns {Promise<{buffer: Buffer, filename: string}>}
 */
async function generatePDF(data, reqFiles = {}) {
  // Load template
  const templateBytes = fs.readFileSync(TEMPLATE);
  const pdfDoc = await PDFDocument.load(templateBytes);

  // Embed fonts (Helvetica supports most ASCII characters)
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const [page] = pdfDoc.getPages();
  const { width, height } = page.getSize();
  console.log(`Template page: ${width} x ${height} pt`);

  // ── CUSTOMER ──────────────────────────────────────────────────────────────
  drawText(page, font, data.customerName,       COORDS.customerName);
  drawText(page, font, data.customerPhone,      COORDS.customerPhone);

  // DOB: split into DD / MM / YYYY — each goes in its own printed box
  const dob = parseDate(data.customerDOB);
  if (dob.dd)   drawText(page, font, dob.dd,   COORDS.customerDOB_DD);
  if (dob.mm)   drawText(page, font, dob.mm,   COORDS.customerDOB_MM);
  if (dob.yyyy) drawText(page, font, dob.yyyy, COORDS.customerDOB_YYYY);

  drawText(page, font, data.customerFatherName, COORDS.customerFatherName);

  // Address Proof — checkmarks only
  const custProof = resolveAddressProof(data.customerAddressProof);
  if (custProof.aadhaar) drawCheck(page, COORDS.customerAadhaarCheck.x, COORDS.customerAadhaarCheck.y);
  if (custProof.voter)   drawCheck(page, COORDS.customerVoterCheck.x,   COORDS.customerVoterCheck.y);
  if (custProof.dl)      drawCheck(page, COORDS.customerDLCheck.x,      COORDS.customerDLCheck.y);

  // Address — split across two lines
  const [custAddr1, custAddr2] = splitAddress(data.customerAddress, font, 9, COORDS.customerAddress1.maxWidth);
  drawText(page, font, custAddr1, COORDS.customerAddress1);
  if (custAddr2) drawText(page, font, custAddr2, COORDS.customerAddress2);

  drawText(page, font, data.customerPinCode,  COORDS.customerPinCode);
  drawText(page, font, data.customerLandmark, COORDS.customerLandmark);

  // ── GUARANTOR ─────────────────────────────────────────────────────────────
  if (data.guarantorName || data.guarantorPhone) {
    drawText(page, font, data.guarantorName,  COORDS.guarantorName);
    drawText(page, font, data.guarantorPhone, COORDS.guarantorPhone);

    const guarProof = resolveAddressProof(data.guarantorAddressProof);
    if (guarProof.aadhaar) drawCheck(page, COORDS.guarantorAadhaarCheck.x, COORDS.guarantorAadhaarCheck.y);
    if (guarProof.voter)   drawCheck(page, COORDS.guarantorVoterCheck.x,   COORDS.guarantorVoterCheck.y);
    if (guarProof.dl)      drawCheck(page, COORDS.guarantorDLCheck.x,      COORDS.guarantorDLCheck.y);

    const [guarAddr1, guarAddr2] = splitAddress(data.guarantorAddress, font, 9, COORDS.guarantorAddress1.maxWidth);
    drawText(page, font, guarAddr1, COORDS.guarantorAddress1);
    if (guarAddr2) drawText(page, font, guarAddr2, COORDS.guarantorAddress2);

    drawText(page, font, data.guarantorPinCode,  COORDS.guarantorPinCode);
    drawText(page, font, data.guarantorLandmark, COORDS.guarantorLandmark);
  }

  // ── CO-BORROWER ───────────────────────────────────────────────────────────
  if (data.coBorrowerName || data.coBorrowerPhone) {
    drawText(page, font, data.coBorrowerName,  COORDS.coBorrowerName);
    drawText(page, font, data.coBorrowerPhone, COORDS.coBorrowerPhone);

    const coProof = resolveAddressProof(data.coBorrowerAddressProof);
    if (coProof.aadhaar) drawCheck(page, COORDS.coBorrowerAadhaarCheck.x, COORDS.coBorrowerAadhaarCheck.y);
    if (coProof.voter)   drawCheck(page, COORDS.coBorrowerVoterCheck.x,   COORDS.coBorrowerVoterCheck.y);
    if (coProof.dl)      drawCheck(page, COORDS.coBorrowerDLCheck.x,      COORDS.coBorrowerDLCheck.y);

    const [coAddr1, coAddr2] = splitAddress(data.coBorrowerAddress, font, 9, COORDS.coBorrowerAddress1.maxWidth);
    drawText(page, font, coAddr1, COORDS.coBorrowerAddress1);
    if (coAddr2) drawText(page, font, coAddr2, COORDS.coBorrowerAddress2);

    drawText(page, font, data.coBorrowerPinCode,  COORDS.coBorrowerPinCode);
    drawText(page, font, data.coBorrowerLandmark, COORDS.coBorrowerLandmark);
  }

  // ── DEALER ────────────────────────────────────────────────────────────────
  drawText(page, font, data.dealerName, COORDS.dealerName);
  drawText(page, font, data.dealerCity, COORDS.dealerCity);

  // ── VEHICLE ───────────────────────────────────────────────────────────────
  drawText(page, font, data.vehicleBrand, COORDS.vehicleBrand);
  drawText(page, font, data.vehicleModel, COORDS.vehicleModel);
  if (data.vehiclePrice) drawText(page, font, `${data.vehiclePrice}`, COORDS.vehiclePrice);

  // ── FINANCE ───────────────────────────────────────────────────────────────
  if (data.loanAmount)   drawText(page, font, `${data.loanAmount}`,   COORDS.loanAmount);
  if (data.downPayment)  drawText(page, font, `${data.downPayment}`,  COORDS.downPayment);
  if (data.emi)          drawText(page, font, `${data.emi}`,          COORDS.emi);
  if (data.tenure)       drawText(page, font, `${data.tenure}`,       COORDS.tenure);
  if (data.advanceInterest) drawText(page, font, `${data.advanceInterest}`, COORDS.advanceInterest);
  if (data.advanceEMI)      drawText(page, font, `${data.advanceEMI}`,      COORDS.advanceEMI);

  // ── BATTERY DETAILS → separate page ──────────────────────────────────────
  const hasBattery = data.batteryType || data.batteryVoltage || data.batteryBrand || data.batterySerial;
  if (hasBattery) {
    await createBatteryPage(pdfDoc, font, boldFont, data);
  }

  // ── UPLOADED DOCUMENTS → append pages in order ───────────────────────────
  // ISOLATION: Only files from THIS request (reqFiles) are used.
  // Never scan uploads/ directory. Never reuse previous request files.
  for (const fieldName of DOC_ORDER) {
    const fileArr = reqFiles[fieldName];
    if (fileArr && fileArr[0] && fileArr[0].path) {
      const f = fileArr[0];
      console.log(`  [Doc] Appending: ${fieldName} → ${path.basename(f.path)}`);
      await appendDocument(pdfDoc, f.path, f.mimetype);
    }
  }

  // ── Finalise ──────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const buffer   = Buffer.from(pdfBytes);

  // Build output filename
  const safeName = (data.customerName || 'Customer').replace(/\s+/g, '');
  const today    = new Date();
  const dd = String(today.getDate()).padStart(2,'0');
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const yyyy = today.getFullYear();
  const filename = `${safeName}_${dd}-${mm}-${yyyy}.pdf`;

  console.log(`PDF generated: ${filename} (${buffer.length} bytes, ${pdfDoc.getPageCount()} pages)`);
  return { buffer, filename };
}

module.exports = { generatePDF };
