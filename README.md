﻿# ⚡ Akasa Electric Scooter & E-Rikshaw Finance PDF Generator

> A production-ready web application to auto-fill E-Rikshaw loan application forms — generating a professionally formatted, downloadable PDF instantly.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![pdf-lib](https://img.shields.io/badge/pdf--lib-1.17-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-ISC-yellow?style=for-the-badge)

---

## ✨ Features

- 📋 **Multi-section Form** — Customer, Guarantor, Co-Borrower, Dealer, Vehicle, Finance & Battery Details
- 🧾 **PDF Template Filling** — Loads the original form.pdf template and fills blank fields with precision
- 📅 **Auto Age Calculation** — Instantly calculates customer age from Date of Birth
- 🚫 **Age Eligibility Check** — Blocks form submission if customer age is 60 years or above
- ✅ **Address Proof Checkboxes** — Places a tick mark inside the selected option (Aadhaar / Voter ID / Driving License)
- 📎 **Document Upload** — Upload Aadhaar, PAN for Customer, Guarantor & Co-Borrower; appended to the generated PDF
- 🔒 **Field Validation** — All mandatory fields validated with clear error messages
- 📥 **Instant Download** — Generated PDF downloaded directly in the browser
- 🖨️ **Print Support** — Print PDF directly from the success screen
- 🌙 **Dark Mode UI** — Modern glassmorphism design with smooth animations

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express.js |
| PDF Engine | pdf-lib |
| File Uploads | Multer |
| Frontend | HTML5 + Vanilla CSS + Vanilla JavaScript |

---

## 📁 Project Structure

`
akasa-file/
├── config/
│   └── pdfCoordinates.js      # Exact PDF field coordinate mappings
├── public/
│   ├── index.html             # Main frontend form
│   ├── style.css              # UI styles (dark theme, glassmorphism)
│   └── script.js              # Form logic, validation, upload handling
├── routes/
│   └── pdfRoutes.js           # API route: POST /api/generate-pdf
├── services/
│   └── pdfService.js          # Core PDF filling engine
├── templates/
│   └── form.pdf               # Original E-Rikshaw finance form template
├── uploads/                   # Temporary uploaded documents
├── generated/                 # Temporary generated PDFs
├── server.js                  # Express server entry point
└── package.json
`

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or higher
- npm

### Installation

`ash
# Clone the repository
git clone https://github.com/faiizanaly/e-rikshaw-finance-pdf-generator.git

# Navigate to project folder
cd e-rikshaw-finance-pdf-generator

# Install dependencies
npm install
`

### Run Locally

`ash
npm start
`

Open your browser: http://localhost:3000

---

## 📋 Form Sections

| Section | Mandatory Fields |
|---|---|
| Customer Details | Name, Phone, DOB, Pin Code |
| Dealer Details | Dealer Name, Dealer City |
| Vehicle Details | Brand, Model, Vehicle Price |
| Finance Details | Loan Amount, Down Payment, Tenure |
| Battery Details | Voltage |
| Document Uploads | Customer Aadhaar Front, PAN |

---

## 📄 API Reference

### Generate PDF

`
POST /api/generate-pdf
Content-Type: multipart/form-data
`

**Response:** pplication/pdf — downloadable PDF file

---

## 🌐 Deployment

This app requires a platform that supports full Node.js (not Vercel).

### Recommended: Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Select your repository
5. Add environment variable: PORT=3000
6. Deploy!

### Alternative: Render

1. Go to [render.com](https://render.com)
2. New Web Service → Connect GitHub repo
3. Build Command: 
pm install
4. Start Command: 
ode server.js

---

## 👨‍💻 Built By

**Faizan Ali**
[Instagram @faiizanaly](https://www.instagram.com/faiizanaly/)

---

> Made with love for Electric Scooter & E-Rikshaw finance dealers across India
