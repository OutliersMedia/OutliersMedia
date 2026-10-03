import { jsPDF } from 'jspdf';

/**
 * OUTLIERS MEDIA — PROFESSIONAL INVOICE & STATEMENT GENERATOR
 * Generates shareable, executive-grade PDF invoices with structured filenames,
 * pixel-perfect alignments, strict boundary wrapping, and clean INR formatting.
 */

function sanitizeForFilename(str) {
  if (!str) return 'Client';
  return str.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').substring(0, 30);
}

function formatDate(dateStr) {
  if (!dateStr) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function truncateString(str, maxLen = 30) {
  if (!str) return 'N/A';
  const clean = String(str).trim();
  return clean.length > maxLen ? clean.substring(0, maxLen - 3) + '...' : clean;
}

function getPlanDeliverables(planName) {
  const p = (planName || '').toLowerCase();
  if (p.includes('starter') || p.includes('basic')) {
    return [
      '10 High-Engagement Static Posts / month',
      '3 Edited Reels with Hooks & Audio Research',
      'Instagram Setup & Profile Optimization',
      'Google Business Profile Setup & Verification',
      'Content Calendar & Captions Provided',
      'Basic Hashtag & Keyword Research'
    ];
  }
  if (p.includes('growth')) {
    return [
      '15 High-Engagement Static Posts / month',
      '4 Discovery Reels (1 per week) with Scripts',
      '8-10 Stories / week (32-40 per month)',
      'Google Maps Daily Optimization (Reviews, Q&A)',
      '1 Physical Print-Ready Poster Design / month',
      'Weekly Contests & Games for Foot Traffic',
      'Monthly Reach & Growth Summary Report'
    ];
  }
  if (p.includes('premium')) {
    return [
      'All Growth Content (15 Posts, 4 Reels, Stories)',
      '5-Page Mobile-Responsive Website Built',
      'Google Maps Embed & Local SEO Optimization',
      '4 Weekly SEO Blog Posts for Search Ranking',
      '3-5 Micro-Influencer Outreach / month',
      'Personalized Video Analytics Breakdown',
      'Monthly In-Store Sunday Event Planning'
    ];
  }
  return ['Social Media Marketing & Brand Retainer Services'];
}

/**
 * Generates and downloads a single transaction/order invoice.
 * Filename structure: Invoice_{ClientName}_{OrderID}_{YYYY-MM-DD}.pdf
 */
export function generateSingleInvoicePDF(order, client = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  const clientName = client.name || order.client?.name || 'Valued Client';
  const clientEmail = client.email || order.client?.email || 'N/A';
  const clientPhone = client.phone || order.client?.phone || 'N/A';
  const businessType = client.business_type || order.client?.business_type || client.instagram_handle || 'Local Business';
  const orderId = order.order_id || 'OM1002';
  const paymentId = order.payment_id || 'TXN-DIRECT-UPI';
  const planName = order.plan_name || order.plan || 'Starter Plan';
  const amountPaid = Number(order.amount_paid || 3500);
  const status = (order.status || 'active').toUpperCase();

  const generatedDate = formatDate(new Date());
  const generatedTime = formatTime(new Date());
  const orderDate = formatDate(order.created_at);
  const dateFileStamp = new Date().toISOString().split('T')[0];

  // -------------------------------------------------------------
  // 1. BRAND HEADER BANNER (Deep Navy #161430 + Indigo Accent #3428f8)
  // -------------------------------------------------------------
  doc.setFillColor(22, 20, 48); // #161430
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Accent Line
  doc.setFillColor(52, 40, 248); // Brand Accent #3428f8
  doc.rect(0, 36, pageWidth, 2, 'F');

  // Brand Name & Tagline (Left Aligned at 14mm)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('OUTLIERS MEDIA', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(199, 199, 236);
  doc.text('Social Media Marketing & Brand Growth Partner', 14, 22);

  doc.setFontSize(8);
  doc.setTextColor(165, 165, 219);
  doc.text('Chandigarh - Mohali - Panchkula  |  outliersmedia22@gmail.com', 14, 28);

  // Invoice Title & Metadata (Right Aligned at 196mm)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('TAX INVOICE', 196, 15, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(216, 216, 250);
  const cleanOrderNum = orderId.replace(/[^a-zA-Z0-9]/g, '');
  doc.text(`INV-${cleanOrderNum}-${dateFileStamp.replace(/-/g, '')}`, 196, 22, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(176, 176, 234);
  doc.text(`Issued: ${generatedDate} at ${generatedTime}`, 196, 28, { align: 'right' });

  // -------------------------------------------------------------
  // 2. KEY IDENTIFIERS BAR (Order ID, Payment ID, Billing Date, Status)
  // Box: x = 14, y = 43, w = 182, h = 20
  // -------------------------------------------------------------
  const metaY = 43;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, metaY, 182, 21, 2, 2, 'FD');

  // Slot 1: Order ID (x = 18)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('PRIMARY ORDER ID', 18, metaY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(truncateString(orderId, 18), 18, metaY + 15);

  // Slot 2: Payment / Transaction ID (x = 66)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('PAYMENT / TXN ID', 66, metaY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(52, 40, 248);
  doc.text(truncateString(paymentId, 22), 66, metaY + 15);

  // Slot 3: Billing Date (x = 120)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('BILLING DATE', 120, metaY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(orderDate, 120, metaY + 15);

  // Slot 4: Status Badge (x = 158 to 192)
  const isPaid = ['ACTIVE', 'PAUSED', 'CONFIRMED', 'CANCELLED'].includes(status);
  const statusLabel = isPaid ? 'PAID / VERIFIED' : 'PENDING APPROVAL';
  doc.setFillColor(isPaid ? 236 : 254, isPaid ? 253 : 243, isPaid ? 245 : 199);
  doc.setDrawColor(isPaid ? 16 : 245, isPaid ? 185 : 158, isPaid ? 129 : 11);
  doc.roundedRect(158, metaY + 5.5, 34, 10, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(isPaid ? 4 : 180, isPaid ? 120 : 83, isPaid ? 87 : 9);
  doc.text(statusLabel, 175, metaY + 12, { align: 'center' });

  // -------------------------------------------------------------
  // 3. BILLED TO & SERVICE PROVIDER CARDS (Side-by-Side)
  // Cards: y = 69, h = 34, w = 88 each (Left: x = 14, Right: x = 108)
  // -------------------------------------------------------------
  const cardY = 69;
  const cardW = 88;
  const cardH = 35;

  // Left Card: Billed To
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, cardY, cardW, cardH, 2, 2, 'FD');

  // Left Card Header Bar
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, cardY, cardW, 7, 2, 2, 'F');
  doc.rect(14, cardY + 5, cardW, 2, 'F'); // square bottom corners of header
  doc.setDrawColor(226, 232, 240);
  doc.line(14, cardY + 7, 14 + cardW, cardY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('BILLED TO (CLIENT DETAILS)', 18, cardY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(truncateString(clientName, 32), 18, cardY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Category: ${truncateString(businessType, 28)}`, 18, cardY + 19);
  doc.text(`Email: ${truncateString(clientEmail, 30)}`, 18, cardY + 24.5);
  doc.text(`Phone: ${truncateString(clientPhone, 20)}`, 18, cardY + 30);

  // Right Card: Issued By
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(108, cardY, cardW, cardH, 2, 2, 'FD');

  // Right Card Header Bar
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(108, cardY, cardW, 7, 2, 2, 'F');
  doc.rect(108, cardY + 5, cardW, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(108, cardY + 7, 108 + cardW, cardY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('SERVICE PROVIDER (ISSUED BY)', 112, cardY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Outliers Media Agency', 112, cardY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Proprietor: Pashvinder Dhiman', 112, cardY + 19);
  doc.text('Email: outliersmedia22@gmail.com', 112, cardY + 24.5);
  doc.text('UPI: dhimanpashvinder@okicici', 112, cardY + 30);

  // -------------------------------------------------------------
  // 4. ITEMIZED DELIVERABLES TABLE
  // Header: y = 110, h = 8, w = 182
  // Body: y = 118, h = 52, w = 182
  // -------------------------------------------------------------
  const tableY = 110;
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(14, tableY, 182, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SERVICE PLAN / SCOPE OF WORK', 18, tableY + 5.5);
  doc.text('CYCLE DURATION', 118, tableY + 5.5);
  doc.text('QTY', 150, tableY + 5.5);
  doc.text('AMOUNT (INR)', 192, tableY + 5.5, { align: 'right' });

  // Table Body Container
  const bodyY = tableY + 8;
  const bodyH = 50;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, bodyY, 182, bodyH, 'FD');

  // Plan Main Row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(truncateString(planName, 30), 18, bodyY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('30-Day Retainer', 118, bodyY + 8);
  doc.text('1', 152, bodyY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Rs. ${amountPaid.toLocaleString('en-IN')}`, 192, bodyY + 8, { align: 'right' });

  // Divider Line inside table
  doc.setDrawColor(241, 245, 249);
  doc.line(18, bodyY + 12, 192, bodyY + 12);

  // Deliverables Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('AGREED DELIVERABLES & CONTENT COMMITMENTS FOR THIS CYCLE:', 18, bodyY + 17);

  // Deliverables Split into Two Clean Balanced Columns
  const deliverables = getPlanDeliverables(planName);
  const midPoint = Math.ceil(deliverables.length / 2);
  const col1 = deliverables.slice(0, midPoint);
  const col2 = deliverables.slice(midPoint);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  let bulletY1 = bodyY + 23;
  col1.forEach(item => {
    doc.text(`-  ${truncateString(item, 45)}`, 18, bulletY1);
    bulletY1 += 6;
  });

  let bulletY2 = bodyY + 23;
  col2.forEach(item => {
    doc.text(`-  ${truncateString(item, 45)}`, 108, bulletY2);
    bulletY2 += 6;
  });

  // -------------------------------------------------------------
  // 5. PAYMENT VERIFICATION (Left) & FINANCIAL TOTALS (Right)
  // Box: y = 174, h = 36
  // Left: x = 14, w = 96 | Right: x = 114, w = 82
  // -------------------------------------------------------------
  const summaryY = 174;
  const summaryH = 36;

  // Left Box: Payment Details
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, summaryY, 96, summaryH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('PAYMENT VERIFICATION & AUDIT TRAIL', 18, summaryY + 6.5);

  doc.setDrawColor(226, 232, 240);
  doc.line(18, summaryY + 8.5, 104, summaryY + 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Payment Mode:', 18, summaryY + 14.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Instant UPI / Direct QR Transfer', 52, summaryY + 14.5);

  doc.setTextColor(100, 116, 139);
  doc.text('Transaction Ref:', 18, summaryY + 20.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(52, 40, 248);
  doc.text(truncateString(paymentId, 24), 52, summaryY + 20.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Order Record:', 18, summaryY + 26.5);
  doc.setTextColor(30, 41, 59);
  doc.text(truncateString(orderId, 22), 52, summaryY + 26.5);

  doc.setTextColor(100, 116, 139);
  doc.text('Status:', 18, summaryY + 32);
  doc.setTextColor(4, 120, 87);
  doc.setFont('helvetica', 'bold');
  doc.text(isPaid ? 'Verified & Credited to Outliers Media' : 'Pending Verification', 52, summaryY + 32);

  // Right Box: Totals Summary
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(114, summaryY, 82, summaryH, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', 119, summaryY + 7);
  doc.setTextColor(15, 23, 42);
  doc.text(`Rs. ${amountPaid.toLocaleString('en-IN')}`, 192, summaryY + 7, { align: 'right' });

  doc.setTextColor(100, 116, 139);
  doc.text('GST / Taxes:', 119, summaryY + 13.5);
  doc.text('Rs. 0.00 (Inclusive)', 192, summaryY + 13.5, { align: 'right' });

  // Total Paid Highlight Ribbon
  doc.setFillColor(239, 242, 254); // Light Indigo
  doc.roundedRect(117, summaryY + 18, 76, 14, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL PAID:', 121, summaryY + 27);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(52, 40, 248);
  doc.text(`Rs. ${amountPaid.toLocaleString('en-IN')}`, 190, summaryY + 27, { align: 'right' });

  // -------------------------------------------------------------
  // 6. TERMS & CONDITIONS + AUTHORIZED SIGNATORY
  // y = 217 to 252
  // -------------------------------------------------------------
  const termsY = 217;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, termsY, 196, termsY);

  // Left: Terms & Conditions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('TERMS & CONDITIONS:', 14, termsY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('1. Posting deliverables follow the agency 7-day cadence starting upon plan activation.', 14, termsY + 12);
  doc.text('2. Retainer renews on a flexible month-to-month cycle with zero lock-in contracts.', 14, termsY + 17);
  doc.text('3. Creatives and captions are submitted for review prior to scheduled publishing.', 14, termsY + 22);
  doc.text('4. This is an official computer-generated tax invoice issued by Outliers Media.', 14, termsY + 27);

  // Right: Authorized Signatory Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('For OUTLIERS MEDIA', 196, termsY + 6, { align: 'right' });

  // Digital Signature Seal
  doc.setFillColor(245, 247, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(144, termsY + 9, 52, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(52, 40, 248);
  doc.text('DIGITALLY SIGNED & VERIFIED', 170, termsY + 14.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 20, 48);
  doc.text('Pashvinder Dhiman', 170, termsY + 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signatory', 196, termsY + 27.5, { align: 'right' });

  // -------------------------------------------------------------
  // 7. FOOTER BAR
  // -------------------------------------------------------------
  doc.setFillColor(241, 245, 249);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(0, pageHeight - 12, pageWidth, pageHeight - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Outliers Media  -  Official Retainer Tax Invoice  -  support: outliersmedia22@gmail.com', pageWidth / 2, pageHeight - 5, { align: 'center' });

  // STRUCTURED FILENAME: Invoice_{ClientName}_{OrderID}_{Date}.pdf
  const safeClient = sanitizeForFilename(clientName);
  const safeOrder = sanitizeForFilename(orderId);
  const filename = `Invoice_${safeClient}_${safeOrder}_${dateFileStamp}.pdf`;

  doc.save(filename);
  return filename;
}

/**
 * Generates and downloads a consolidated lifetime transaction statement for a client.
 * Filename structure: Statement_Lifetime_{ClientName}_{YYYY-MM-DD}.pdf
 */
export function generateLifetimeStatementPDF(client, transactions = []) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  const clientName = client.name || 'Valued Client';
  const clientEmail = client.email || 'N/A';
  const clientPhone = client.phone || 'N/A';
  const dateFileStamp = new Date().toISOString().split('T')[0];
  const generatedDate = formatDate(new Date());
  const generatedTime = formatTime(new Date());

  const totalSpent = transactions
    .filter(t => ['active', 'paused', 'cancelled', 'confirmed'].includes((t.status || '').toLowerCase()))
    .reduce((sum, t) => sum + Number(t.amount_paid || 0), 0);

  // 1. BRAND HEADER BANNER
  doc.setFillColor(22, 20, 48);
  doc.rect(0, 0, pageWidth, 36, 'F');

  doc.setFillColor(52, 40, 248);
  doc.rect(0, 36, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('OUTLIERS MEDIA', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(199, 199, 236);
  doc.text('Client Account Ledger & Lifetime Statement of Transactions', 14, 22);

  doc.setFontSize(8);
  doc.setTextColor(165, 165, 219);
  doc.text('Tricity (Chandigarh, Mohali, Panchkula)  |  outliersmedia22@gmail.com', 14, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('ACCOUNT STATEMENT', 196, 15, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(216, 216, 250);
  doc.text(`Generated: ${generatedDate} at ${generatedTime}`, 196, 22, { align: 'right' });
  doc.text(`Total Records: ${transactions.length} Orders`, 196, 28, { align: 'right' });

  // 2. CLIENT SUMMARY CARDS (3 Balanced Columns)
  // x = 14, 76, 138 (w = 58 each)
  const metaY = 43;
  const colW = 58;

  // Card 1: Account Holder
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, metaY, colW, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('ACCOUNT HOLDER', 18, metaY + 6.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(truncateString(clientName, 22), 18, metaY + 14.5);

  // Card 2: Contact Info
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(76, metaY, colW, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('REGISTERED CONTACT', 80, metaY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(truncateString(clientEmail, 25), 80, metaY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(truncateString(clientPhone, 20), 80, metaY + 17);

  // Card 3: Lifetime Paid
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(138, metaY, colW, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('LIFETIME VERIFIED SPEND', 142, metaY + 6.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74); // Green
  doc.text(`Rs. ${totalSpent.toLocaleString('en-IN')}`, 142, metaY + 14.5);

  // 3. TRANSACTIONS TABLE
  let y = 69;
  const drawTableHeader = (curY) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(14, curY, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('DATE', 18, curY + 5.5);
    doc.text('ORDER ID', 44, curY + 5.5);
    doc.text('TXN / PAYMENT ID', 82, curY + 5.5);
    doc.text('PLAN / SERVICE', 124, curY + 5.5);
    doc.text('STATUS', 160, curY + 5.5);
    doc.text('AMOUNT', 192, curY + 5.5, { align: 'right' });
  };

  drawTableHeader(y);
  y += 8;

  if (transactions.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, 14, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No transaction history records found for this account.', 18, y + 9);
    y += 14;
  } else {
    transactions.forEach((txn, idx) => {
      // Check page overflow
      if (y > pageHeight - 38) {
        doc.addPage();
        y = 20;
        drawTableHeader(y);
        y += 8;
      }

      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(14, y, 182, 9, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 9, 196, y + 9);

      // Date
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(formatDate(txn.created_at), 18, y + 6);

      // Order ID
      doc.text(truncateString(txn.order_id, 14), 44, y + 6);

      // Payment ID
      doc.setFontSize(7.5);
      doc.text(truncateString(txn.payment_id || 'N/A', 18), 82, y + 6);

      // Plan Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(truncateString(txn.plan_name || 'Marketing Plan', 18), 124, y + 6);

      // Status
      const st = (txn.status || 'active').toLowerCase();
      if (['active', 'confirmed'].includes(st)) {
        doc.setTextColor(22, 163, 74);
      } else if (st === 'pending') {
        doc.setTextColor(217, 119, 6);
      } else if (st === 'paused') {
        doc.setTextColor(234, 88, 12);
      } else {
        doc.setTextColor(220, 38, 38);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(st.toUpperCase(), 160, y + 6);

      // Amount
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`Rs. ${Number(txn.amount_paid || 0).toLocaleString('en-IN')}`, 192, y + 6, { align: 'right' });

      y += 9;
    });
  }

  // Bottom Summary Box
  y += 6;
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(114, y, 82, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Cumulative Lifetime Paid:', 119, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text(`Rs. ${totalSpent.toLocaleString('en-IN')}`, 192, y + 14, { align: 'right' });

  // Footer Bar
  doc.setFillColor(241, 245, 249);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(0, pageHeight - 12, pageWidth, pageHeight - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Outliers Media  -  Verified Lifetime Client Ledger  -  outliersmedia22@gmail.com', pageWidth / 2, pageHeight - 5, { align: 'center' });

  // STRUCTURED FILENAME: Statement_Lifetime_{ClientName}_{Date}.pdf
  const safeClient = sanitizeForFilename(clientName);
  const filename = `Statement_Lifetime_${safeClient}_${dateFileStamp}.pdf`;

  doc.save(filename);
  return filename;
}
