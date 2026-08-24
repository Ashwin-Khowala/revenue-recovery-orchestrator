import './globals.css';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Revenue Recovery Orchestrator | Razorpay AI Buildathon',
  description: 'Supervisory AI decision engine for revenue risk detection, expected-value recovery interventions, and bounded financial execution.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 antialiased">{children}</body>
    </html>
  );
}
