import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import { dAppName } from '@/config';

export const metadata: Metadata = {
  title: dAppName,
  description: 'Deadline-based public commitment escrow on MultiversX.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
