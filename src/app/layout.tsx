import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "TRE Energy | RAMS e-sign",
  description: "Secure and efficient electronic signing for RAMS documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-emerald-500/20">
          {children}
        </div>
      </body>
    </html>
  );
}
