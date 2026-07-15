import { NextResponse } from "next/server";
import { generateInvoicePdf } from "@/lib/pdf/generateInvoicePdf";
import { nextInvoiceNumber, saveInvoiceAndRegisterIncome } from "@/lib/data";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();

    const invoiceNumber = await nextInvoiceNumber();

    let signatureImageBytes = null;
    if (body.signatureImageBase64) {
      signatureImageBytes = Buffer.from(body.signatureImageBase64, "base64");
    }

    const invoice = {
      ...body,
      number: invoiceNumber,
      signatureImageBytes,
    };

    const { bytes, totals } = await generateInvoicePdf(invoice);

    // Save the invoice record (without the raw image bytes — too big for
    // a Firestore document) and register the matching income row.
    const { signatureImageBytes: _drop, signatureImageBase64: _drop2, ...invoiceForStorage } = invoice;
    await saveInvoiceAndRegisterIncome({ ...invoiceForStorage, number: invoiceNumber }, totals);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
        "X-Invoice-Number": invoiceNumber,
      },
    });
  } catch (err) {
    console.error("Failed to generate invoice:", err);
    return NextResponse.json({ error: "Failed to generate invoice", details: err.message }, { status: 500 });
  }
}
