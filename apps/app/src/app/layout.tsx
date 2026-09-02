import type { Metadata } from 'next';
import { Geist_Mono, Inter, Oxanium } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './globals.css';
import { Providers } from '@/components/providers';
import { cn } from '@/lib/utils';

const oxaniumHeading = Oxanium({ subsets: ['latin'], variable: '--font-heading' });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'HyperGrid - Realtime Pothole Detection & Spatial Analytics',
  description: 'Sistem Deteksi & Klasterisasi Jalan Rusak Realtime Berbasis PostGIS',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('h-full', 'antialiased', geistMono.variable, 'font-sans', inter.variable, oxaniumHeading.variable)}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
