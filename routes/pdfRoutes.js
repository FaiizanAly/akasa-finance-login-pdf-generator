/**
 * PDF Routes - Express router for PDF generation endpoint
 */

const express = require('express');
const router = express.Router();
const { generatePDF } = require('../services/pdfService');

/**
 * POST /api/generate-pdf
 * Body: JSON with all form data
 * Response: PDF file download
 */
router.post('/generate-pdf', async (req, res) => {
  try {
    const formData = req.body;

    // Basic server-side validation
    const errors = validateFormData(formData);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    console.log('Generating PDF for:', formData.customerName);

    // Generate the PDF — returns { buffer, filename }
    const { buffer, filename } = await generatePDF(formData);

    console.log('PDF generated:', filename, `(${buffer.length} bytes)`);

    // Send PDF as download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Filename', filename);
    res.send(buffer);

  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({
      success: false,
      error: 'PDF generation failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Server-side form validation
 * @param {Object} data - Form data to validate
 * @returns {string[]} - Array of error messages (empty if valid)
 */
function validateFormData(data) {
  const errors = [];

  // Customer Name
  if (!data.customerName || !data.customerName.trim()) {
    errors.push('Customer Name is required');
  }

  // Phone numbers (10 digits)
  if (!data.customerPhone || !/^\d{10}$/.test(data.customerPhone.trim())) {
    errors.push('Customer Phone must be 10 digits');
  }

  // Date of Birth
  if (!data.customerDOB) {
    errors.push('Customer Date of Birth is required');
  }

  // Customer Pin Code
  if (!data.customerPinCode || !/^\d{6}$/.test(data.customerPinCode.trim())) {
    errors.push('Customer Pin Code must be 6 digits');
  }

  // Loan Amount
  if (data.loanAmount && isNaN(Number(data.loanAmount))) {
    errors.push('Loan Amount must be numeric');
  }

  // Vehicle Price
  if (data.vehiclePrice && isNaN(Number(data.vehiclePrice))) {
    errors.push('Vehicle Price must be numeric');
  }

  // EMI
  if (data.emi && isNaN(Number(data.emi))) {
    errors.push('EMI must be numeric');
  }

  // Tenure
  if (data.tenure && isNaN(Number(data.tenure))) {
    errors.push('Tenure must be numeric');
  }

  // Battery voltage
  if (!data.batteryVoltage) {
    errors.push('Battery Voltage is required');
  }

  return errors;
}

module.exports = router;
