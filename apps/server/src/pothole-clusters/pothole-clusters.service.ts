import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DbService } from '../db/db.service';
import { BoundingBoxFilterDto } from './dto/bounding-box-filter.dto';
import { UpdateClusterStatusDto } from './dto/update-cluster-status.dto';
import { PotholeClusterEntity } from './entities/pothole-cluster.entity';

@Injectable()
export class PotholeClustersService {
  private readonly logger = new Logger(PotholeClustersService.name);

  constructor(private readonly db: DbService) {}

  /**
   * Mengambil semua cluster lubang jalan dalam area Bounding Box (Viewport Peta)
   * Menggunakan PostGIS Spatial Operator && dan ST_MakeEnvelope
   */
  async getByBoundingBox(
    filter: BoundingBoxFilterDto,
  ): Promise<PotholeClusterEntity[]> {
    const { minLon, minLat, maxLon, maxLat, status, limit = 500 } = filter;

    const statusClause = status
      ? Prisma.sql`AND status::text = ${status}`
      : Prisma.empty;

    return this.db.$queryRaw<PotholeClusterEntity[]>`
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
      WHERE (
        center_location && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
        OR (
          center_longitude >= ${minLon} AND center_longitude <= ${maxLon}
          AND center_latitude >= ${minLat} AND center_latitude <= ${maxLat}
        )
      )
      ${statusClause}
      ORDER BY last_detected_at DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Mencari cluster lubang terdekat dalam radius tertentu (misal 10-15 meter)
   * Menggunakan ST_DWithin dan ST_Distance dengan casting Geography
   */
  async findNearby(
    lat: number,
    lon: number,
    radiusMeters = 15,
  ): Promise<PotholeClusterEntity | null> {
    const results = await this.db.$queryRaw<PotholeClusterEntity[]>`
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
        updated_at,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(center_longitude, center_latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography
        ) as distance_meters
      FROM pothole_clusters
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(center_longitude, center_latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
      ORDER BY distance_meters ASC
      LIMIT 1
    `;

    return results[0] ?? null;
  }

  /**
   * Detail satu cluster lubang jalan
   */
  async getById(id: string): Promise<PotholeClusterEntity> {
    const results = await this.db.$queryRaw<PotholeClusterEntity[]>`
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
      WHERE id::text = ${id}
      LIMIT 1
    `;

    if (!results.length) {
      throw new NotFoundException(
        `Pothole cluster dengan ID ${id} tidak ditemukan`,
      );
    }

    return results[0];
  }

  /**
   * Update status verifikasi / perbaikan jalan (Admin / Petugas PU)
   */
  async updateStatus(
    id: string,
    dto: UpdateClusterStatusDto,
  ): Promise<PotholeClusterEntity> {
    await this.getById(id);

    const severityClause = dto.severity
      ? Prisma.sql`, severity = ${dto.severity}::pothole_severity`
      : Prisma.empty;

    const [updated] = await this.db.$queryRaw<PotholeClusterEntity[]>`
      UPDATE pothole_clusters
      SET
        status = ${dto.status}::pothole_status
        ${severityClause},
        updated_at = NOW()
      WHERE id::text = ${id}
      RETURNING
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
    `;

    return updated;
  }

  /**
   * Stream / Worker Method: Ingest deteksi baru dan agregasikan langsung ke Cluster
   */
  async aggregateDetection(detection: {
    latitude: number;
    longitude: number;
    confidence: number;
    detectedAt: Date;
  }) {
    try {
      const existing = await this.findNearby(
        detection.latitude,
        detection.longitude,
        15,
      );

      if (existing) {
        const newCount = (existing.detection_count || 1) + 1;
        const newConfidenceAvg =
          (existing.confidence_avg * (existing.detection_count || 1) +
            detection.confidence) /
          newCount;

        await this.db.$executeRaw`
          UPDATE pothole_clusters
          SET
            confidence_avg = ${newConfidenceAvg},
            detection_count = ${newCount},
            last_detected_at = ${detection.detectedAt},
            updated_at = NOW()
          WHERE id::text = ${existing.id}
        `;
        this.logger.log(`Updated pothole cluster: ${existing.id}`);
        return { action: 'updated', clusterId: existing.id };
      } else {
        const [newCluster] = await this.db.$queryRaw<{ id: string }[]>`
          INSERT INTO pothole_clusters (
            center_latitude,
            center_longitude,
            severity,
            confidence_avg,
            detection_count,
            status,
            first_detected_at,
            last_detected_at,
            updated_at
          ) VALUES (
            ${detection.latitude},
            ${detection.longitude},
            'medium'::pothole_severity,
            ${detection.confidence},
            1,
            'active'::pothole_status,
            ${detection.detectedAt},
            ${detection.detectedAt},
            NOW()
          )
          RETURNING id
        `;
        this.logger.log(`Created new pothole cluster: ${newCluster.id}`);
        return { action: 'created', clusterId: newCluster.id };
      }
    } catch (error) {
      this.logger.error('Failed to aggregate detection into cluster', error);
      throw error;
    }
  }
}
