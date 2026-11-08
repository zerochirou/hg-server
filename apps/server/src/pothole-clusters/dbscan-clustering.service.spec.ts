import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import {
  calculatePhysicalSeverity,
  DbscanClusteringService,
  haversineDistanceMeters,
} from './dbscan-clustering.service';

describe('DbscanClusteringService', () => {
  let service: DbscanClusteringService;

  const mockDb = {
    detection: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbscanClusteringService,
        {
          provide: DbService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<DbscanClusteringService>(DbscanClusteringService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('haversineDistanceMeters', () => {
    it('should calculate distance correctly between two points', () => {
      // Coordinate Jakarta: Monas (-6.1754, 106.8272) to Bundaran HI (-6.1950, 106.8230) ~ 2.2 km
      const dist = haversineDistanceMeters(-6.1754, 106.8272, -6.195, 106.823);
      expect(dist).toBeGreaterThan(2100);
      expect(dist).toBeLessThan(2300);
    });

    it('should return 0 for identical points', () => {
      const dist = haversineDistanceMeters(
        -6.2088,
        106.8456,
        -6.2088,
        106.8456,
      );
      expect(dist).toBe(0);
    });
  });

  describe('consolidateDetections', () => {
    it('should consolidate nearby multi-user detections into 1 single cluster and output heatmap', async () => {
      // 3 detections from 2 different users in ~10m proximity (Sudirman)
      const mockDetections = [
        {
          id: 'det-1',
          latitude: -6.2088,
          longitude: 106.8456,
          confidence: 0.92,
          speedKmh: 35.0,
          zAccelPeak: 2.6,
          deviceId: 'device-A',
          userId: 'user-A',
          detectedAt: new Date('2026-11-01T10:00:00Z'),
        },
        {
          id: 'det-2',
          latitude: -6.20885, // ~6m away
          longitude: 106.84563,
          confidence: 0.88,
          speedKmh: 40.0,
          zAccelPeak: 1.9,
          deviceId: 'device-B',
          userId: 'user-B',
          detectedAt: new Date('2026-11-01T11:00:00Z'),
        },
        {
          id: 'det-3',
          latitude: -6.20882, // ~3m away
          longitude: 106.84561,
          confidence: 0.95,
          speedKmh: 32.0,
          zAccelPeak: 2.1,
          deviceId: 'device-C',
          userId: 'user-C',
          detectedAt: new Date('2026-11-01T12:00:00Z'),
        },
        // Isolated detection far away (Kuningan ~ 2km)
        {
          id: 'det-4',
          latitude: -6.225,
          longitude: 106.83,
          confidence: 0.85,
          speedKmh: 28.0,
          zAccelPeak: 1.3,
          deviceId: 'device-A',
          userId: 'user-A',
          detectedAt: new Date('2026-11-01T13:00:00Z'),
        },
      ];

      mockDb.detection.findMany.mockResolvedValue(mockDetections);

      const result = await service.consolidateDetections({
        epsMeters: 25,
        minPts: 1,
      });

      expect(result.total_detections).toBe(4);
      // Sudirman group (det-1, det-2, det-3) -> Cluster 1 (count: 3, 3 users)
      // Kuningan (det-4) -> Cluster 2 (count: 1)
      expect(result.clusters.length).toBe(2);

      const cluster1 = result.clusters.find((c) => c.detection_count === 3);
      expect(cluster1).toBeDefined();
      expect(cluster1?.user_count).toBe(3);
      expect(cluster1?.severity).toBe('severe'); // zAccelPeak >= 2.5
      expect(cluster1?.points.length).toBe(3);

      // Heatmap should contain points for all detections plus weighted centroids
      expect(result.heatmap.length).toBeGreaterThanOrEqual(4);
    });

    it('should default to 100m epsMeters when not specified', async () => {
      // 2 points ~80 meters apart (should be merged under 100m eps)
      const mockDetections = [
        {
          id: 'det-a',
          latitude: -6.2088,
          longitude: 106.8456,
          confidence: 0.9,
          speedKmh: 30.0,
          zAccelPeak: 2.0,
          deviceId: 'dev-1',
          userId: 'u1',
          detectedAt: new Date('2026-11-01T10:00:00Z'),
        },
        {
          id: 'det-b',
          latitude: -6.2082, // ~67 meters north
          longitude: 106.8456,
          confidence: 0.88,
          speedKmh: 30.0,
          zAccelPeak: 1.5,
          deviceId: 'dev-2',
          userId: 'u2',
          detectedAt: new Date('2026-11-01T10:05:00Z'),
        },
      ];

      mockDb.detection.findMany.mockResolvedValue(mockDetections);

      const result = await service.consolidateDetections();
      expect(result.clusters.length).toBe(1);
      expect(result.clusters[0].detection_count).toBe(2);
    });
  });

  describe('calculatePhysicalSeverity', () => {
    it('should adapt severity thresholds dynamically per vehicle type', () => {
      // Car: severe >= 2.2, high >= 1.6, medium >= 1.1
      expect(calculatePhysicalSeverity(2.25, 'car')).toBe('severe');
      expect(calculatePhysicalSeverity(1.7, 'car')).toBe('high');
      expect(calculatePhysicalSeverity(1.15, 'car')).toBe('medium');
      expect(calculatePhysicalSeverity(0.9, 'car')).toBe('low');

      // Motor: severe >= 2.8, high >= 2.0, medium >= 1.45
      expect(calculatePhysicalSeverity(2.25, 'motor')).toBe('high'); // In car 2.25 is severe, but in motor it is high!
      expect(calculatePhysicalSeverity(2.85, 'motor')).toBe('severe');
      expect(calculatePhysicalSeverity(1.5, 'motor')).toBe('medium');
      expect(calculatePhysicalSeverity(1.2, 'motor')).toBe('low');

      // Bicycle: severe >= 2.3, high >= 1.7, medium >= 1.15
      expect(calculatePhysicalSeverity(2.35, 'bicycle')).toBe('severe');
      expect(calculatePhysicalSeverity(1.8, 'bicycle')).toBe('high');
      expect(calculatePhysicalSeverity(1.2, 'bicycle')).toBe('medium');
      expect(calculatePhysicalSeverity(1.0, 'bicycle')).toBe('low');

      // Default (no vehicle specified)
      expect(calculatePhysicalSeverity(2.6)).toBe('severe');
      expect(calculatePhysicalSeverity(1.9)).toBe('high');
      expect(calculatePhysicalSeverity(1.3)).toBe('medium');
      expect(calculatePhysicalSeverity(1.0)).toBe('low');
    });
  });
});
