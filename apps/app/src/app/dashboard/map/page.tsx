'use client';

import dynamic from 'next/dynamic';
import { Loader2, MapPin } from 'lucide-react';

const FullscreenGisMap = dynamic(
  () => import('@/components/map/fullscreen-gis-map').then((mod) => mod.FullscreenGisMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-8.5rem)] w-full items-center justify-center rounded-2xl border bg-muted/30">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">
            Memuat Studio Peta Spasial & Tools CAD/GIS...
          </span>
        </div>
      </div>
    ),
  },
);

export default function FullscreenMapPage() {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              Studio Peta GIS & Verifikasi Spasial
            </h1>
            <p className="text-xs text-muted-foreground">
              Gunakan tools gambar (Garis Ruas, Poligon Area, Anotasi Titik) untuk menandai survei jalan rusak
            </p>
          </div>
        </div>
      </div>

      {/* Main Fullscreen GIS Map Canvas */}
      <FullscreenGisMap />
    </div>
  );
}
