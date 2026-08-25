import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import React from 'react';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'Razorpay Revenue Recovery Orchestrator | Track 3 Buildathon',
  description: 'Supervisory AI decision engine for revenue risk detection, expected-value recovery interventions, and bounded financial execution.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.className}>
      <body className="bg-[#F8FAFC] text-slate-900 antialiased min-h-screen selection:bg-blue-100 selection:text-blue-900">{children}</body>
    </html>
  );
}
