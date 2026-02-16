import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ant Colony AI Simulation',
  description: 'Multi-agent ant colony simulation using Vercel AI SDK and Kimi K2.5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
