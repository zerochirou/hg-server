import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PotholeClustersService } from '../pothole-clusters/pothole-clusters.service';
import { CreateBatchDetectionDto } from './dto/create-batch-detection.dto';
import { CreateDetectionDto } from './dto/create-detection.dto';

@Injectable()
export class DetectionService {
  constructor(
    private readonly db: DbService,
    private readonly clustersService: PotholeClustersService,
  ) {}

  /**
   * Menyimpan satu data deteksi dari client dan otomatis meng-clusterkan ke PostGIS
   */
  async create(dto: CreateDetectionDto) {
    const detectedAtDate = new Date(dto.detectedAt);

    // 1. Simpan raw data deteksi
    const detection = await this.db.detection.create({
      data: {
        deviceId: dto.deviceId,
        userId: dto.userId ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        confidence: dto.confidence,
        speedKmh: dto.speedKmh ?? null,
        zAccelPeak: dto.zAccelPeak ?? null,
        modelVersion: dto.modelVersion ?? 'v1',
        detectedAt: detectedAtDate,
      },
    });

    // 2. Agregasikan langsung ke tabel pothole_clusters (Spatial Online Clustering)
    await this.clustersService.aggregateDetection({
      latitude: dto.latitude,
      longitude: dto.longitude,
      confidence: dto.confidence,
      detectedAt: detectedAtDate,
    });

    return detection;
  }

  /**
   * Menyimpan data deteksi secara batch (massal) dari client dan meng-clusterkan
   */
  async createBatch(dto: CreateBatchDetectionDto) {
    const data = dto.detections.map((item) => ({
      deviceId: item.deviceId,
      userId: item.userId ?? null,
      latitude: item.latitude,
      longitude: item.longitude,
      confidence: item.confidence,
      speedKmh: item.speedKmh ?? null,
      zAccelPeak: item.zAccelPeak ?? null,
      modelVersion: item.modelVersion ?? 'v1',
      detectedAt: new Date(item.detectedAt),
    }));

    // 1. Simpan raw data secara batch
    const result = await this.db.detection.createMany({
      data,
    });

    // 2. Agregasikan setiap titik deteksi ke pothole_clusters
    for (const item of dto.detections) {
      await this.clustersService.aggregateDetection({
        latitude: item.latitude,
        longitude: item.longitude,
        confidence: item.confidence,
        detectedAt: new Date(item.detectedAt),
      });
    }

    return result;
  }

  /**
   * Mengambil semua raw deteksi pothole
   */
  async findAll(query?: {
    limit?: number;
    search?: string;
    deviceId?: string;
  }) {
    const { limit = 100, search, deviceId } = query || {};

    return this.db.detection.findMany({
      where: {
        ...(deviceId ? { deviceId } : {}),
        ...(search
          ? {
              OR: [
                { deviceId: { contains: search, mode: 'insensitive' } },
                { modelVersion: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Detail satu data deteksi
   */
  async findById(id: string) {
    const detection = await this.db.detection.findUnique({
      where: { id },
    });

    if (!detection) {
      throw new NotFoundException(`Detection dengan ID ${id} tidak ditemukan`);
    }

    return detection;
  }

  /**
   * Mengambil riwayat deteksi berdasarkan deviceId
   */
  async findByDeviceId(deviceId: string, limit = 50) {
    return this.db.detection.findMany({
      where: { deviceId },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update data raw deteksi pothole
   */
  async update(
    id: string,
    dto: {
      confidence?: number;
      speedKmh?: number;
      zAccelPeak?: number;
      modelVersion?: string;
      deviceId?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    await this.findById(id);

    return this.db.detection.update({
      where: { id },
      data: {
        ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}),
        ...(dto.speedKmh !== undefined ? { speedKmh: dto.speedKmh } : {}),
        ...(dto.zAccelPeak !== undefined ? { zAccelPeak: dto.zAccelPeak } : {}),
        ...(dto.modelVersion !== undefined
          ? { modelVersion: dto.modelVersion }
          : {}),
        ...(dto.deviceId !== undefined ? { deviceId: dto.deviceId } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      },
    });
  }

  /**
   * Hapus data raw deteksi pothole
   */
  async delete(id: string) {
    await this.findById(id);
    return this.db.detection.delete({
      where: { id },
    });
  }
}
