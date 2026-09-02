'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePotholeClusters, useUpdateClusterStatus } from '@/hooks/use-pothole-clusters';
import type { BoundingBox, PotholeCluster, PotholeSeverity, PotholeStatus } from '@/types/pothole';
import {
  Activity,
  Layers,
  Maximize2,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

const SEVERITY_COLORS: Record<PotholeSeverity, string> = {
  severe: '#ef4444', // Red
  high: '#f97316', // Orange
  medium: '#eab308', // Yellow
  low: '#10b981', // Green
};

const SEVERITY_LABELS: Record<PotholeSeverity, string> = {
  severe: 'Sangat Parah',
  high: 'Tinggi',
  medium: 'Sedang',
  low: 'Ringan',
};

interface InteractiveMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  statusFilter?: PotholeStatus;
  severityFilter?: PotholeSeverity;
}

export function InteractiveMap({
  initialCenter = [106.8456, -6.2088], // Jakarta center
  initialZoom = 12,
  statusFilter,
  severityFilter,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});

  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<PotholeCluster | null>(null);

  const { data: clusters = [], isFetching, refetch } = usePotholeClusters({
    bbox,
    status: statusFilter,
    severity: severityFilter,
  });

  const updateStatusMutation = useUpdateClusterStatus();

  // Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: initialCenter,
      zoom: initialZoom,
    });

    // Add zoom/rotation controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    // Add geolocation control
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
      'top-right',
    );

    const updateBoundingBox = () => {
      const bounds = map.getBounds();
      setBbox({
        minLat: bounds.getSouth(),
        minLon: bounds.getWest(),
        maxLat: bounds.getNorth(),
        maxLon: bounds.getEast(),
      });
    };

    map.on('load', () => {
      updateBoundingBox();
    });

    map.on('moveend', () => {
      updateBoundingBox();
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [initialCenter, initialZoom]);

  // Sync Pothole Cluster Markers with Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove markers that are no longer in clusters data
    const currentClusterIds = new Set(clusters.map((c) => c.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentClusterIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add / Update markers
    clusters.forEach((cluster) => {
      const color = SEVERITY_COLORS[cluster.severity] || '#ef4444';

      if (!markersRef.current[cluster.id]) {
        // Create custom pulsating DOM marker element
        const el = document.createElement('div');
        el.className = 'group cursor-pointer relative';
        el.style.width = '32px';
        el.style.height = '32px';

        el.innerHTML = `
          <div style="background-color: ${color};" class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs transition-transform transform group-hover:scale-125">
            ${cluster.detection_count}
          </div>
          ${
            cluster.severity === 'severe'
              ? `<div style="background-color: ${color};" class="absolute inset-0 rounded-full animate-ping opacity-75"></div>`
              : ''
          }
        `;

        el.addEventListener('click', () => {
          setSelectedCluster(cluster);
          map.flyTo({
            center: [cluster.center_longitude, cluster.center_latitude],
            zoom: Math.max(map.getZoom(), 15),
            duration: 800,
          });
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([cluster.center_longitude, cluster.center_latitude])
          .addTo(map);

        markersRef.current[cluster.id] = marker;
      }
    });
  }, [clusters]);

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border shadow-sm flex flex-col bg-muted/20">
      {/* Top Floating Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-background/90 backdrop-blur-md p-1.5 rounded-lg border shadow-sm">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Sinkronisasi...' : 'Muat Ulang'}
        </Button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
          <Layers className="size-3.5" />
          <span>{clusters.length} Klaster Terdeteksi</span>
        </div>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Detail Inspector Card (Bottom Right Floating) */}
      {selectedCluster && (
        <Card className="absolute bottom-4 right-4 z-10 w-80 shadow-xl border-primary/20 backdrop-blur-md bg-background/95 animate-in slide-in-from-bottom-2">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Activity className="size-4 text-primary" />
              Detail Klaster #{selectedCluster.id.slice(0, 8)}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSelectedCluster(null)}
            >
              ✕
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-2 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tingkat Keparahan:</span>
              <Badge
                style={{
                  backgroundColor: SEVERITY_COLORS[selectedCluster.severity],
                  color: '#fff',
                }}
              >
                {SEVERITY_LABELS[selectedCluster.severity]}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Deteksi Sensor:</span>
              <span className="font-semibold">{selectedCluster.detection_count} Laporan</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rata-rata Akurasi AI:</span>
              <span className="font-semibold">
                {(selectedCluster.confidence_avg * 100).toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status Penanganan:</span>
              <Badge variant="outline" className="capitalize">
                {selectedCluster.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Koordinat:</span>
              <span className="font-mono text-[11px]">
                {selectedCluster.center_latitude.toFixed(5)}, {selectedCluster.center_longitude.toFixed(5)}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                className="w-full text-xs gap-1"
                disabled={selectedCluster.status === 'verified' || updateStatusMutation.isPending}
                onClick={async () => {
                  await updateStatusMutation.mutateAsync({
                    id: selectedCluster.id,
                    status: 'verified',
                  });
                  setSelectedCluster({ ...selectedCluster, status: 'verified' });
                }}
              >
                <ShieldCheck className="size-3.5" />
                {selectedCluster.status === 'verified' ? 'Terverifikasi' : 'Verifikasi PU'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs gap-1"
                disabled={selectedCluster.status === 'repaired' || updateStatusMutation.isPending}
                onClick={async () => {
                  await updateStatusMutation.mutateAsync({
                    id: selectedCluster.id,
                    status: 'repaired',
                  });
                  setSelectedCluster({ ...selectedCluster, status: 'repaired' });
                }}
              >
                <Wrench className="size-3.5" />
                {selectedCluster.status === 'repaired' ? 'Selesai' : 'Tandai Selesai'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fullscreen GIS Studio Shortcut */}
      <a
        href="/dashboard/map"
        className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 text-xs bg-background/90 hover:bg-background px-3 py-1.5 rounded-lg border shadow-sm font-medium transition-colors"
      >
        <Maximize2 className="size-3.5 text-primary" /> Buka Studio Peta Fullscreen & Tools CAD
      </a>
    </div>
  );
}
