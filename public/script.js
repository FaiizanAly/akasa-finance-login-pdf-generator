/**
 * script.js — E-Rikshaw Finance PDF Generator Frontend Logic
 * Handles form validation, API submission, progress tracking, and download
 */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let lastPdfBlob = null;
let lastFilename = 'ERikshaw_Finance.pdf';

// ─── DOM References ───────────────────────────────────────────────────────────
const form           = document.getElementById('financeForm');
const generateBtn    = document.getElementById('generateBtn');
const spinner        = document.getElementById('spinner');
const btnText        = document.getElementById('btnText');
const resetBtn       = document.getElementById('resetBtn');
const successOverlay = document.getElementById('successOverlay');
const successMsg     = document.getElementById('successMsg');
const downloadAgain  = document.getElementById('downloadAgainBtn');
const printBtn       = document.getElementById('printBtn');
const newFormBtn     = document.getElementById('newFormBtn');
const toast          = document.getElementById('toast');
const toastMsg       = document.getElementById('toastMsg');
const toastIcon      = document.getElementById('toastIcon');

// Step indicators
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

// ─── Validation Rules ─────────────────────────────────────────────────────────
const VALIDATION_RULES = [
  // ── Customer (already required) ────────────────────────────────────────────
  {
    field: 'customerName',
    test: v => v && v.trim().length >= 2,
    msg: 'Customer Name is required (min 2 characters)'
  },
  {
    field: 'customerPhone',
    test: v => /^\d{10}$/.test((v || '').trim()),
    msg: 'Phone number must be exactly 10 digits'
  },
  {
    field: 'customerDOB',
    test: v => !!v,
    msg: 'Date of Birth is required'
  },
  {
    field: 'customerPinCode',
    test: v => /^\d{6}$/.test((v || '').trim()),
    msg: 'Pin code must be exactly 6 digits'
  },

  // ── Dealer Details (now required) ─────────────────────────────────────────
  {
    field: 'dealerName',
    test: v => v && v.trim().length > 0,
    msg: 'Dealer Name is required'
  },
  {
    field: 'dealerCity',
    test: v => v && v.trim().length > 0,
    msg: 'Dealer City is required'
  },

  // ── Vehicle Details (now required) ────────────────────────────────────────
  {
    field: 'vehicleBrand',
    test: v => v && v.trim().length > 0,
    msg: 'Vehicle Brand is required'
  },
  {
    field: 'vehicleModel',
    test: v => v && v.trim().length > 0,
    msg: 'Vehicle Model is required'
  },
  {
    field: 'vehiclePrice',
    test: v => v && !isNaN(Number(v)) && Number(v) > 0,
    msg: 'Vehicle Price is required'
  },

  // ── Finance Details (now required) ────────────────────────────────────────
  {
    field: 'loanAmount',
    test: v => v && !isNaN(Number(v)) && Number(v) > 0,
    msg: 'Loan Amount is required'
  },
  {
    field: 'downPayment',
    test: v => v !== undefined && v !== null && v !== '' && !isNaN(Number(v)) && Number(v) >= 0,
    msg: 'Down Payment (DP) is required'
  },
  {
    field: 'tenure',
    test: v => v && !isNaN(Number(v)) && Number(v) >= 1 && Number(v) <= 84,
    msg: 'Tenure is required (1–84 months)'
  },

  // ── Optional numeric validations (only if value entered) ──────────────────
  {
    field: 'emi',
    test: v => !v || (!isNaN(Number(v)) && Number(v) >= 0),
    msg: 'EMI must be a valid number'
  },
  {
    field: 'batteryVoltage',
    test: v => !!v,
    msg: 'Battery Voltage is required'
  }
];


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Show or hide a field error
 */
function setFieldError(fieldId, message) {
  const errEl = document.getElementById(`err-${fieldId}`);
  const groupEl = document.getElementById(`fg-${fieldId}`);
  if (!errEl) return;

  if (message) {
    errEl.textContent = `⚠ ${message}`;
    errEl.classList.add('visible');
    if (groupEl) groupEl.classList.add('has-error');
  } else {
    errEl.textContent = '';
    errEl.classList.remove('visible');
    if (groupEl) groupEl.classList.remove('has-error');
  }
}

/**
 * Clear all field errors
 */
function clearAllErrors() {
  VALIDATION_RULES.forEach(rule => setFieldError(rule.field, null));
}

/**
 * Run all validations; returns true if form is valid
 */
