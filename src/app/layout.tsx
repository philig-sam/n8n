import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vendor Licensing Intelligence',
  description: 'Internal vendor licensing intelligence admin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="topnav">
          <span className="brand">Vendor Intel</span>
          <Link href="/">Dashboard</Link>
          <Link href="/review">Review queue</Link>
          <Link href="/vendors">Vendors</Link>
          <Link href="/subscribers">Subscribers</Link>
          <Link href="/sends">Sends</Link>
          <span className="spacer" />
          <a href="/api/logout">Log out</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
