import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { numberToWords } from '../numberToWords';
import fs from 'fs';
import path from 'path';

const getFileAsBase64 = (filePath) => {
  const fullPath = path.join(process.cwd(), 'public', filePath);
  const fileBuffer = fs.readFileSync(fullPath);
  return fileBuffer.toString('base64');
};

const getFileAsBytes = (filePath) => {
  const fullPath = path.join(process.cwd(), 'public', filePath);
  return fs.readFileSync(fullPath); 
};

export async function generateInvoicePdf(data) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });

  // 1. Load font only
  const fontBase64 = getFileAsBase64('fonts/comic.ttf');

  // 2. Load Fonts (Map bold to the same font so it doesn't break)
  doc.addFileToVFS('comic.ttf', fontBase64);
  doc.addFont('comic.ttf', 'ComicSans', 'normal');
  doc.addFont('comic.ttf', 'ComicSans', 'bold');
  
  // 3. Extract and Format Dynamic Fields
  let formattedDate = data?.date || '';
  if (formattedDate) {
    const d = new Date(formattedDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      formattedDate = `${day}/${month}/${year}`;
    }
  }

  const customerName = data?.customerName || '';
  // Maps the 'site' from your frontend directly below the customer name
  const customerAddress = data?.site || data?.jobSite || data?.customerAddress || ''; 
  const contactPerson = data?.contactPerson || '';
  const customerPhone = data?.customerPhone || data?.email || '';

  const subject = data?.subject || '';
  const projectNo = data?.projectNo || '';
  const proformaTitle = data?.proformaTitle || 'INVOICE';
  
  const preparedByName = 'Ukanah Augustine M.';
  const preparedByRole = 'Operations Manager';

  // 4. Draw Attention and Date (Bold)
  doc.setFont('ComicSans', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text('Attention:', 15, 45);
  doc.text(`Date: ${formattedDate}`, 150, 45);

  // Render name and Job Site right under Attention (Normal font)
  doc.setFont('ComicSans', 'normal');
  doc.text(customerName, 15, 51);
  if (customerAddress) {
    const splitAddress = doc.splitTextToSize(customerAddress, 100);
    doc.text(splitAddress, 15, 57);
  }

  // 5. Sir & Main Title (Bold)
  doc.setFont('ComicSans', 'bold');
  doc.text('Sir,', 15, 65);

  doc.setFontSize(12);
  const splitTitle = doc.splitTextToSize(proformaTitle.toUpperCase(), 180);
  doc.text(splitTitle, 105, 72, { align: 'center' });

  // Reset to normal font for tables
  doc.setFont('ComicSans', 'normal');

  const transparentStyles = { 
    fillColor: false, 
    font: 'ComicSans', 
    fontSize: 10, 
    textColor: [0, 0, 0], 
    lineColor: [0, 0, 0], 
    lineWidth: 0.5 
  };

  // 6. First Table (Company Details & Contact Info Mapped Correctly)
  autoTable(doc, {
    startY: 85, // Shifted down slightly to make room for the job site address
    theme: 'grid',
    styles: transparentStyles,
    headStyles: { fillColor: false, textColor: [0, 0, 0] },
    bodyStyles: { fillColor: false },
    alternateRowStyles: { fillColor: false },
    body: [
      [
        { content: 'Company', styles: { fontStyle: 'bold' } }, 
        customerName, 
        { content: 'Email / Phone No', styles: { fontStyle: 'bold' } }, 
        customerPhone
      ],
      [
        { content: 'Contact Person', styles: { fontStyle: 'bold' } }, 
        contactPerson, 
        { content: 'Date', styles: { fontStyle: 'bold' } }, 
        formattedDate
      ],
      [
        { content: 'Subject', styles: { fontStyle: 'bold' } }, 
        subject, 
        { content: 'Project No.', styles: { fontStyle: 'bold' } }, 
        projectNo
      ]
    ],
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 70 },
      2: { cellWidth: 35 }, // Adjusted slightly for 'Email / Phone No'
      3: { cellWidth: 40 }
    }
  });

  // 7. Items Data Mapping & Smart VAT
  const items = data?.items?.length > 0 ? data.items : [];
  let subtotal = 0;
  let vat = 0;
  const taxRate = Number(data?.taxPct ?? 7.5) / 100;

  const tableBody = items.map((item, index) => {
    const price = Number(item.price || item.rate || 0);
    const days = item.days || item.qty || item.quantity || '';
    const total = Number(item.total || item.amount || (price * Number(days || 1)) || 0);
    
    subtotal += total;
    
    // Smart VAT: Only calculate tax if the frontend marked it as Equipment
    if (item.isEquipment) {
      vat += total * taxRate;
    }

    return [
      item?.sn || `${index + 1}.`, 
      item?.name || item?.description || '', 
      item?.piece || '1', 
      price > 0 ? `N ${price.toLocaleString('en-US')}` : '', 
      days, 
      total > 0 ? `N ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''
    ];
  });

  const grandTotal = subtotal + vat;

  if (tableBody.length === 0) { tableBody.push(['', '', '', '', '', '']); }
  
  // 8. Rebuilt Totals (Explicitly Bolded with Decimals)
  tableBody.push([
    '',
    { content: 'SUBTOTAL', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } }, 
    { content: `N ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold' } }
  ]);
  tableBody.push([
    '',
    { content: `7.5% VAT VAT NO.: 09211347-0001`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', textColor: [255, 0, 0] } }, 
    { content: `N ${vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold' } }
  ]);
  tableBody.push([
    '',
    { content: 'GRANDTOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, 
    { content: `N ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold' } }
  ]);

  // 9. Second Table (Items list + Totals)
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 5,
    theme: 'grid',
    styles: { ...transparentStyles, halign: 'center' },
    headStyles: { fillColor: false, textColor: [0, 0, 0], fontStyle: 'bold' },
    bodyStyles: { fillColor: false },
    alternateRowStyles: { fillColor: false },
    head: [['S/N', 'Item', 'Piece', 'Unit\nPrice(N)', 'Number\nOf Days', 'Total Price\n(N)']],
    body: tableBody, 
    columnStyles: { 1: { halign: 'left' }, 5: { halign: 'right' } }
  });

  // 10. Amount in Words
  let finalY = doc.lastAutoTable.finalY;
  let amountInWords = '';
  try {
    amountInWords = grandTotal > 0 ? numberToWords(grandTotal) : 'Zero';
  } catch (e) {
    amountInWords = 'Zero';
  }

  doc.setFontSize(10);
  doc.setFont('ComicSans', 'bold');
  doc.text('AMOUNT IN WORDS: ', 15, finalY + 7);
  doc.setFont('ComicSans', 'normal');
  doc.text(`${amountInWords} Naira Only`, 55, finalY + 7);

  // 11. Terms and Conditions
  doc.setFont('ComicSans', 'bold');
  doc.text('TERMS AND CONDITIONS', 15, finalY + 25);
  doc.setFont('ComicSans', 'normal');
  doc.text('1. You shall provide daily fuel for work... 100-150 litres depending on volume and duration of work.', 15, finalY + 30);
  doc.text('2. You shall provide transport to and fro work site if accommodation residence and site is far apart.', 15, finalY + 35);

  // 12. Hand-drawn Signatures Box
  doc.text('Thank you for your anticipated patronage', 15, finalY + 55);
  
  doc.rect(15, finalY + 60, 90, 35); 
  doc.rect(105, finalY + 60, 90, 35); 

  doc.setFont('ComicSans', 'bold');
  doc.text('Prepared By:', 17, finalY + 65);
  doc.setFont('ComicSans', 'normal');
  doc.text(preparedByName ? preparedByName : '______________________', 17, finalY + 70);
  if (preparedByRole) doc.text(`(${preparedByRole})`, 17, finalY + 74);
  
  doc.setFont('ComicSans', 'bold');
  doc.text('Company:', 17, finalY + 79);
  doc.setFont('ComicSans', 'normal');
  doc.text(' Premix Trustconcrete Nig. Ltd', 35, finalY + 79);

  // 13. Auto-Stamping Signature Image from Folder
  try {
    const sigBase64 = getFileAsBase64('brand/signature.png');
    doc.addImage(sigBase64, 'PNG', 30, finalY + 80, 40, 12);
  } catch (error) {
    console.warn("Signature image not found. Ensure signature.png is in the public/brand/ folder.");
  }

  doc.setFont('ComicSans', 'bold');
  doc.text('Signed: __________________________', 17, finalY + 92);

  // Confirmation Box explicitly bolded
  const confirmText = `CONFIRMATION BY ${customerName ? customerName.toUpperCase() : 'CLIENT'}.`;
  const splitConfirm = doc.splitTextToSize(confirmText, 85);
  doc.text(splitConfirm, 107, finalY + 65);
  doc.text('Name: Signature:', 107, finalY + 92);

  
 // 14. Account Details (Dynamically driven by the UI dropdown)
  const accountName = data?.accountName || 'PREMIX TRUSCONCRETE LTD';
  const bankName = data?.bankName || 'GT BANK PLC';
  const accountNumber = data?.accountNumber || '0040303449';

  doc.setFontSize(12);
  doc.text(`ACCOUNT NAME: ${accountName.toUpperCase()}`, 15, 275);
  doc.text(`BANK:             ${bankName}`, 15, 282);
  doc.text(`ACCOUNT NUMBER: ${accountNumber}`, 15, 289);

  // 15. Merge Background Layer Using PDF-Lib
  const contentPdfBytes = doc.output('arraybuffer');
  const letterheadBytes = getFileAsBytes('brand/letterhead.pdf');

  const letterheadDoc = await PDFDocument.load(letterheadBytes);
  const contentDoc = await PDFDocument.load(contentPdfBytes);
  const finalDoc = await PDFDocument.create();

  const numContentPages = contentDoc.getPageCount();

  for (let i = 0; i < numContentPages; i++) {
    const [letterheadPage] = await finalDoc.copyPages(letterheadDoc, [0]);
    finalDoc.addPage(letterheadPage);

    const [embeddedContentPage] = await finalDoc.embedPdf(contentPdfBytes, [i]);
    letterheadPage.drawPage(embeddedContentPage, {
      x: 0,
      y: 0,
      width: letterheadPage.getWidth(),
      height: letterheadPage.getHeight(),
    });
  }

  const finalBytes = await finalDoc.save();

  return { bytes: Buffer.from(finalBytes), totals: { subtotal, vat, grandTotal } };
}