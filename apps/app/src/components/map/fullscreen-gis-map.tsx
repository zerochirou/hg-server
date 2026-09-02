'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePotholeClusters, useUpdateClusterStatus } from '@/hooks/use-pothole-clusters';
import type { BoundingBox, PotholeCluster, PotholeSeverity, PotholeStatus } from '@/types/pothole';
import {
  Activity,
  BookmarkPlus,
  Check,
  Edit3,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  MousePointer,
  PenTool,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Square,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';

const SEVERITY_COLORS: Record<PotholeSeverity, string> = {
  severe: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#10b981',
};

const SEVERITY_LABELS: Record<PotholeSeverity, string> = {
  severe: 'Sangat Parah',
  high: 'Tinggi',
  medium: 'Sedang',
  low: 'Ringan',
};

const MAP_STYLES = {
  osm: {
    name: 'OpenStreetMap (Standard)',
    tiles: [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
  },
  dark: {
    name: 'Carto Dark Matter',
    tiles: [
      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    ],
  },
  voyager: {
    name: 'Carto Voyager (Terrain)',
    tiles: [
      'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    ],
  },
};

type DrawToolMode = 'select' | 'draw_line' | 'draw_polygon' | 'draw_point';

interface GisFeature {
  id: string;
  type: 'LineString' | 'Polygon' | 'Point';
  coordinates: number[] | number[][] | number[][][];
  note: string;
  measurement: string;
  createdAt: string;
}

// Calculate approximate line distance in meters
function calculateLineDistance(coords: number[][]): number {
  if (!coords || coords.length < 2) return 0;
  let totalMeters = 0;
  const R = 6371000;

  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalMeters += R * c;
  }
  return totalMeters;
}

// Calculate approximate polygon area in m2
function calculatePolygonArea(coords: number[][]): number {
  if (!coords || coords.length < 3) return 0;
  const R = 6371000;
  let total = 0;

  for (let i = 0; i < coords.length; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[(i + 1) % coords.length];
    const radLon1 = (lon1 * Math.PI) / 180;
    const radLat1 = (lat1 * Math.PI) / 180;
    const radLon2 = (lon2 * Math.PI) / 180;
    const radLat2 = (lat2 * Math.PI) / 180;

    total += (radLon2 - radLon1) * (2 + Math.sin(radLat1) + Math.sin(radLat2));
  }
  return Math.abs((total * R * R) / 2);
}

export function FullscreenGisMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});

  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<PotholeCluster | null>(null);
  const [statusFilter] = useState<PotholeStatus | undefined>(undefined);
  const [severityFilter, setSeverityFilter] = useState<PotholeSeverity | undefined>(undefined);
  const [currentMapStyle, setCurrentMapStyle] = useState<keyof typeof MAP_STYLES>('osm');

  // Drawing Engine States
  const [drawMode, setDrawMode] = useState<DrawToolMode>('select');
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [gisFeatures, setGisFeatures] = useState<GisFeature[]>([]);
  const [activeNoteModal, setActiveNoteModal] = useState<GisFeature | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for access in map callbacks
  const drawModeRef = useRef<DrawToolMode>('select');
  const currentPointsRef = useRef<number[][]>([]);
  const gisFeaturesRef = useRef<GisFeature[]>([]);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    currentPointsRef.current = currentPoints;
  }, [currentPoints]);

  useEffect(() => {
    gisFeaturesRef.current = gisFeatures;
  }, [gisFeatures]);

  const { data: clusters = [], isFetching, refetch } = usePotholeClusters({
    bbox,
    status: statusFilter,
    severity: severityFilter,
  });

  const updateStatusMutation = useUpdateClusterStatus();

  // Setup GIS GeoJSON Layers on Map
  const setupGisLayers = useCallback((map: MapLibreMap) => {
    // 1. Saved Features Source
    if (!map.getSource('gis-features-source')) {
      map.addSource('gis-features-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'gis-polygon-fill',
        type: 'fill',
        source: 'gis-features-source',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'gis-lines',
        type: 'line',
        source: 'gis-features-source',
        filter: ['in', '$type', 'LineString', 'Polygon'],
        paint: {
          'line-color': '#2563eb',
          'line-width': 4,
          'line-opacity': 0.95,
        },
      });

      map.addLayer({
        id: 'gis-points',
        type: 'circle',
        source: 'gis-features-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#2563eb',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    // 2. Active Drawing Preview Source
    if (!map.getSource('gis-draw-preview-source')) {
      map.addSource('gis-draw-preview-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'gis-preview-polygon-fill',
        type: 'fill',
        source: 'gis-draw-preview-source',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#f97316',
          'fill-opacity': 0.3,
        },
      });

      map.addLayer({
        id: 'gis-preview-lines',
        type: 'line',
        source: 'gis-draw-preview-source',
        filter: ['in', '$type', 'LineString', 'Polygon'],
        paint: {
          'line-color': '#f97316',
          'line-width': 4,
          'line-dasharray': [2, 2],
        },
      });

      map.addLayer({
        id: 'gis-preview-points',
        type: 'circle',
        source: 'gis-draw-preview-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#f97316',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }
  }, []);

  // Sync Saved Features GeoJSON to Map
  const syncFeaturesToMap = useCallback((features: GisFeature[]) => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('gis-features-source') as maplibregl.GeoJSONSource;
    if (source) {
      const geojsonFeatures: GeoJSON.Feature[] = features.map((f) => ({
        type: 'Feature',
        id: f.id,
        properties: {
          id: f.id,
          note: f.note,
          measurement: f.measurement,
        },
        geometry: {
          type: f.type,
          coordinates: f.coordinates as never,
        },
      }));

      source.setData({
        type: 'FeatureCollection',
        features: geojsonFeatures,
      });
    }
  }, []);

  // Sync Active Drawing Preview to Map
  const updateDrawPreview = useCallback((points: number[][], hoverPoint?: number[]) => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('gis-draw-preview-source') as maplibregl.GeoJSONSource;
    if (!source) return;

    const currentMode = drawModeRef.current;
    const previewPoints = hoverPoint && currentMode !== 'draw_point' ? [...points, hoverPoint] : points;

    if (previewPoints.length === 0) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const previewFeatures: GeoJSON.Feature[] = [];

    previewPoints.forEach((pt) => {
      previewFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: pt },
      });
    });

    if (currentMode === 'draw_line' && previewPoints.length >= 2) {
      previewFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: previewPoints },
      });
    } else if (currentMode === 'draw_polygon' && previewPoints.length >= 2) {
      const polygonRing = [...previewPoints, previewPoints[0]];
      previewFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [polygonRing] },
      });
    }

    source.setData({
      type: 'FeatureCollection',
      features: previewFeatures,
    });
  }, []);

  // Finish Line
  const finishLineDrawing = useCallback(
    (pts: number[][]) => {
      if (pts.length < 2) return;
      const meters = calculateLineDistance(pts);
      const measurement =
        meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} meter`;

      const id = 'line_' + Date.now();
      const newFeature: GisFeature = {
        id,
        type: 'LineString',
        coordinates: pts,
        note: `Garis Ruas Jalan (${measurement})`,
        measurement,
        createdAt: new Date().toLocaleTimeString('id-ID'),
      };

      const nextFeatures = [...gisFeaturesRef.current, newFeature];
      setGisFeatures(nextFeatures);
      gisFeaturesRef.current = nextFeatures;
      syncFeaturesToMap(nextFeatures);
      setActiveNoteModal(newFeature);

      setCurrentPoints([]);
      currentPointsRef.current = [];
      setDrawMode('select');
      updateDrawPreview([]);
    },
    [syncFeaturesToMap, updateDrawPreview],
  );

  // Finish Polygon
  const finishPolygonDrawing = useCallback(
    (pts: number[][]) => {
      if (pts.length < 3) return;
      const closedRing = [...pts, pts[0]];
      const areaM2 = calculatePolygonArea(pts);
      const measurement =
        areaM2 >= 10000 ? `${(areaM2 / 10000).toFixed(2)} ha` : `${Math.round(areaM2)} m²`;

      const id = 'poly_' + Date.now();
      const newFeature: GisFeature = {
        id,
        type: 'Polygon',
        coordinates: [closedRing],
        note: `Zona Perbaikan PU (${measurement})`,
        measurement,
        createdAt: new Date().toLocaleTimeString('id-ID'),
      };

      const nextFeatures = [...gisFeaturesRef.current, newFeature];
      setGisFeatures(nextFeatures);
      gisFeaturesRef.current = nextFeatures;
      syncFeaturesToMap(nextFeatures);
      setActiveNoteModal(newFeature);

      setCurrentPoints([]);
      currentPointsRef.current = [];
      setDrawMode('select');
      updateDrawPreview([]);
    },
    [syncFeaturesToMap, updateDrawPreview],
  );

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'base-tiles': {
            type: 'raster',
            tiles: MAP_STYLES.osm.tiles,
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: 'base-layer',
            type: 'raster',
            source: 'base-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [106.8456, -6.2088],
      zoom: 12,
      doubleClickZoom: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
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
      setupGisLayers(map);
      syncFeaturesToMap(gisFeaturesRef.current);
      updateBoundingBox();
    });

    map.on('moveend', () => {
      updateBoundingBox();
    });

    map.on('click', (e) => {
      const mode = drawModeRef.current;
      if (mode === 'select') return;

      const clickedCoord = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];

      if (mode === 'draw_point') {
        const id = 'pt_' + Date.now();
        const measurement = `${clickedCoord[1]}, ${clickedCoord[0]}`;
        const newFeature: GisFeature = {
          id,
          type: 'Point',
          coordinates: clickedCoord,
          note: `Titik Komentar Lapangan`,
          measurement,
          createdAt: new Date().toLocaleTimeString('id-ID'),
        };

        const nextFeatures = [...gisFeaturesRef.current, newFeature];
        setGisFeatures(nextFeatures);
        gisFeaturesRef.current = nextFeatures;
        syncFeaturesToMap(nextFeatures);
        setActiveNoteModal(newFeature);
        setDrawMode('select');
        updateDrawPreview([]);
        return;
      }

      if (mode === 'draw_line' || mode === 'draw_polygon') {
        const nextPts = [...currentPointsRef.current, clickedCoord];
        setCurrentPoints(nextPts);
        currentPointsRef.current = nextPts;
        updateDrawPreview(nextPts);
      }
    });

    map.on('mousemove', (e) => {
      const mode = drawModeRef.current;
      if (mode === 'draw_line' || mode === 'draw_polygon') {
        if (currentPointsRef.current.length > 0) {
          const hoverCoord = [e.lngLat.lng, e.lngLat.lat];
          updateDrawPreview(currentPointsRef.current, hoverCoord);
        }
      }
    });

    map.on('dblclick', () => {
      const mode = drawModeRef.current;
      const pts = currentPointsRef.current;

      if (mode === 'draw_line' && pts.length >= 2) {
        finishLineDrawing(pts);
      } else if (mode === 'draw_polygon' && pts.length >= 3) {
        finishPolygonDrawing(pts);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [finishLineDrawing, finishPolygonDrawing, setupGisLayers, syncFeaturesToMap, updateDrawPreview]);

  // Update cursor on mode change
  useEffect(() => {
    if (mapContainerRef.current) {
      if (drawMode !== 'select') {
        mapContainerRef.current.style.cursor = 'crosshair';
      } else {
        mapContainerRef.current.style.cursor = '';
      }
    }
  }, [drawMode]);

  // Switch Tile Style
  const handleStyleChange = (styleKey: keyof typeof MAP_STYLES) => {
    setCurrentMapStyle(styleKey);
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setStyle({
      version: 8,
      sources: {
        'base-tiles': {
          type: 'raster',
          tiles: MAP_STYLES[styleKey].tiles,
          tileSize: 256,
          attribution: '&copy; OpenStreetMap / CartoDB',
        },
      },
      layers: [
        {
          id: 'base-layer',
          type: 'raster',
          source: 'base-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    });

    map.once('style.load', () => {
      setupGisLayers(map);
      syncFeaturesToMap(gisFeaturesRef.current);
    });
  };

  // Sync Pothole Cluster Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentClusterIds = new Set(clusters.map((c) => c.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentClusterIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    clusters.forEach((cluster) => {
      const color = SEVERITY_COLORS[cluster.severity] || '#ef4444';

      if (!markersRef.current[cluster.id]) {
        const el = document.createElement('div');
        el.className = 'group cursor-pointer relative';
        el.style.width = '28px';
        el.style.height = '28px';

        el.innerHTML = `
          <div style="background-color: ${color};" class="w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs transition-transform transform group-hover:scale-125">
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

  const handleDeleteFeature = (id: string) => {
    const next = gisFeatures.filter((f) => f.id !== id);
    setGisFeatures(next);
    gisFeaturesRef.current = next;
    syncFeaturesToMap(next);
  };

  const handleSaveActiveNote = () => {
    if (!activeNoteModal) return;
    const next = gisFeatures.map((f) =>
      f.id === activeNoteModal.id ? { ...f, note: activeNoteModal.note } : f,
    );
    setGisFeatures(next);
    gisFeaturesRef.current = next;
    syncFeaturesToMap(next);
    setActiveNoteModal(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-8.5rem)] rounded-2xl overflow-hidden border shadow-sm flex flex-col bg-muted/20">
      {/* Active Drawing Banner with Manual Finish Button */}
      {drawMode !== 'select' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-primary text-primary-foreground px-4 py-2.5 rounded-full shadow-2xl text-xs font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <Info className="size-4 shrink-0" />
          <span>
            {drawMode === 'draw_line' &&
              `Garis Ruas: Klik di peta untuk membuat titik (${currentPoints.length} titik dibuat). Klik ganda atau klik tombol hijau untuk selesai.`}
            {drawMode === 'draw_polygon' &&
              `Zona Area: Klik minimal 3 titik di peta (${currentPoints.length} titik dibuat). Klik ganda atau klik tombol hijau untuk selesai.`}
            {drawMode === 'draw_point' &&
              'Catatan Pin: Klik 1 kali di peta di mana Anda ingin meletakkan pin catatan.'}
          </span>

          <div className="flex items-center gap-1.5 ml-2">
            {((drawMode === 'draw_line' && currentPoints.length >= 2) ||
              (drawMode === 'draw_polygon' && currentPoints.length >= 3)) && (
              <Button
                size="xs"
                variant="secondary"
                className="h-6 text-[11px] px-2.5 font-bold gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => {
                  if (drawMode === 'draw_line') finishLineDrawing(currentPoints);
                  if (drawMode === 'draw_polygon') finishPolygonDrawing(currentPoints);
                }}
              >
                <Check className="size-3" /> Selesai Gambar
              </Button>
            )}

            <Button
              size="xs"
              variant="outline"
              className="h-6 text-[11px] px-2 text-primary-foreground bg-transparent border-primary-foreground/40 hover:bg-primary-foreground/20"
              onClick={() => {
                setDrawMode('select');
                setCurrentPoints([]);
                currentPointsRef.current = [];
                updateDrawPreview([]);
              }}
            >
              <X className="size-3 mr-1" /> Batal
            </Button>
          </div>
        </div>
      )}

      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-background/95 backdrop-blur-md p-2 rounded-xl border shadow-lg max-w-[calc(100%-2rem)]">
        {/* Draw Tools Toolbar */}
        <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-lg">
          <Button
            size="sm"
            variant={drawMode === 'select' ? 'default' : 'ghost'}
            className="h-7 text-xs px-2.5 gap-1.5"
            onClick={() => {
              setDrawMode('select');
              setCurrentPoints([]);
              currentPointsRef.current = [];
              updateDrawPreview([]);
            }}
            title="Mode Navigasi Normal (Pan & Zoom)"
          >
            <MousePointer className="size-3.5" /> Pilih
          </Button>

          <Button
            size="sm"
            variant={drawMode === 'draw_line' ? 'default' : 'ghost'}
            className="h-7 text-xs px-2.5 gap-1.5"
            onClick={() => {
              setDrawMode('draw_line');
              setCurrentPoints([]);
              currentPointsRef.current = [];
            }}
            title="Gambar Garis Ruas Jalan (Line)"
          >
            <PenTool className="size-3.5 text-primary" /> Garis Ruas
          </Button>

          <Button
            size="sm"
            variant={drawMode === 'draw_polygon' ? 'default' : 'ghost'}
            className="h-7 text-xs px-2.5 gap-1.5"
            onClick={() => {
              setDrawMode('draw_polygon');
              setCurrentPoints([]);
              currentPointsRef.current = [];
            }}
            title="Gambar Zona Penambalan Jalan (Polygon)"
          >
            <Square className="size-3.5 text-primary" /> Zona Area
          </Button>

          <Button
            size="sm"
            variant={drawMode === 'draw_point' ? 'default' : 'ghost'}
            className="h-7 text-xs px-2.5 gap-1.5"
            onClick={() => {
              setDrawMode('draw_point');
              setCurrentPoints([]);
              currentPointsRef.current = [];
            }}
            title="Tandai Pin Catatan Lapangan"
          >
            <BookmarkPlus className="size-3.5 text-primary" /> Catatan Pin
          </Button>
        </div>

        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Base Map Switcher */}
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-muted-foreground ml-1" />
          <Select
            value={currentMapStyle}
            onValueChange={(val) => handleStyleChange((val || 'osm') as keyof typeof MAP_STYLES)}
          >
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue placeholder="Pilih Layer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="osm">OSM Standard</SelectItem>
              <SelectItem value="dark">Carto Dark Mode</SelectItem>
              <SelectItem value="voyager">Carto Voyager</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Severity Filter */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={severityFilter === undefined ? 'default' : 'ghost'}
            className="h-7 text-xs px-2"
            onClick={() => setSeverityFilter(undefined)}
          >
            Semua
          </Button>
          <Button
            size="sm"
            variant={severityFilter === 'severe' ? 'destructive' : 'outline'}
            className="h-7 text-xs px-2"
            onClick={() => setSeverityFilter('severe')}
          >
            Parah
          </Button>
        </div>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2 gap-1"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`size-3 ${isFetching ? 'animate-spin' : ''}`} />
          {clusters.length} Titik
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2"
          onClick={toggleFullscreen}
          title="Fullscreen Toggle"
        >
          {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </Button>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full select-none" />

      {/* Anotasi / Catatan Survei Drawer */}
      {gisFeatures.length > 0 && (
        <Card className="absolute top-20 right-4 z-20 w-80 max-h-96 overflow-y-auto shadow-2xl border bg-background/95 backdrop-blur-md text-xs animate-in slide-in-from-right-2">
          <CardHeader className="p-3 pb-2 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5">
              <Edit3 className="size-3.5 text-primary" /> Anotasi & Catatan Gambar ({gisFeatures.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {gisFeatures.map((feat) => (
              <div
                key={feat.id}
                className="p-2.5 rounded-lg border bg-card/60 shadow-xs flex flex-col gap-1.5 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {feat.type}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-mono text-primary font-semibold">
                      {feat.measurement}
                    </Badge>
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteFeature(feat.id)}
                    title="Hapus shape ini"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                <p className="font-medium text-foreground text-xs">{feat.note}</p>
                <span className="text-[10px] text-muted-foreground">{feat.createdAt}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Edit Note Modal */}
      {activeNoteModal && (
        <Card className="absolute top-24 left-6 z-40 w-88 shadow-2xl border-primary/50 bg-background/98 backdrop-blur-lg animate-in zoom-in-95">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-primary">
              <BookmarkPlus className="size-4" /> Simpan Anotasi Objek Gambar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/70 text-xs">
              <Ruler className="size-3.5 text-primary" />
              <span className="font-semibold">Ukuran Kalkulasi:</span>
              <span className="font-mono font-bold text-primary">{activeNoteModal.measurement}</span>
            </div>
            <Input
              value={activeNoteModal.note}
              onChange={(e) => setActiveNoteModal({ ...activeNoteModal, note: e.target.value })}
              placeholder="Contoh: Perlu aspal ulang 20m, survei Dinas PU..."
              className="text-xs h-9"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setActiveNoteModal(null)}>
                Batal
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleSaveActiveNote}>
                Simpan Catatan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Inspector Card */}
      {selectedCluster && (
        <Card className="absolute bottom-4 right-4 z-20 w-80 shadow-2xl border-primary/20 backdrop-blur-md bg-background/95 animate-in slide-in-from-bottom-3">
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
              <span className="text-muted-foreground">Keparahan:</span>
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
              <span className="text-muted-foreground">Jumlah Deteksi:</span>
              <span className="font-semibold">{selectedCluster.detection_count} Laporan IoT</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Confidence Rata-rata:</span>
              <span className="font-semibold">
                {(selectedCluster.confidence_avg * 100).toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Koordinat:</span>
              <span className="font-mono text-[11px]">
                {selectedCluster.center_latitude.toFixed(5)}, {selectedCluster.center_longitude.toFixed(5)}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs gap-1"
                  disabled={selectedCluster.status === 'verified' || updateStatusMutation.isPending}
                  onClick={async () => {
                    await updateStatusMutation.mutateAsync({ id: selectedCluster.id, status: 'verified' });
                    setSelectedCluster({ ...selectedCluster, status: 'verified' });
                  }}
                >
                  <ShieldCheck className="size-3.5" /> Verifikasi PU
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  disabled={selectedCluster.status === 'repaired' || updateStatusMutation.isPending}
                  onClick={async () => {
                    await updateStatusMutation.mutateAsync({ id: selectedCluster.id, status: 'repaired' });
                    setSelectedCluster({ ...selectedCluster, status: 'repaired' });
                  }}
                >
                  <Wrench className="size-3.5" /> Selesai
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
