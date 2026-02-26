import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SecretScan — Find Leaked Credentials',
  description: 'Scan your code for leaked API keys, tokens, and secrets before they reach production.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise antialiased">
        {children}
      </body>
    </html>
  );
}
