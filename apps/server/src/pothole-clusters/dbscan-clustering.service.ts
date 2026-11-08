import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  ClusterSeverity,
  parseClusterSeverity,
  PotholeClusterEntity,
} from './entities/pothole-cluster.entity';

export interface DbscanPoint {
  id: string;
  latitude: number;
  longitude: number;
  confidence: number;
  speedKmh?: number | null;
  zAccelPeak?: number | null;
  deviceId?: string;
  userId?: string | null;
  detectedAt: Date;
}

export interface ConsolidatedClusterPoint {
  id: string;
  latitude: number;
  longitude: number;
  intensity: number;
  z_accel_peak?: number | null;
  confidence: number;
  detected_at: string;
  user_id?: string | null;
  device_id?: string;
}

export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'severe'] as const;
export type SeverityLevel = ClusterSeverity;

/** Status Validasi Deteksi (Strict Dual-Filter: Visual + Sensor) */
export type DetectionValidationStatus =
  | 'CONFIRMED'
  | 'CONFIRMED_VIA_SENSOR'
  | 'UNCERTAIN'
  | 'REJECTED';

/**
 * 1. Tahap Klasifikasi & Validasi (Mencegah False Positive) — Strict Dual-Filter:
 * - CONFIRMED (Lolos Utama): Jika confidence >= 0.70.
 * - CONFIRMED VIA SENSOR: Jika 0.50 <= confidence < 0.70 DAN zAccelPeak >= 2.0.
 * - UNCERTAIN (Butuh Konfirmasi DBSCAN): Jika 0.50 <= confidence < 0.70 DAN zAccelPeak < 2.0.
 * - REJECTED (Noise/Bukan Lubang): Jika confidence < 0.50 ATAU (speedKmh > 60 dan zAccelPeak < 1.2).
 */
export function evaluateDetectionStatus(input: {
  confidence: number;
  zAccelPeak?: number | null;
  speedKmh?: number | null;
}): DetectionValidationStatus {
  const { confidence, zAccelPeak, speedKmh } = input;
  const peak =
    zAccelPeak != null && !isNaN(zAccelPeak) ? Math.abs(zAccelPeak) : 0;

  // 1. REJECTED:
  // Jika confidence < 0.50 ATAU (kecepatan > 60 km/h tanpa hentakan nyata < 1.2G)
  if (confidence < 0.5 || (speedKmh != null && speedKmh > 60.0 && peak < 1.2)) {
    return 'REJECTED';
  }

  // 2. CONFIRMED (Lolos Utama):
  if (confidence >= 0.7) {
    return 'CONFIRMED';
  }

  // 3. CONFIRMED VIA SENSOR:
  if (confidence >= 0.5 && peak >= 2.0) {
    return 'CONFIRMED_VIA_SENSOR';
  }

  // 4. UNCERTAIN (Butuh Konfirmasi DBSCAN):
  if (confidence >= 0.5 && peak < 2.0) {
    return 'UNCERTAIN';
  }

  return 'REJECTED';
}

/**
 * 2. Tahap Penentuan Severity (Berdasarkan Hentakan Fisik zAccelPeak):
 * - severe: zAccelPeak >= 2.5
 * - high: 1.8 <= zAccelPeak < 2.5
 * - medium: 1.2 <= zAccelPeak < 1.8
 * - low: zAccelPeak < 1.2 (atau jika zAccelPeak bernilai null/default)
 */
export function calculatePhysicalSeverity(
  zAccelPeak?: number | null,
): SeverityLevel {
  if (zAccelPeak == null || isNaN(zAccelPeak)) {
    return 'low';
  }

  const peak = Math.abs(zAccelPeak);
  if (peak >= 2.5) return 'severe';
  if (peak >= 1.8) return 'high';
  if (peak >= 1.2) return 'medium';
  return 'low';
}

export interface ConsolidatedCluster {
  id: string;
  center_latitude: number;
  center_longitude: number;
  severity: SeverityLevel;
  confidence_avg: number;
  detection_count: number;
  user_count: number;
  status: string;
  first_detected_at: Date;
  last_detected_at: Date;
  updated_at: Date;
  radius_meters: number;
  points: ConsolidatedClusterPoint[];
}

export interface DbscanConsolidationResponse {
  clusters: ConsolidatedCluster[];
  heatmap: Array<[number, number, number]>; // [latitude, longitude, intensity 0..1]
  total_detections: number;
  total_clusters: number;
  generated_at: string;
}

