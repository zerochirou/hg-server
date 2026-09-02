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
   * Mengambil semua cluster lubang jalan (dengan bounding box atau all list)
   */
  async getByBoundingBox(
    filter: Partial<BoundingBoxFilterDto> & {
      search?: string;
      severity?: string;
    },
  ): Promise<PotholeClusterEntity[]> {
    const {
      minLon,
      minLat,
      maxLon,
      maxLat,
      status,
      severity,
      limit = 500,
    } = filter;

    const hasBbox =
      minLon !== undefined &&
      !isNaN(minLon) &&
      minLat !== undefined &&
      !isNaN(minLat) &&
      maxLon !== undefined &&
      !isNaN(maxLon) &&
      maxLat !== undefined &&
      !isNaN(maxLat);

    const bboxClause = hasBbox
      ? Prisma.sql`AND (
          center_location && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
          OR (
            center_longitude >= ${minLon} AND center_longitude <= ${maxLon}
            AND center_latitude >= ${minLat} AND center_latitude <= ${maxLat}
          )
        )`
      : Prisma.empty;

    const statusClause = status
      ? Prisma.sql`AND status::text = ${status}`
      : Prisma.empty;

    const severityClause = severity
      ? Prisma.sql`AND severity::text = ${severity}`
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
      WHERE 1=1
      ${bboxClause}
      ${statusClause}
      ${severityClause}
      ORDER BY last_detected_at DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Mencari cluster lubang terdekat dalam radius tertentu (misal 10-15 meter)
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
   * Update detail atribut cluster secara menyeluruh
   */
  async update(
    id: string,
    dto: {
      status?: string;
      severity?: string;
      center_latitude?: number;
      center_longitude?: number;
      detection_count?: number;
      confidence_avg?: number;
    },
  ): Promise<PotholeClusterEntity> {
    const existing = await this.getById(id);

    const lat = dto.center_latitude ?? existing.center_latitude;
    const lon = dto.center_longitude ?? existing.center_longitude;
    const status = dto.status ?? existing.status;
    const severity = dto.severity ?? existing.severity;
    const count = dto.detection_count ?? existing.detection_count;
    const conf = dto.confidence_avg ?? existing.confidence_avg;

    const [updated] = await this.db.$queryRaw<PotholeClusterEntity[]>`
      UPDATE pothole_clusters
      SET
        status = ${status}::pothole_status,
        severity = ${severity}::pothole_severity,
        center_latitude = ${lat},
        center_longitude = ${lon},
        detection_count = ${count},
        confidence_avg = ${conf},
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
   * Hapus cluster pothole
   */
  async delete(id: string): Promise<{ success: boolean; id: string }> {
    await this.getById(id);

    await this.db.$executeRaw`
      DELETE FROM pothole_clusters
      WHERE id::text = ${id}
    `;

    return { success: true, id };
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
          INSERT INTO pothole_clusters (\n            center_latitude,\n            center_longitude,\n            severity,\n            confidence_avg,\n            detection_count,\n            status,\n            first_detected_at,\n            last_detected_at,\n            updated_at\n          ) VALUES (\n            ${detection.latitude},\n            ${detection.longitude},\n            'medium'::pothole_severity,\n            ${detection.confidence},\n            1,\n            'active'::pothole_status,\n            ${detection.detectedAt},\n            ${detection.detectedAt},\n            NOW()\n          )\n          RETURNING id\n        `;
        this.logger.log(`Created new pothole cluster: ${newCluster.id}`);
        return { action: 'created', clusterId: newCluster.id };
      }
    } catch (error) {
      this.logger.error('Failed to aggregate detection into cluster', error);
      throw error;
    }
  }
}
