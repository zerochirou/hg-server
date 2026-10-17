'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useDeleteCluster,
  usePotholeClusters,
  useUpdateCluster,
} from '@/hooks/use-pothole-clusters';
import {
  useDeleteDetection,
  useRawDetections,
  useUpdateDetection,
} from '@/hooks/use-raw-detections';
import type {
  PotholeCluster,
  PotholeSeverity,
  PotholeStatus,
  RawDetection,
} from '@/types/pothole';
import {
  AlertTriangle,
  Database,
  Edit,
  Layers,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

const SEVERITY_CONFIG: Record<
  PotholeSeverity,
  { label: string; bg: string }
> = {
  severe: { label: 'Sangat Parah', bg: 'bg-red-500/15 text-red-600 border-red-500/30' },
  high: { label: 'Tinggi', bg: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  medium: { label: 'Sedang', bg: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' },
  low: { label: 'Ringan', bg: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
};

const STATUS_CONFIG: Record<
  PotholeStatus,
  { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive' }
> = {
  active: { label: 'Aktif (Belum Verif)', variant: 'destructive' },
  verified: { label: 'Terverifikasi Dinas PU', variant: 'default' },
  repaired: { label: 'Sudah Ditambal', variant: 'secondary' },
  false_positive: { label: 'Bukan Lubang', variant: 'outline' },
};

export default function DataManagementPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'clusters' | 'detections'>('clusters');

  // Search & Filters
  const [clusterSearch, setClusterSearch] = useState('');
  const [clusterStatusFilter, setClusterStatusFilter] = useState<string>('all');
  const [clusterSeverityFilter, setClusterSeverityFilter] = useState<string>('all');

  const [detectionSearch, setDetectionSearch] = useState('');

  // Edit Modals State
  const [editingCluster, setEditingCluster] = useState<PotholeCluster | null>(null);
  const [clusterForm, setClusterForm] = useState<{
    status: PotholeStatus;
    severity: PotholeSeverity;
    center_latitude: number;
    center_longitude: number;
    detection_count: number;
    confidence_avg: number;
  }>({
    status: 'active',
    severity: 'medium',
    center_latitude: 0,
    center_longitude: 0,
    detection_count: 1,
    confidence_avg: 0.9,
  });

  const [editingDetection, setEditingDetection] = useState<RawDetection | null>(null);
  const [detectionForm, setDetectionForm] = useState<{
    deviceId: string;
    latitude: number;
    longitude: number;
    confidence: number;
    speedKmh: number;
    zAccelPeak: number;
    modelVersion: string;
  }>({
    deviceId: '',
    latitude: 0,
    longitude: 0,
    confidence: 0.9,
    speedKmh: 40,
    zAccelPeak: 3.5,
    modelVersion: 'v1.2',
  });

  // Queries & Mutations
  const {
    data: clusters = [],
    isLoading: isClustersLoading,
    refetch: refetchClusters,
    isFetching: isClustersFetching,
  } = usePotholeClusters({
    status: clusterStatusFilter !== 'all' ? (clusterStatusFilter as PotholeStatus) : undefined,
    severity: clusterSeverityFilter !== 'all' ? (clusterSeverityFilter as PotholeSeverity) : undefined,
  });

  const {
    data: rawDetections = [],
    isLoading: isDetectionsLoading,
    refetch: refetchDetections,
    isFetching: isDetectionsFetching,
  } = useRawDetections({
    search: detectionSearch || undefined,
  });

  const updateClusterMutation = useUpdateCluster();
  const deleteClusterMutation = useDeleteCluster();

  const updateDetectionMutation = useUpdateDetection();
  const deleteDetectionMutation = useDeleteDetection();

  // Filtered Clusters (Search query)
  const filteredClusters = clusters.filter((c) => {
    if (!clusterSearch) return true;
    const s = clusterSearch.toLowerCase();
    return (
      c.id.toLowerCase().includes(s) ||
      c.severity.toLowerCase().includes(s) ||
      c.status.toLowerCase().includes(s) ||
      c.center_latitude.toString().includes(s) ||
      c.center_longitude.toString().includes(s)
    );
  });

  // Open Edit Cluster Modal
  const handleOpenEditCluster = (cluster: PotholeCluster) => {
    setEditingCluster(cluster);
    setClusterForm({
      status: cluster.status,
      severity: cluster.severity,
      center_latitude: cluster.center_latitude,
      center_longitude: cluster.center_longitude,
      detection_count: cluster.detection_count,
      confidence_avg: cluster.confidence_avg,
    });
  };

  // Submit Edit Cluster
  const handleSaveCluster = async () => {
    if (!editingCluster) return;
    await updateClusterMutation.mutateAsync({
      id: editingCluster.id,
      data: clusterForm,
    });
    setEditingCluster(null);
  };

  // Open Edit Detection Modal
  const handleOpenEditDetection = (det: RawDetection) => {
    setEditingDetection(det);
    setDetectionForm({
      deviceId: det.deviceId,
      latitude: det.latitude,
      longitude: det.longitude,
      confidence: det.confidence,
      speedKmh: det.speedKmh ?? 0,
      zAccelPeak: det.zAccelPeak ?? 0,
      modelVersion: det.modelVersion,
    });
  };

  // Submit Edit Detection
  const handleSaveDetection = async () => {
    if (!editingDetection) return;
    await updateDetectionMutation.mutateAsync({
      id: editingDetection.id,
      data: detectionForm,
    });
    setEditingDetection(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" /> Data Spasial
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola, filter, edit atribut, dan verifikasi status data klaster PostGIS serta rekaman telemetri IoT.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchClusters();
              refetchDetections();
            }}
            disabled={isClustersFetching || isDetectionsFetching}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-4 w-4 ${isClustersFetching || isDetectionsFetching ? 'animate-spin' : ''}`}
            />
            Segarkan Data
          </Button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Klaster Pothole</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clusters.length}</div>
            <p className="text-xs text-muted-foreground">Teragregasi otomatis di PostGIS</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Klaster Parah (Severe)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {clusters.filter((c) => c.severity === 'severe').length}
            </div>
            <p className="text-xs text-muted-foreground">Prioritas penanganan darurat</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Raw Deteksi IoT</CardTitle>
            <Radio className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rawDetections.length}</div>
            <p className="text-xs text-muted-foreground">Titik rekaman sensor & akselerometer</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Terverifikasi Dinas PU</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {clusters.filter((c) => c.status === 'verified').length}
            </div>
            <p className="text-xs text-muted-foreground">Siap jadwal penambalan</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'clusters' | 'detections')}
        className="w-full space-y-4"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="clusters" className="gap-2">
            <Layers className="h-4 w-4" /> Tabel Klaster ({clusters.length})
          </TabsTrigger>
          <TabsTrigger value="detections" className="gap-2">
            <Radio className="h-4 w-4" /> Raw Deteksi IoT ({rawDetections.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: KLASTER POTHOLE */}
        <TabsContent value="clusters" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold">Daftar Klaster Jalan Rusak</CardTitle>
                  <CardDescription className="text-xs">
                    Klik tombol <b>Edit</b> pada baris untuk mengubah koordinat, tingkat keparahan, atau status verifikasi.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48 md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Cari ID, keparahan..."
                      value={clusterSearch}
                      onChange={(e) => setClusterSearch(e.target.value)}
                      className="h-8 text-xs pl-8"
                    />
                  </div>

                  <Select
                    value={clusterStatusFilter}
                    onValueChange={(val) => setClusterStatusFilter(val || 'all')}
                  >
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="verified">Terverifikasi</SelectItem>
                      <SelectItem value="repaired">Selesai</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={clusterSeverityFilter}
                    onValueChange={(val) => setClusterSeverityFilter(val || 'all')}
                  >
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue placeholder="Semua Keparahan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Keparahan</SelectItem>
                      <SelectItem value="severe">Sangat Parah</SelectItem>
                      <SelectItem value="high">Tinggi</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="low">Ringan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="rounded-md border-t overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[100px] text-xs">ID Klaster</TableHead>
                      <TableHead className="text-xs">Tingkat Keparahan</TableHead>
                      <TableHead className="text-xs">Koordinat PostGIS</TableHead>
                      <TableHead className="text-xs text-center">Deteksi</TableHead>
                      <TableHead className="text-xs">Confidence AI</TableHead>
                      <TableHead className="text-xs">Status Penanganan</TableHead>
                      <TableHead className="text-xs">Waktu Update</TableHead>
                      <TableHead className="text-right text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isClustersLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                          <span className="text-xs text-muted-foreground">Memuat data klaster...</span>
                        </TableCell>
                      </TableRow>
                    ) : filteredClusters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-xs text-muted-foreground">
                          Tidak ada klaster yang cocok dengan filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClusters.map((cluster) => {
                        const sev = SEVERITY_CONFIG[cluster.severity] || SEVERITY_CONFIG.medium;
                        const stat = STATUS_CONFIG[cluster.status] || STATUS_CONFIG.active;

                        return (
                          <TableRow key={cluster.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs font-semibold">
                              #{cluster.id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sev.bg}`}
                              >
                                {sev.label}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {cluster.center_latitude.toFixed(5)}, {cluster.center_longitude.toFixed(5)}
                            </TableCell>
                            <TableCell className="text-center font-bold text-xs">
                              {cluster.detection_count}x
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${cluster.confidence_avg * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono">
                                  {(cluster.confidence_avg * 100).toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={stat.variant} className="text-[11px]">
                                {stat.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(cluster.updated_at).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: 'numeric',
                                month: 'short',
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={() => handleOpenEditCluster(cluster)}
                                >
                                  <Edit className="h-3 w-3" /> Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                  onClick={async () => {
                                    if (confirm('Yakin ingin menghapus klaster ini?')) {
                                      await deleteClusterMutation.mutateAsync(cluster.id);
                                    }
                                  }}
                                  title="Hapus Klaster"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: RAW DETEKSI IOT */}
        <TabsContent value="detections" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold">Data Mentah Telemetri & Sensor IoT</CardTitle>
                  <CardDescription className="text-xs">
                    Log titik rekaman akselerometer sumbu Z, kecepatan kendaraan, dan inferensi model AI.
                  </CardDescription>
                </div>

                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari Device ID / Model..."
                    value={detectionSearch}
                    onChange={(e) => setDetectionSearch(e.target.value)}
                    className="h-8 text-xs pl-8"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="rounded-md border-t overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[140px] text-xs">Device ID</TableHead>
                      <TableHead className="text-xs">Koordinat Sensor</TableHead>
                      <TableHead className="text-xs">Confidence AI</TableHead>
                      <TableHead className="text-xs text-center">G-Force (Z-Peak)</TableHead>
                      <TableHead className="text-xs text-center">Kecepatan</TableHead>
                      <TableHead className="text-xs">Model AI</TableHead>
                      <TableHead className="text-xs">Waktu Rekam</TableHead>
                      <TableHead className="text-right text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isDetectionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                          <span className="text-xs text-muted-foreground">Memuat data telemetri...</span>
                        </TableCell>
                      </TableRow>
                    ) : rawDetections.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-xs text-muted-foreground">
                          Belum ada data deteksi telemetri yang tercatat.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rawDetections.map((det) => (
                        <TableRow key={det.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {det.deviceId}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {det.latitude.toFixed(5)}, {det.longitude.toFixed(5)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {(det.confidence * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs font-semibold">
                            {det.zAccelPeak ? `${det.zAccelPeak.toFixed(2)} g` : '-'}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {det.speedKmh ? `${det.speedKmh.toFixed(1)} km/h` : '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="secondary" className="text-[10px]">
                              {det.modelVersion}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(det.detectedAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => handleOpenEditDetection(det)}
                              >
                                <Edit className="h-3 w-3" /> Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={async () => {
                                  if (confirm('Hapus data deteksi ini?')) {
                                    await deleteDetectionMutation.mutateAsync(det.id);
                                  }
                                }}
                                title="Hapus Deteksi"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG EDIT KLASTER */}
      <Dialog open={Boolean(editingCluster)} onOpenChange={(open) => !open && setEditingCluster(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit className="h-4 w-4 text-primary" /> Edit Data Klaster Pothole #{editingCluster?.id.slice(0, 8)}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ubah status, tingkat keparahan, dan koordinat klaster jalan rusak.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cluster-status" className="text-xs">Status Penanganan</Label>
                <Select
                  value={clusterForm.status}
                  onValueChange={(val) => setClusterForm({ ...clusterForm, status: (val || 'active') as PotholeStatus })}
                >
                  <SelectTrigger id="cluster-status" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif (Active)</SelectItem>
                    <SelectItem value="verified">Terverifikasi PU</SelectItem>
                    <SelectItem value="repaired">Sudah Ditambal</SelectItem>
                    <SelectItem value="false_positive">Bukan Lubang</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cluster-severity" className="text-xs">Tingkat Keparahan</Label>
                <Select
                  value={clusterForm.severity}
                  onValueChange={(val) => setClusterForm({ ...clusterForm, severity: (val || 'medium') as PotholeSeverity })}
                >
                  <SelectTrigger id="cluster-severity" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="severe">Sangat Parah (Severe)</SelectItem>
                    <SelectItem value="high">Tinggi (High)</SelectItem>
                    <SelectItem value="medium">Sedang (Medium)</SelectItem>
                    <SelectItem value="low">Ringan (Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cluster-lat" className="text-xs">Latitude</Label>
                <Input
                  id="cluster-lat"
                  type="number"
                  step="any"
                  value={clusterForm.center_latitude}
                  onChange={(e) => setClusterForm({ ...clusterForm, center_latitude: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cluster-lon" className="text-xs">Longitude</Label>
                <Input
                  id="cluster-lon"
                  type="number"
                  step="any"
                  value={clusterForm.center_longitude}
                  onChange={(e) => setClusterForm({ ...clusterForm, center_longitude: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cluster-count" className="text-xs">Jumlah Deteksi</Label>
                <Input
                  id="cluster-count"
                  type="number"
                  value={clusterForm.detection_count}
                  onChange={(e) => setClusterForm({ ...clusterForm, detection_count: parseInt(e.target.value, 10) || 1 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cluster-conf" className="text-xs">Confidence Rata-rata (0.0 - 1.0)</Label>
                <Input
                  id="cluster-conf"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={clusterForm.confidence_avg}
                  onChange={(e) => setClusterForm({ ...clusterForm, confidence_avg: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setEditingCluster(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCluster}
              disabled={updateClusterMutation.isPending}
            >
              {updateClusterMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG EDIT RAW DETECTION */}
      <Dialog open={Boolean(editingDetection)} onOpenChange={(open) => !open && setEditingDetection(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" /> Edit Data Deteksi Telemetri
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ubah parameter telemetri dan confidence sensor perangkat IoT.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="det-device" className="text-xs">Device ID</Label>
              <Input
                id="det-device"
                value={detectionForm.deviceId}
                onChange={(e) => setDetectionForm({ ...detectionForm, deviceId: e.target.value })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="det-lat" className="text-xs">Latitude</Label>
                <Input
                  id="det-lat"
                  type="number"
                  step="any"
                  value={detectionForm.latitude}
                  onChange={(e) => setDetectionForm({ ...detectionForm, latitude: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="det-lon" className="text-xs">Longitude</Label>
                <Input
                  id="det-lon"
                  type="number"
                  step="any"
                  value={detectionForm.longitude}
                  onChange={(e) => setDetectionForm({ ...detectionForm, longitude: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="det-conf" className="text-xs">Confidence</Label>
                <Input
                  id="det-conf"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={detectionForm.confidence}
                  onChange={(e) => setDetectionForm({ ...detectionForm, confidence: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="det-z" className="text-xs">Z-Peak (G)</Label>
                <Input
                  id="det-z"
                  type="number"
                  step="0.1"
                  value={detectionForm.zAccelPeak}
                  onChange={(e) => setDetectionForm({ ...detectionForm, zAccelPeak: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="det-speed" className="text-xs">Speed (km/h)</Label>
                <Input
                  id="det-speed"
                  type="number"
                  step="1"
                  value={detectionForm.speedKmh}
                  onChange={(e) => setDetectionForm({ ...detectionForm, speedKmh: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="det-model" className="text-xs">Model Version</Label>
              <Input
                id="det-model"
                value={detectionForm.modelVersion}
                onChange={(e) => setDetectionForm({ ...detectionForm, modelVersion: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setEditingDetection(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveDetection}
              disabled={updateDetectionMutation.isPending}
            >
              {updateDetectionMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
