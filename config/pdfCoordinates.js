/**
 * pdfCoordinates.js — Exact coordinate map derived from templates/form.pdf
 *
 * Page: 612 x 792 pt (US Letter)
 * All coordinates: PDF origin (bottom-left)
 *
 * Methodology:
 *   - Extracted every Tm operator from the decompressed content stream
 *   - Cross-referenced text positions with label text decoded via CMap
 *   - Blank fields start immediately after the label text ends
 *   - Text is placed at y + 1.5 (to sit cleanly on the underline)
 *
 * Address Proof positions (from stream analysis):
 *   "Aadhaar" label starts at x=203.93
 *   "Voter ID" (qoter -D) label starts at x=260.93
 *   "DL" label context starts at x=316.87
 *   Checkmark goes immediately before each label
 */

'use strict';

// ─── Page Dimensions ─────────────────────────────────────────────────────────
const PAGE_W = 612;
const PAGE_H = 792;

// ─── Section Row Y-values (from Tm analysis) ─────────────────────────────────
// Customer
const Y_CUST_NAME    = 633.94;   // "Name" row
const Y_CUST_DOB     = 611.50;   // "Date of Birth" row
const Y_CUST_ADDR_ROW= 589.06;   // "Address" + proof row
const Y_CUST_ADDR1   = 566.50;   // Address line 1 underscores
const Y_CUST_ADDR2   = 544.00;   // Address line 2 underscores (y=544 from text block)
const Y_CUST_PIN     = 521.50;   // "Pin Code" row

// Guarantor
const Y_GUAR_NAME    = 470.00;
const Y_GUAR_ADDR_ROW= 447.43;
const Y_GUAR_ADDR1   = 425.00;
const Y_GUAR_ADDR2   = 402.40;
const Y_GUAR_PIN     = 380.00;

// Co-Borrower
const Y_CO_NAME      = 328.40;
const Y_CO_ADDR_ROW  = 305.93;
const Y_CO_ADDR1     = 283.37;
const Y_CO_ADDR2     = 260.93;
const Y_CO_PIN       = 238.37;

// Dealer & Finance
const Y_DEALER       = 182.06;
const Y_VEHICLE      = 128.66;
const Y_FINANCE      = 106.22;
const Y_ADVANCE      = 83.66;

// ─── Address proof checkbox x-positions (FINAL — deep analysis confirmed) ────
//
// Deep analysis (find_checkboxes.js) confirmed:
//   ✗ No rectangle/box vector graphics at y≈589
//   ✗ No drawn checkbox shapes anywhere in the PDF
//   ✓ The "checkboxes" are BLANK CID characters in the custom font
//
// Exact Tm x positions of the blank char slots (y=589.06):
//   CID 0357 at x=198.41  → Aadhaar blank (3pt wide, to x=201.41)
//   CID 0381 at x=252.41  → Voter ID blank (3.36pt wide, to x=255.77)
//   CID 0381 at x=308.35  → DL blank (3.24pt wide, to x=311.59)
//
// drawCheck() now draws a compact 4pt × 3.5pt tick starting at x,
// which fits within the blank char and is clearly visible.
const AADHAAR_CHECK_X = 198.41;   // exact Tm x of Aadhaar blank CID char
const VOTER_CHECK_X   = 252.41;   // exact Tm x of Voter ID blank CID char
const DL_CHECK_X      = 308.35;   // exact Tm x of DL blank CID char