function validateForm(data) {
  let valid = true;
  clearAllErrors();

  for (const rule of VALIDATION_RULES) {
    const value = data[rule.field];
    if (!rule.test(value)) {
      setFieldError(rule.field, rule.msg);
      valid = false;
    }
  }

  return valid;
}

/**
 * Collect all form data into a plain object
 */
function collectFormData() {
  const data = {};

  // Text/date inputs
  const inputs = form.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"], input[type="date"], textarea, select');
  inputs.forEach(el => {
    if (el.name) data[el.name] = el.value.trim();
  });

  // Radio buttons
  const radioGroups = ['customerAddressProof', 'guarantorAddressProof', 'coBorrowerAddressProof', 'batteryType'];
  radioGroups.forEach(name => {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    data[name] = checked ? checked.value : '';
  });

  return data;
}

/**
 * Show a toast notification
 */
let toastTimeout;
function showToast(message, type = 'success') {
  clearTimeout(toastTimeout);
  toastMsg.textContent = message;
  toastIcon.textContent = type === 'error' ? '✕' : '✓';
  toast.className = `toast visible ${type}`;

  toastTimeout = setTimeout(() => {
    toast.className = 'toast';
  }, 4000);
}

/**
 * Set button loading state
 */
function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  if (isLoading) {
    generateBtn.classList.add('loading');
    btnText.textContent = 'Generating PDF...';
  } else {
    generateBtn.classList.remove('loading');
    btnText.textContent = 'Generate PDF';
  }
}

/**
 * Update progress step indicators
 */
function updateSteps(activeStep) {
  [step1, step2, step3].forEach((el, i) => {
    el.classList.remove('active', 'completed');
    if (i + 1 < activeStep) el.classList.add('completed');
    else if (i + 1 === activeStep) el.classList.add('active');
  });
}

/**
 * Trigger a file download from a Blob
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Get filename from response headers
 */
function getFilenameFromResponse(response) {
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  if (match) return match[1];
  const xFilename = response.headers.get('X-Filename');
  if (xFilename) return xFilename;
  return lastFilename;
}

