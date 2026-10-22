import type { Metadata } from "next";
import "./globals.css";
import { lightModeStyles } from "../lib/theme/styles";

export const metadata: Metadata = {
  title: "TRIPINN HOLIDAYS — CRM",
  description: "Enterprise Travel Management CRM with WhatsApp Cloud API & Meta CAPI Integration",
  icons: {
    icon: "/icon-cropped.png",
    shortcut: "/icon-cropped.png",
    apple: "/icon-cropped.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="shortcut icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('tripinn_theme');
                  var theme = saved || 'light';
                  document.documentElement.className = theme + ' h-full antialiased';
                } catch(e) {
                  document.documentElement.className = 'light h-full antialiased';
                }
              })();
            `,
          }}
        />
        <style
          id="tripinn-light-mode-styles"
          dangerouslySetInnerHTML={{ __html: lightModeStyles }}
        />
        {/* Global Travel CRM Styling */}
      </head>
      <body className="min-h-full bg-[#070d1a] text-slate-100 flex flex-col font-sans transition-colors duration-150">
        {children}
      </body>
    </html>
  );
}
