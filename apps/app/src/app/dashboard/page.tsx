'use client';

import dynamic from 'next/dynamic';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  usePotholeClusters,
  useUpdateClusterStatus,
} from '@/hooks/use-pothole-clusters';
import { useSession } from '@/lib/auth-client';
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  Layers,
  Loader2,
  MapPin,
  RadioIcon,
  ShieldCheckIcon,
  WrenchIcon,
} from 'lucide-react';
import CountUp from '@/components/CountUp';

// Dynamic import of MapLibre GL component to prevent SSR window issues
const InteractiveMap = dynamic(
  () =>
    import('@/components/map/interactive-map').then(
      (mod) => mod.InteractiveMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[650px] w-full items-center justify-center border bg-muted/30">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">
            Memuat Peta Spasial HyperGrid...
          </span>
        </div>
      </div>
    ),
  },
);

const SEVERITY_BADGE_STYLE: Record<string, string> = {
  severe: 'text-white',
  high: 'text-red-400',
  medium: 'text-yellow-600',
  low: 'text-primary',
};

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const { data: clusters = [] } = usePotholeClusters({});
  const updateStatusMutation = useUpdateClusterStatus();

  // Compute live metrics
  const activeCount = clusters.filter((c) => c.status === 'active').length;
  const severeCount = clusters.filter((c) => c.severity === 'severe').length;
  const verifiedCount = clusters.filter((c) => c.status === 'verified').length;
  const totalDetections = clusters.reduce(
    (acc, c) => acc + (c.detection_count || 1),
    0,
  );

  if (isPending) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Selamat datang, {session?.user?.name || 'Petugas'}!
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Sistem Deteksi Otomatis & Klasterisasi Jalan Rusak Berbasis PostGIS
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Klaster Aktif</CardTitle>
            <AlertTriangleIcon className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <CountUp
              from={0}
              to={activeCount}
              separator=","
              direction="up"
              duration={1}
              className="count-up-text text-4xl font-bold font-mono"
              delay={0}
            />{' '}
            <span className="text-xl font-bold">Klaster</span>
            <p className="text-xs text-muted-foreground mt-1">
              Perlu penanganan & verifikasi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tingkat Parah (Severe)
            </CardTitle>
            <ActivityIcon className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              <CountUp
                from={0}
                to={severeCount}
                separator=","
                direction="up"
                duration={1}
                className="count-up-text text-4xl font-bold font-mono"
                delay={0}
              />{' '}
              <span className="text-xl font-bold">Klaster</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Potensi bahaya tinggi pengendara
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Verified Dinas PU
            </CardTitle>
            <CheckCircle2Icon className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <CountUp
              from={0}
              to={verifiedCount}
              separator=","
              direction="up"
              duration={1}
              className="count-up-text text-4xl font-bold font-mono"
              delay={0}
            />{' '}
            <span className="text-xl font-bold">Klaster</span>
            <p className="text-xs text-muted-foreground mt-1">
              Siap dalam alokasi perbaikan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Akumulasi Deteksi
            </CardTitle>
            <RadioIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              <CountUp
                from={0}
                to={totalDetections}
                separator=","
                direction="up"
                duration={1}
                className="count-up-text text-4xl font-bold font-mono"
                delay={0}
              />{' '}
              <span className="text-xl font-bold">Titik</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Agregasi PostGIS
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Interactive Map Section */}
      <Card className="p-0 overflow-hidden border">
        <CardHeader className="p-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base font-semibold">
                  Peta Spasial Pemantauan Kerusakan Jalan
                </CardTitle>
                <CardDescription className="text-xs">
                  Viewport bounding box sinkron otomatis dengan backend PostGIS
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 -mt-6">
          <InteractiveMap />
        </CardContent>
      </Card>

      {/* Realtime Clusters Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Daftar Klaster Jalan Rusak Terdeteksi
              </CardTitle>
              <CardDescription className="text-xs">
                Data spasial hasil agregasi clustering realtime
              </CardDescription>
            </div>
            <Badge variant="outline">{clusters.length} Klaster Total</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Klaster</TableHead>
                <TableHead>Koordinat (Lat, Lon)</TableHead>
                <TableHead>Tingkat Keparahan</TableHead>
                <TableHead>Jumlah Deteksi</TableHead>
                <TableHead>Confidence Rata-rata</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi Verifikasi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-6 text-muted-foreground"
                  >
                    Belum ada data klaster dalam viewport atau database.
                  </TableCell>
                </TableRow>
              ) : (
                clusters.map((cluster) => (
                  <TableRow key={cluster.id}>
                    <TableCell className="font-mono text-xs">
                      #{cluster.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {cluster.center_latitude.toFixed(4)},{' '}
                      {cluster.center_longitude.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={SEVERITY_BADGE_STYLE[cluster.severity] || ''}
                        variant={'outline'}
                      >
                        {cluster.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {cluster.detection_count} Laporan
                    </TableCell>
                    <TableCell>
                      {(cluster.confidence_avg * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          cluster.status === 'active'
                            ? 'destructive'
                            : cluster.status === 'verified'
                              ? 'default'
                              : 'outline'
                        }
                      >
                        {cluster.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {cluster.status === 'active' && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: cluster.id,
                              status: 'verified',
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          <ShieldCheckIcon className="mr-1 h-3.5 w-3.5" />
                          Verify PU
                        </Button>
                      )}
                      {cluster.status === 'verified' && (
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: cluster.id,
                              status: 'repaired',
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          <WrenchIcon className="mr-1 h-3.5 w-3.5" />
                          Mark Repaired
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
