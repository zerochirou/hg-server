import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { PotholeClustersService } from './pothole-clusters.service';

describe('PotholeClustersService', () => {
  let service: PotholeClustersService;

  const mockDb = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PotholeClustersService,
        {
          provide: DbService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<PotholeClustersService>(PotholeClustersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getByBoundingBox', () => {
    it('should query bounding box clusters with PostGIS query', async () => {
      const mockClusters = [
        {
          id: 'uuid-1',
          center_latitude: -6.2088,
          center_longitude: 106.8456,
          severity: 'medium',
          confidence_avg: 0.9,
          detection_count: 1,
          status: 'active',
          first_detected_at: new Date(),
          last_detected_at: new Date(),
          updated_at: new Date(),
        },
      ];
      mockDb.$queryRaw.mockResolvedValue(mockClusters);

      const result = await service.getByBoundingBox({
        minLat: -6.22,
        minLon: 106.83,
        maxLat: -6.2,
        maxLon: 106.86,
        status: 'active',
        limit: 100,
      });

      expect(mockDb.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockClusters);
    });
  });

  describe('findNearby', () => {
    it('should return nearby cluster with distance_meters if found', async () => {
      const mockCluster = {
        id: 'uuid-1',
        center_latitude: -6.2088,
        center_longitude: 106.8456,
        distance_meters: 6.4,
      };
      mockDb.$queryRaw.mockResolvedValue([mockCluster]);

      const result = await service.findNearby(-6.2088, 106.8456, 15);

      expect(mockDb.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockCluster);
    });

    it('should return null if no cluster is found nearby', async () => {
      mockDb.$queryRaw.mockResolvedValue([]);

      const result = await service.findNearby(-6.2088, 106.8456, 15);

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return cluster if exists', async () => {
      const mockCluster = { id: 'uuid-1', center_latitude: -6.2088 };
      mockDb.$queryRaw.mockResolvedValue([mockCluster]);

      const result = await service.getById('uuid-1');

      expect(result).toEqual(mockCluster);
    });

    it('should throw NotFoundException if cluster does not exist', async () => {
      mockDb.$queryRaw.mockResolvedValue([]);

      await expect(service.getById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status and return updated cluster', async () => {
      const existing = { id: 'uuid-1', status: 'active' };
      const updated = { id: 'uuid-1', status: 'verified', severity: 'high' };

      // first call in getById, second call in update
      mockDb.$queryRaw
        .mockResolvedValueOnce([existing])
        .mockResolvedValueOnce([updated]);

      const result = await service.updateStatus('uuid-1', {
        status: 'verified',
        severity: 'high',
      });

      expect(result).toEqual(updated);
    });
  });

  describe('aggregateDetection', () => {
    it('should update existing cluster when nearby cluster exists within radius', async () => {
      const existing = {
        id: 'uuid-1',
        confidence_avg: 0.8,
        detection_count: 1,
        distance_meters: 5,
      };
      // findNearby query return
      mockDb.$queryRaw.mockResolvedValueOnce([existing]);
      mockDb.$executeRaw.mockResolvedValueOnce(1);

      const detection = {
        latitude: -6.20882,
        longitude: 106.84562,
        confidence: 0.9,
        detectedAt: new Date('2026-09-01T12:00:00Z'),
      };

      const result = await service.aggregateDetection(detection);

      expect(mockDb.$executeRaw).toHaveBeenCalled();
      expect(result).toEqual({ action: 'updated', clusterId: 'uuid-1' });
    });

    it('should insert new cluster when no nearby cluster exists', async () => {
      // findNearby query return empty
      mockDb.$queryRaw.mockResolvedValueOnce([]);
      // insert query return newly created id
      mockDb.$queryRaw.mockResolvedValueOnce([{ id: 'new-uuid-1' }]);

      const detection = {
        latitude: -6.2088,
        longitude: 106.8456,
        confidence: 0.85,
        detectedAt: new Date('2026-09-01T12:00:00Z'),
      };

      const result = await service.aggregateDetection(detection);

      expect(result).toEqual({ action: 'created', clusterId: 'new-uuid-1' });
    });
  });
});
