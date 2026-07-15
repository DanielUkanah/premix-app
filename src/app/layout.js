import "./globals.css";

export const metadata = {
  title: "PremiX Dashboard — Invoices",
  description: "Invoice builder for Premix Trust Concrete Limited",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