module.exports = {

  // ─── FONT SIZES ─────────────────────────────────────────────────────────────
  defaultFontSize:  9,
  smallFontSize:    8,
  checkFontSize:    11,   // ✓ mark size

  // ─── PAGE INFO ───────────────────────────────────────────────────────────────
  pageWidth:  PAGE_W,
  pageHeight: PAGE_H,

  // ─── CUSTOMER FIELDS ─────────────────────────────────────────────────────────

  customerName: {
    x: 104.18,        // Blank line starts right after "Name:" label
    y: Y_CUST_NAME + 1,
    fontSize: 9,
    maxWidth: 185     // Up to "Phone Number" label (~x=290)
  },

  customerPhone: {
    x: 371.23,        // After "Phone Number:" label
    y: Y_CUST_NAME + 1,
    fontSize: 9,
    maxWidth: 140
  },

  // ─── DOB: three separate boxes (DD / MM / YYYY) ─────────────────────────────
  //
  // Calibrated from calibrate.js stream math (y=611.50):
  //
  //   DD blank:   x=185.25 → x=191.21 (width=5.96pt, 2 underscores)
  //               Center = 188.23, "01" at 7pt Helvetica ≈ 7.8pt
  //               Place x = 188.23 - 7.8/2 = 184.33 → x=183.23 (calibrated)
  //
  //   MM blank:   x=197.93 → x=206.81 (width=8.88pt, 2 underscores)
  //               Center = 202.37, "01" at 7pt ≈ 7.8pt
  //               Place x = 202.37 - 7.8/2 = 198.47 → x=197.37 (calibrated)
  //
  //   YYYY blank: x=218.09 → x=250.12 (width=32.03pt, 6 underscores)
  //               Center = 234.11, "2000" at 7pt ≈ 15.6pt
  //               Place x = 234.11 - 15.6/2 = 226.31 → x=224.10 (calibrated)
  //
  // Font size 7pt used for DOB (smaller than 9pt fill font)
  // so 2-digit values fit inside the narrow 5.96pt and 8.88pt blanks.

  customerDOB_DD: {
    x: 183.23,
    y: Y_CUST_DOB + 1.5,
    fontSize: 7,
    maxWidth: 10
  },

  customerDOB_MM: {
    x: 197.37,
    y: Y_CUST_DOB + 1.5,
    fontSize: 7,
    maxWidth: 10
  },

  customerDOB_YYYY: {
    x: 224.10,
    y: Y_CUST_DOB + 1.5,
    fontSize: 7,
    maxWidth: 28
  },

  // ─── Father's Name ────────────────────────────────────────────────────────────
  //
  // From calibrate.js: block at x=218.09 contains
  // "______  Father's Name Customer __________________________"
  // The label portion (30 chars × 5.34pt/char = 160.16pt) ends at:
  //   x = 218.09 + 160.16 = 378.25
  // Value blank then runs from 378.25 to 517.06 (maxWidth = 138.81pt)

  customerFatherName: {
    x: 378.25,
    y: Y_CUST_DOB + 1.5,
    fontSize: 9,
    maxWidth: 136
  },

  // Address Proof — checkmarks only (no text printed)
  customerAadhaarCheck: {
    x: AADHAAR_CHECK_X,
    y: Y_CUST_ADDR_ROW + 1,
    fontSize: 11
  },
  customerVoterCheck: {
    x: VOTER_CHECK_X,
    y: Y_CUST_ADDR_ROW + 1,
    fontSize: 11
  },
  customerDLCheck: {
    x: DL_CHECK_X,
    y: Y_CUST_ADDR_ROW + 1,
    fontSize: 11
  },

  customerAddress1: {
    x: 72.02,
    y: Y_CUST_ADDR1 + 1,
    fontSize: 9,
    maxWidth: 468
  },

  customerAddress2: {
    x: 72.02,
    y: Y_CUST_ADDR2 + 1,
    fontSize: 9,
    maxWidth: 468
  },

  customerPinCode: {
    x: 116.90,        // After "Pin Code" label
    y: Y_CUST_PIN + 1,
    fontSize: 9,
    maxWidth: 120
  },

  customerLandmark: {
    x: 336.70,        // After "Landmark" label
    y: Y_CUST_PIN + 1,
    fontSize: 9,
    maxWidth: 200
  },

  // ─── GUARANTOR FIELDS ────────────────────────────────────────────────────────

  guarantorName: {
    x: 104.18,
    y: Y_GUAR_NAME + 1,
    fontSize: 9,
    maxWidth: 185
  },

  guarantorPhone: {
    x: 371.23,
    y: Y_GUAR_NAME + 1,
    fontSize: 9,
    maxWidth: 140
  },

  guarantorAadhaarCheck: {
    x: AADHAAR_CHECK_X,
    y: Y_GUAR_ADDR_ROW + 1,
    fontSize: 11
  },
  guarantorVoterCheck: {
    x: VOTER_CHECK_X,
    y: Y_GUAR_ADDR_ROW + 1,
    fontSize: 11
  },
  guarantorDLCheck: {
    x: DL_CHECK_X,
    y: Y_GUAR_ADDR_ROW + 1,
    fontSize: 11
  },

  guarantorAddress1: {
    x: 72.02,
    y: Y_GUAR_ADDR1 + 1,
    fontSize: 9,
    maxWidth: 468
  },

  guarantorAddress2: {
    x: 72.02,
    y: Y_GUAR_ADDR2 + 1,
    fontSize: 9,
    maxWidth: 468
  },

  guarantorPinCode: {
    x: 116.90,
    y: Y_GUAR_PIN + 1,
    fontSize: 9,
    maxWidth: 120
  },

  guarantorLandmark: {
    x: 336.70,
    y: Y_GUAR_PIN + 1,
    fontSize: 9,
    maxWidth: 200
  },

  // ─── CO-BORROWER FIELDS ──────────────────────────────────────────────────────

  coBorrowerName: {
    x: 104.18,
    y: Y_CO_NAME + 1,
    fontSize: 9,
    maxWidth: 185
  },

  coBorrowerPhone: {
    x: 371.23,
    y: Y_CO_NAME + 1,
    fontSize: 9,
    maxWidth: 140
  },

  coBorrowerAadhaarCheck: {
    x: AADHAAR_CHECK_X,
    y: Y_CO_ADDR_ROW + 1,
    fontSize: 11
  },
  coBorrowerVoterCheck: {
    x: VOTER_CHECK_X,
    y: Y_CO_ADDR_ROW + 1,
    fontSize: 11
  },
  coBorrowerDLCheck: {
    x: DL_CHECK_X,
    y: Y_CO_ADDR_ROW + 1,
    fontSize: 11
  },

  coBorrowerAddress1: {
    x: 72.02,
    y: Y_CO_ADDR1 + 1,
    fontSize: 9,
    maxWidth: 468
  },

  coBorrowerAddress2: {
    x: 72.02,
    y: Y_CO_ADDR2 + 1,
    fontSize: 9,
    maxWidth: 468
  },

  coBorrowerPinCode: {
    x: 116.90,
    y: Y_CO_PIN + 1,
    fontSize: 9,
    maxWidth: 120
  },

  coBorrowerLandmark: {
    x: 336.70,
    y: Y_CO_PIN + 1,
    fontSize: 9,
    maxWidth: 200
  },

  // ─── DEALER FIELDS ───────────────────────────────────────────────────────────
  // Row y=182.06: "Dealer Name ______, Dealer City ______"
  // "Dealer Name" label ends ~x=160 (label itself is "Dealer Came" from font)
  // blank starts immediately after
  dealerName: {
    x: 164.00,        // After "Dealer Name " label
    y: Y_DEALER + 1,
    fontSize: 9,
    maxWidth: 190
  },

  dealerCity: {
    // "Dealer City" label (second part of row): 
    // From raw: full row starts at x=72; "Dealer City" portion ~x=384 from analysis
    // text block says "Dealer Came ________________________, Dealer City ___________"
    // city blank starts after ", Dealer City " which ends ~x=447
    x: 454.00,
    y: Y_DEALER + 1,
    fontSize: 9,
    maxWidth: 72
  },

  // ─── VEHICLE FIELDS ──────────────────────────────────────────────────────────
  // Row y=128.66: "Brand ___ Model ___ Price ___"
  vehicleBrand: {
    x: 103.94,        // After "Brand" label
    y: Y_VEHICLE + 1,
    fontSize: 9,
    maxWidth: 100
  },

  vehicleModel: {
    x: 244.97,        // After "Model" label
    y: Y_VEHICLE + 1,
    fontSize: 9,
    maxWidth: 132
  },

  vehiclePrice: {
    x: 412.03,        // After "Price" label
    y: Y_VEHICLE + 1,
    fontSize: 9,
    maxWidth: 105
  },

  // ─── FINANCE FIELDS ──────────────────────────────────────────────────────────
  // Row y=106.22: "Loan Amount ___ DP ___ EMI ___ Tenure ___"
  loanAmount: {
    x: 137.54,        // After "Loan Amount" label
    y: Y_FINANCE + 1,
    fontSize: 9,
    maxWidth: 72
  },

  downPayment: {
    // DP: "DP" label at x=216.77, blank at x=234
    x: 234.65,
    y: Y_FINANCE + 1,
    fontSize: 9,
    maxWidth: 68
  },

  emi: {
    // EMI: "EMI" label at x=308.35, blank at x=331
    x: 331.27,
    y: Y_FINANCE + 1,
    fontSize: 9,
    maxWidth: 80
  },

  tenure: {
    // Tenure: label at x=415.99, blank at x=453
    x: 453.70,
    y: Y_FINANCE + 1,
    fontSize: 9,
    maxWidth: 60
  },

  // ─── ADVANCE FIELDS ──────────────────────────────────────────────────────────
  // Row y=83.66: "High DU scheme only  Advance Interest ______  Advance EMI ______"
  advanceInterest: {
    x: 251.93,        // After "Advance Interest" label
    y: Y_ADVANCE + 1,
    fontSize: 9,
    maxWidth: 155
  },

  advanceEMI: {
    x: 414.07,        // After "Advance EMI" label
    y: Y_ADVANCE + 1,
    fontSize: 9,
    maxWidth: 112
  },

};
