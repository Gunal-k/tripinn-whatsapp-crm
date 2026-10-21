import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRIPINN HOLIDAYS — CRM",
  description: "Enterprise Travel Management CRM with WhatsApp Cloud API & Meta CAPI Integration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-[#070d1a] text-slate-100 flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