// ─── Main Form Submit Handler ─────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Collect data
  const formData = collectFormData();

  // Validate form fields
  const isValid = validateForm(formData);
  if (!isValid) {
    showToast('Please fix the highlighted errors before continuing.', 'error');
    const firstErr = form.querySelector('.field-error.visible');
    if (firstErr) {
      firstErr.closest('.form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }

  // Validate required uploads (Customer Aadhaar Front + PAN)
  const uploadValid = validateUploads();
  if (!uploadValid) {
    showToast('Please upload the required Customer documents.', 'error');
    document.querySelector('.upload-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // Set UI to loading
  setLoading(true);
  updateSteps(2);

  try {
    // ── Single FormData request: form fields + files together ──────────────
    // This is the ONLY call — no separate upload step.
    // The server stores files in a unique per-request temp dir and deletes
    // them after sending the PDF. No cross-user file contamination is possible.
    const fd = new FormData();

    // Append all form text fields
    Object.entries(formData).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
    });

    // Append only files uploaded IN THIS SESSION (from uploadedFiles state)
    const fileKeyMap = {
      custAadhaarFront: 'customer/aadhaar-front',
      custAadhaarBack:  'customer/aadhaar-back',
      custPAN:          'customer/pan',
      guarAadhaarFront: 'guarantor/aadhaar-front',
      guarAadhaarBack:  'guarantor/aadhaar-back',
      guarPAN:          'guarantor/pan',
      coAadhaarFront:   'co-borrower/aadhaar-front',
      coAadhaarBack:    'co-borrower/aadhaar-back',
      coPAN:            'co-borrower/pan'
    };
    let fileCount = 0;
    Object.entries(uploadedFiles).forEach(([key, file]) => {
      if (file instanceof File) {
        fd.append(fileKeyMap[key], file, file.name);
        fileCount++;
      }
    });
    console.log(`[Submit] Sending ${fileCount} file(s) + form data to /api/generate-pdf`);

    // Single fetch — Content-Type set automatically by browser for FormData
    const response = await fetch('/api/generate-pdf', {
      method: 'POST',
      body: fd
    });

    if (!response.ok) {
      let errMsg = `Server error (${response.status})`;
      try {
        const errBody = await response.json();
        errMsg = errBody.error || errBody.errors?.join(', ') || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    // Get filename from headers
    lastFilename = getFilenameFromResponse(response);

    // Get PDF blob
    const blob = await response.blob();
    if (blob.size < 1000) throw new Error('Generated PDF seems invalid. Please try again.');
    lastPdfBlob = blob;

    // Auto-download
    downloadBlob(blob, lastFilename);

    // Update UI
    updateSteps(3);
    successMsg.textContent = `${lastFilename} is ready and downloading.`;
    successOverlay.classList.add('visible');
    showToast('PDF Generated Successfully! 🎉');

  } catch (err) {
    console.error('PDF generation error:', err);
    showToast(`Error: ${err.message}`, 'error');
    updateSteps(1);
  } finally {
    setLoading(false);
  }
});

// ─── Success Overlay Actions ──────────────────────────────────────────────────

downloadAgain.addEventListener('click', () => {
  if (lastPdfBlob) {
    downloadBlob(lastPdfBlob, lastFilename);
    showToast('Downloading again...');
  }
});

printBtn.addEventListener('click', () => {
  if (!lastPdfBlob) return;
  const url = URL.createObjectURL(lastPdfBlob);
  const printWin = window.open(url, '_blank');
  if (printWin) {
    printWin.onload = () => {
      printWin.print();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
  } else {
    showToast('Please allow popups to use the print feature.', 'error');
    URL.revokeObjectURL(url);
  }
});

newFormBtn.addEventListener('click', () => {
  successOverlay.classList.remove('visible');
  form.reset();
  clearAllErrors();
  lastPdfBlob = null;
  updateSteps(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Form cleared. Ready for new entry.');
});

// Close overlay on backdrop click
successOverlay.addEventListener('click', (e) => {
  if (e.target === successOverlay) {
    successOverlay.classList.remove('visible');
  }
});

// ─── Reset Button ─────────────────────────────────────────────────────────────

resetBtn.addEventListener('click', () => {
  if (!confirm('Clear all form fields? This cannot be undone.')) return;
  form.reset();
  clearAllErrors();
  lastPdfBlob = null;
  updateSteps(1);
  showToast('Form reset successfully.');
});

// ─── Real-time Validation (on blur) ──────────────────────────────────────────

// Validate individual field on blur
VALIDATION_RULES.forEach(rule => {
  const el = form.querySelector(`[name="${rule.field}"]`);
  if (!el) return;
  el.addEventListener('blur', () => {
    const val = el.value;
    if (!rule.test(val)) {
      setFieldError(rule.field, rule.msg);
    } else {
      setFieldError(rule.field, null);
    }
  });
  el.addEventListener('input', () => {
    // Clear error as user types
    const errEl = document.getElementById(`err-${rule.field}`);
    if (errEl?.classList.contains('visible')) {
      if (rule.test(el.value)) setFieldError(rule.field, null);
    }
  });
});

// ─── Input Masks & Formatting ─────────────────────────────────────────────────

// Phone numbers — digits only
document.querySelectorAll('input[type="tel"]').forEach(el => {
  el.addEventListener('input', () => {
    el.value = el.value.replace(/\D/g, '').substring(0, 10);
  });
});

// Pin codes — digits only, 6 chars
document.querySelectorAll('[id*="PinCode"]').forEach(el => {
  el.addEventListener('input', () => {
    el.value = el.value.replace(/\D/g, '').substring(0, 6);
  });
});

// ─── Battery toggle visual helper ────────────────────────────────────────────

document.querySelectorAll('input[name="batteryType"]').forEach(el => {
  el.addEventListener('change', () => {
    document.querySelectorAll('.toggle-card').forEach(card => card.classList.remove('selected'));
    el.closest('.toggle-card')?.classList.add('selected');
  });
});

// ─── Address Proof radio visual ───────────────────────────────────────────────

document.querySelectorAll('.radio-card input[type="radio"]').forEach(el => {
  el.addEventListener('change', () => {
    // Deselect all in same group
    const name = el.name;
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
      r.closest('.radio-card')?.classList.remove('selected');
    });
    el.closest('.radio-card')?.classList.add('selected');
  });
});

// ─── Keyboard shortcut: Ctrl+Enter to generate ───────────────────────────────

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (!generateBtn.disabled) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

// Set today's date as max for DOB
const dobEl = document.getElementById('customerDOB');
if (dobEl) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dobEl.max = `${yyyy}-${mm}-${dd}`;
  // Suggest a reasonable default
  dobEl.setAttribute('placeholder', 'YYYY-MM-DD');
}

// Initialize step 1 active
updateSteps(1);

// ─── Customer Age Auto-Calculation + Eligibility ──────────────────────────────

const ageDisplayEl = document.getElementById('customerAge');
const ageWarningEl = document.getElementById('age-warning');
const MIN_AGE = 21; // customers must be at least 21 years old
const MAX_AGE = 59; // customers must be 59 years or younger

/**
 * Calculate exact age in full years using year/month/day comparison.
 * Returns -1 if DOB is invalid or in the future.
 */
function calcAge(dobStr) {
  if (!dobStr) return -1;
  const dob   = new Date(dobStr);
  if (isNaN(dob.getTime())) return -1;
  const today = new Date();
  if (dob > today) return -1;

  let age = today.getFullYear() - dob.getFullYear();
  // Subtract 1 if birthday hasn't occurred yet this year
  const bdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (today < bdayThisYear) age--;
  return age;
}

/** Apply age value to the UI and enforce eligibility. */
function applyAge(age) {
  if (age < 0) {
    // No valid DOB selected
    ageDisplayEl.value = '';
    ageDisplayEl.classList.remove('eligible', 'ineligible');
    ageWarningEl.style.display = 'none';
    generateBtn.disabled = false;
    return;
  }

  ageDisplayEl.value = `${age} Years`;

  if (age < MIN_AGE) {
    // INELIGIBLE — too young
    ageDisplayEl.classList.remove('eligible');
    ageDisplayEl.classList.add('ineligible');
    ageWarningEl.textContent = '❌ Customer is not eligible for finance because the age is below 21 years.';
    ageWarningEl.style.display = 'block';
    generateBtn.disabled = true;
    generateBtn.title = 'Customer is not eligible. Minimum allowed age is 21 years.';
  } else if (age >= 60) {
    // INELIGIBLE — too old
    ageDisplayEl.classList.remove('eligible');
    ageDisplayEl.classList.add('ineligible');
    ageWarningEl.textContent = '❌ Customer is not eligible for finance because the age is 60 years or above.';
    ageWarningEl.style.display = 'block';
    generateBtn.disabled = true;
    generateBtn.title = 'Customer is not eligible. Maximum allowed age is 59 years.';
  } else {
    // ELIGIBLE (21–59 years)
    ageDisplayEl.classList.remove('ineligible');
    ageDisplayEl.classList.add('eligible');
    ageWarningEl.textContent = '';
    ageWarningEl.style.display = 'none';
    generateBtn.disabled = false;
    generateBtn.title = '';
  }
}

// Calculate age whenever DOB changes
if (dobEl) {
  dobEl.addEventListener('change', () => {
    applyAge(calcAge(dobEl.value));
  });
  // Run once on load in case a default value exists
  if (dobEl.value) applyAge(calcAge(dobEl.value));
}

// Also block form submission explicitly if ineligible (belt-and-suspenders)
form.addEventListener('submit', (e) => {
  const age = calcAge(dobEl ? dobEl.value : '');
  if (age < MIN_AGE) {
    e.preventDefault();
    e.stopImmediatePropagation();
    showToast('Customer is not eligible. Minimum allowed age is 21 years.', 'error');
  } else if (age >= 60) {
    e.preventDefault();
    e.stopImmediatePropagation();
    showToast('Customer is not eligible. Maximum allowed age is 59 years.', 'error');
  }
}, true); // capture phase so it runs before the main submit handler

console.log('%cE-Rikshaw Finance PDF Generator', 'color:#6366f1;font-weight:bold;font-size:14px');
console.log('%cReady. Use Ctrl+Enter to submit.', 'color:#9194b3;font-size:11px');

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT UPLOAD MODULE
// ═══════════════════════════════════════════════════════════════════════════

'use strict'; // already set at top but safe to repeat in block scope

/** Map: dropzone key → File object (null = not uploaded) */
const uploadedFiles = {
  custAadhaarFront: null,
  custAadhaarBack:  null,
  custPAN:          null,
  guarAadhaarFront: null,
  guarAadhaarBack:  null,
  guarPAN:          null,
  coAadhaarFront:   null,
  coAadhaarBack:    null,
  coPAN:            null
};

/** Required upload field keys */
const REQUIRED_UPLOADS = ['custAadhaarFront', 'custPAN'];

/** Max file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
/** Allowed extensions (fallback when browser doesn't provide MIME) */
const ALLOWED_EXTS  = ['.jpg', '.jpeg', '.png', '.pdf'];

/**
 * Format bytes to human-readable string
 */
function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Validate a single file — returns error string or null
 */
function validateFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
  if (!typeOk) return 'Only JPG, PNG or PDF files are allowed.';
  if (file.size > MAX_FILE_SIZE) return 'File size must be under 10 MB.';
  return null;
}

/**
 * Show / hide upload error for a drop-zone key
 */
function setUploadError(key, message) {
  const errEl = document.getElementById(`uerr-${key}`);
  const dz    = document.getElementById(`dz-${key}`);
  if (!errEl || !dz) return;
  if (message) {
    errEl.textContent = `⚠ ${message}`;
    errEl.classList.add('visible');
    dz.classList.add('has-error');
  } else {
    errEl.textContent = '';
    errEl.classList.remove('visible');
    dz.classList.remove('has-error');
  }
}

/**
 * Validate all required upload fields.
 * Returns true if valid.
 */
function validateUploads() {
  let valid = true;
  REQUIRED_UPLOADS.forEach(key => {
    if (!uploadedFiles[key]) {
      setUploadError(key, key === 'custAadhaarFront'
        ? 'Customer Aadhaar Front is required.'
        : 'Customer PAN Card is required.');
      valid = false;
    } else {
      setUploadError(key, null);
    }
  });
  return valid;
}

/**
 * Attach a file to a drop-zone — update state + render preview
 */
function attachFile(dz, file) {
  const key  = dz.dataset.key;
  const err  = validateFile(file);
  if (err) {
    setUploadError(key, err);
    return;
  }
  setUploadError(key, null);
  uploadedFiles[key] = file;

  const isPdf   = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = !isPdf;

  // Update drop-zone classes
  dz.classList.add('has-file');
  dz.classList.remove('is-image', 'is-pdf');
  dz.classList.add(isPdf ? 'is-pdf' : 'is-image');

  // Populate filename / size
  dz.querySelector('.dz-filename').textContent = file.name;
  dz.querySelector('.dz-filesize').textContent  = fmtBytes(file.size);

  // Image preview
  if (isImage) {
    const img = dz.querySelector('.dz-img-preview');
    const reader = new FileReader();
    reader.onload = ev => { img.src = ev.target.result; };
    reader.readAsDataURL(file);
  }

  // Reset native input value (so same file can be re-selected after remove)
  const fileInput = dz.querySelector('input[type="file"]');
  if (fileInput) {
    try { fileInput.value = ''; } catch(_) {}
  }
}

/**
 * Clear / remove a file from a drop-zone
 */
function clearFile(dz) {
  const key = dz.dataset.key;
  uploadedFiles[key] = null;
  dz.classList.remove('has-file', 'is-image', 'is-pdf', 'has-error');

  const img = dz.querySelector('.dz-img-preview');
  if (img) img.src = '';
  const fname = dz.querySelector('.dz-filename');
  if (fname) fname.textContent = '';
  const fsize = dz.querySelector('.dz-filesize');
  if (fsize) fsize.textContent = '';

  const fileInput = dz.querySelector('input[type="file"]');
  if (fileInput) { try { fileInput.value = ''; } catch(_) {} }

  setUploadError(key, null);
}

/**
 * Initialise all drop-zones
 */
function initDropZones() {
  document.querySelectorAll('.drop-zone').forEach(dz => {
    const fileInput = dz.querySelector('input[type="file"]');
    if (!fileInput) return;

    // ── Native file input change ──────────────────────────────────
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) attachFile(dz, file);
    });

    // ── Drag & Drop ───────────────────────────────────────────────
    dz.addEventListener('dragenter', (e) => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.add('drag-over');
    });
    dz.addEventListener('dragover', (e) => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.add('drag-over');
    });
    dz.addEventListener('dragleave', (e) => {
      // Only remove if leaving the zone itself (not a child)
      if (!dz.contains(e.relatedTarget)) {
        dz.classList.remove('drag-over');
      }
    });
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) attachFile(dz, file);
    });

    // ── Replace button ────────────────────────────────────────────
    const replaceBtn = dz.querySelector('.dz-btn-replace');
    if (replaceBtn) {
      replaceBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent dz click from firing twice
        fileInput.click();
      });
    }

    // ── Remove button ─────────────────────────────────────────────
    const removeBtn = dz.querySelector('.dz-btn-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearFile(dz);
      });
    }
  });
}

// Initialise drop-zones on DOM ready
initDropZones();

// ── Clear all uploads on page load (privacy: fresh state every visit) ────────
window.addEventListener('load', () => {
  document.querySelectorAll('.drop-zone').forEach(dz => clearFile(dz));
  Object.keys(uploadedFiles).forEach(k => { uploadedFiles[k] = null; });
});

// Also clear uploads when form is reset
resetBtn.addEventListener('click', () => {
  document.querySelectorAll('.drop-zone').forEach(dz => clearFile(dz));
  Object.keys(uploadedFiles).forEach(k => { uploadedFiles[k] = null; });
}, true);

console.log('%cUpload module ready.', 'color:#14b8a6;font-size:11px');