/**
 * Menghitung jarak geodesic akurat dua titik koordinat GPS dalam satuan meter (Haversine formula)
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // radius bumi dalam meter
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

@Injectable()
export class DbscanClusteringService {
  private readonly logger = new Logger(DbscanClusteringService.name);

  constructor(private readonly db: DbService) {}

  /**
   * Mengonsolidasikan seluruh data deteksi lintas pengguna menggunakan algoritma DBSCAN
   * Parameter:
   *  - epsMeters: radius kedekatan titik (default: 25 meter)
   *  - minPts: batas minimum titik untuk klaster padat (default: 1 agar semua titik tervalidasi)
   */
  async consolidateDetections(options?: {
    epsMeters?: number;
    minPts?: number;
    minLat?: number;
    minLon?: number;
    maxLat?: number;
    maxLon?: number;
    status?: string;
    severity?: string;
    limit?: number;
  }): Promise<DbscanConsolidationResponse> {
    const {
      epsMeters = 25,
      minPts = 1,
      minLat,
      minLon,
      maxLat,
      maxLon,
      status,
      severity,
      limit = 2000,
    } = options || {};

    const hasBbox =
      minLat !== undefined &&
      minLon !== undefined &&
      maxLat !== undefined &&
      maxLon !== undefined;

    // 1. Ambil seluruh data raw deteksi dari tabel detections (lintas pengguna & perangkat)
    const rawDetections = await this.db.detection.findMany({
      where: hasBbox
        ? {
            latitude: { gte: minLat, lte: maxLat },
            longitude: { gte: minLon, lte: maxLon },
          }
        : undefined,
      orderBy: { detectedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        confidence: true,
        speedKmh: true,
        zAccelPeak: true,
        deviceId: true,
        userId: true,
        detectedAt: true,
      },
    });

    // 2. Jika raw detections masih kosong (misal database awal hanya berisi tabel pothole_clusters),
    // gunakan fallback dari pothole_clusters agar aplikasi tidak kosong.
    if (rawDetections.length === 0) {
      return this.fallbackFromExistingClusters(options);
    }

    // Saring raw detections menggunakan Strict Dual-Filter:
    // - REJECTED: dibuang (noise)
    // - CONFIRMED / CONFIRMED_VIA_SENSOR: lolos langsung
    // - UNCERTAIN: butuh minimal 2-3 laporan dalam radius epsMeters
    const confirmedPool: DbscanPoint[] = [];
    const uncertainPool: DbscanPoint[] = [];

    for (const d of rawDetections) {
      const status = evaluateDetectionStatus({
        confidence: d.confidence,
        zAccelPeak: d.zAccelPeak,
        speedKmh: d.speedKmh,
      });

      const pt: DbscanPoint = {
        id: d.id,
        latitude: d.latitude,
        longitude: d.longitude,
        confidence: d.confidence,
        speedKmh: d.speedKmh,
        zAccelPeak: d.zAccelPeak,
        deviceId: d.deviceId,
        userId: d.userId,
        detectedAt: d.detectedAt,
      };

      if (status === 'CONFIRMED' || status === 'CONFIRMED_VIA_SENSOR') {
        confirmedPool.push(pt);
      } else if (status === 'UNCERTAIN') {
        uncertainPool.push(pt);
      }
    }

    // Evaluasi konsensus spasial untuk data UNCERTAIN:
    // Hanya data UNCERTAIN yang memiliki minimal 2-3 laporan terkumpul di titik koordinat yang sama (radius epsMeters)
    // yang boleh diproses menjadi klaster.
    const allCandidates = [...confirmedPool, ...uncertainPool];
    const approvedUncertain: DbscanPoint[] = [];
    const minPtsForUncertain = 2; // minimal 2-3 laporan

    for (const unc of uncertainPool) {
      let neighborsCount = 0;
      for (const other of allCandidates) {
        if (
          haversineDistanceMeters(
            unc.latitude,
            unc.longitude,
            other.latitude,
            other.longitude,
          ) <= epsMeters
        ) {
          neighborsCount++;
        }
      }

      if (neighborsCount >= minPtsForUncertain) {
        approvedUncertain.push(unc);
      }
    }

    const points: DbscanPoint[] = [...confirmedPool, ...approvedUncertain];

    if (points.length === 0) {
      return {
        clusters: [],
        heatmap: [],
        total_detections: 0,
        total_clusters: 0,
        generated_at: new Date().toISOString(),
      };
    }

    // 3. Eksekusi Algoritma DBSCAN
    const pointGroups = this.executeDbscan(points, epsMeters, minPts);

    const consolidatedClusters: ConsolidatedCluster[] = [];
    const globalHeatmap: Array<[number, number, number]> = [];

    // 4. Transformasi grup DBSCAN menjadi Klaster Representatif + Heatmap
    pointGroups.forEach((group, index) => {
      const count = group.length;
      if (count === 0) return;

      let sumLat = 0;
      let sumLon = 0;
      let sumConf = 0;
      let maxZ = 0;

      const userSet = new Set<string>();
      let firstTime = group[0].detectedAt.getTime();
      let lastTime = group[0].detectedAt.getTime();

      const clusterPoints: ConsolidatedClusterPoint[] = [];

      for (const p of group) {
        sumLat += p.latitude;
        sumLon += p.longitude;
        sumConf += p.confidence;

        if (p.zAccelPeak != null) {
          maxZ = Math.max(maxZ, p.zAccelPeak);
        }

        const identifier = p.userId || p.deviceId || 'anon';
        userSet.add(identifier);

        const time = p.detectedAt.getTime();
        if (time < firstTime) firstTime = time;
        if (time > lastTime) lastTime = time;

        // Hitung intensitas heatmap titik individual (0.25 s/d 1.0)
        const pointIntensity = Math.min(
          1.0,
          Math.max(
            0.25,
            p.confidence * 0.45 +
              (Math.min(3.0, p.zAccelPeak || 1.0) / 3.0) * 0.55,
          ),
        );

        clusterPoints.push({
          id: p.id,
          latitude: p.latitude,
          longitude: p.longitude,
          intensity: Math.round(pointIntensity * 100) / 100,
          z_accel_peak: p.zAccelPeak,
          confidence: p.confidence,
          detected_at: p.detectedAt.toISOString(),
          user_id: p.userId,
          device_id: p.deviceId,
        });

        // Masukkan titik ke heatmap global
        globalHeatmap.push([
          p.latitude,
          p.longitude,
          Math.round(pointIntensity * 100) / 100,
        ]);
      }

      const centerLat = sumLat / count;
      const centerLon = sumLon / count;
      const confAvg = sumConf / count;

      // Hitung radius spasial klaster (jarak terjauh dari titik pusat)
      let maxDist = 8; // minimal 8 meter agar highlight area tampak jelas di map
      for (const p of group) {
        const dist = haversineDistanceMeters(
          centerLat,
          centerLon,
          p.latitude,
          p.longitude,
        );
        if (dist > maxDist) maxDist = dist;
      }

      // Tentukan tingkat keparahan (severity) murni berdasarkan puncak hentakan fisik zAccelPeak:
      // severe: zAccelPeak >= 2.5
      // high: 1.8 <= zAccelPeak < 2.5
      // medium: 1.2 <= zAccelPeak < 1.8
      // low: zAccelPeak < 1.2
      const clusterSeverity: SeverityLevel = calculatePhysicalSeverity(maxZ);

      if (severity && clusterSeverity !== severity) {
        return;
      }

      // Jika klaster memiliki banyak laporan, tambahkan titik bobot tambahan di centroid ke heatmap
      if (count >= 2) {
        const centroidIntensity = Math.min(1.0, 0.6 + count * 0.08);
        globalHeatmap.push([
          centerLat,
          centerLon,
          Math.round(centroidIntensity * 100) / 100,
        ]);
      }

      consolidatedClusters.push({
        id: `dbscan_${index + 1}_${group[0].id.slice(0, 8)}`,
        center_latitude: Math.round(centerLat * 1e7) / 1e7,
        center_longitude: Math.round(centerLon * 1e7) / 1e7,
        severity: clusterSeverity,
        confidence_avg: Math.round(confAvg * 100) / 100,
        detection_count: count,
        user_count: userSet.size,
        status: status || 'active',
        first_detected_at: new Date(firstTime),
        last_detected_at: new Date(lastTime),
        updated_at: new Date(lastTime),
        radius_meters: Math.round(maxDist * 10) / 10,
        points: clusterPoints,
      });
    });

    return {
      clusters: consolidatedClusters,
      heatmap: globalHeatmap,
      total_detections: rawDetections.length,
      total_clusters: consolidatedClusters.length,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Implementasi algoritma DBSCAN spasial
   */
  private executeDbscan(
    points: DbscanPoint[],
    epsMeters: number,
    minPts: number,
  ): DbscanPoint[][] {
    const n = points.length;
    if (n === 0) return [];

    const visited = new Uint8Array(n);
    const assigned = new Int32Array(n).fill(-1);
    const clusters: DbscanPoint[][] = [];

    // Pencarian tetangga berbasis Haversine
    const getNeighbors = (index: number): number[] => {
      const neighbors: number[] = [];
      const p1 = points[index];

      for (let j = 0; j < n; j++) {
        const p2 = points[j];
        // Pruning cepat dengan derajat latitude (~111km per derajat)
        if (Math.abs(p1.latitude - p2.latitude) * 111320 > epsMeters) {
          continue;
        }

        const dist = haversineDistanceMeters(
          p1.latitude,
          p1.longitude,
          p2.latitude,
          p2.longitude,
        );
        if (dist <= epsMeters) {
          neighbors.push(j);
        }
      }
      return neighbors;
    };

    let clusterId = 0;

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      visited[i] = 1;

      const neighbors = getNeighbors(i);

      if (neighbors.length < minPts) {
        // Titik terisolasi: tetap dijadikan 1 klaster mikro beranggotakan 1 titik
        assigned[i] = clusterId;
        clusters.push([points[i]]);
        clusterId++;
      } else {
        // Core point: perluas klaster kepadatan tinggi
        const currentGroup: DbscanPoint[] = [points[i]];
        assigned[i] = clusterId;

        const queue: number[] = [...neighbors];
        let qIndex = 0;

        while (qIndex < queue.length) {
          const neighborIdx = queue[qIndex++];

          if (!visited[neighborIdx]) {
            visited[neighborIdx] = 1;
            const neighborNeighbors = getNeighbors(neighborIdx);
            if (neighborNeighbors.length >= minPts) {
              for (const nn of neighborNeighbors) {
                if (!queue.includes(nn)) {
                  queue.push(nn);
                }
              }
            }
          }

          if (assigned[neighborIdx] === -1) {
            assigned[neighborIdx] = clusterId;
            currentGroup.push(points[neighborIdx]);
          }
        }

        clusters.push(currentGroup);
        clusterId++;
      }
    }

    return clusters;
  }

  /**
   * Fallback cerdas jika tabel detections belum memiliki baris data,
   * membaca dari pothole_clusters dan membentuk heatmap berbasis sentroid.
   */
  private async fallbackFromExistingClusters(options?: {
    minLat?: number;
    minLon?: number;
    maxLat?: number;
    maxLon?: number;
    status?: string;
    severity?: string;
    limit?: number;
  }): Promise<DbscanConsolidationResponse> {
    const existing = await this.db.$queryRaw<PotholeClusterEntity[]>`
      SELECT
        id,
        center_latitude,
        center_longitude,
        severity,
        confidence_avg,
        detection_count,
        status,
        first_detected_at,
        last_detected_at,
        updated_at
      FROM pothole_clusters
      ORDER BY last_detected_at DESC
      LIMIT ${options?.limit || 500}
    `;

    const clusters: ConsolidatedCluster[] = [];
    const heatmap: Array<[number, number, number]> = [];

    existing.forEach((c) => {
      const count = c.detection_count || 1;
      const intensity = Math.min(1.0, Math.max(0.4, c.confidence_avg));

      // Buat titik representatif klaster
      const syntheticPoints: ConsolidatedClusterPoint[] = [
        {
          id: `pt_${c.id}_0`,
          latitude: c.center_latitude,
          longitude: c.center_longitude,
          intensity,
          confidence: c.confidence_avg,
          detected_at: new Date(c.last_detected_at).toISOString(),
        },
      ];

      heatmap.push([c.center_latitude, c.center_longitude, intensity]);

      // Jika klaster memiliki count > 1, buat beberapa micro-points di sekelilingnya untuk heatmap sebaran area
      if (count > 1) {
        const spread = 0.0001; // ~11 meter
        for (let i = 1; i < Math.min(count, 5); i++) {
          const angle = (i * 2 * Math.PI) / count;
          const pLat = c.center_latitude + Math.sin(angle) * spread * 0.8;
          const pLon = c.center_longitude + Math.cos(angle) * spread * 0.8;
          const pInt = Math.max(0.3, intensity * 0.85);

          syntheticPoints.push({
            id: `pt_${c.id}_${i}`,
            latitude: pLat,
            longitude: pLon,
            intensity: pInt,
            confidence: c.confidence_avg,
            detected_at: new Date(c.last_detected_at).toISOString(),
          });

          heatmap.push([pLat, pLon, pInt]);
        }
      }

      clusters.push({
        id: c.id,
        center_latitude: c.center_latitude,
        center_longitude: c.center_longitude,
        severity: parseClusterSeverity(c.severity),
        confidence_avg: c.confidence_avg,
        detection_count: count,
        user_count: 1,
        status: c.status,
        first_detected_at: new Date(c.first_detected_at),
        last_detected_at: new Date(c.last_detected_at),
        updated_at: new Date(c.updated_at),
        radius_meters: 12,
        points: syntheticPoints,
      });
    });

    return {
      clusters,
      heatmap,
      total_detections: clusters.reduce((s, c) => s + c.detection_count, 0),
      total_clusters: clusters.length,
      generated_at: new Date().toISOString(),
    };
  }
}
