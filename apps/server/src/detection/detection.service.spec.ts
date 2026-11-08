import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { PotholeClustersService } from '../pothole-clusters/pothole-clusters.service';
import { DetectionService } from './detection.service';
import { CreateBatchDetectionDto } from './dto/create-batch-detection.dto';
import { CreateDetectionDto } from './dto/create-detection.dto';

describe('DetectionService', () => {
  let service: DetectionService;

  const mockDb = {
    detection: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockClustersService = {
    aggregateDetection: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetectionService,
        {
          provide: DbService,
          useValue: mockDb,
        },
        {
          provide: PotholeClustersService,
          useValue: mockClustersService,
        },
      ],
    }).compile();

    service = module.get<DetectionService>(DetectionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should save detection and trigger aggregateDetection', async () => {
      const dto: CreateDetectionDto = {
        deviceId: 'dev-1',
        latitude: -6.2088,
        longitude: 106.8456,
        confidence: 0.9,
        speedKmh: 40,
        zAccelPeak: 3.5,
        modelVersion: 'v1',
        detectedAt: '2026-09-01T12:00:00.000Z',
      };

      const createdDetection = {
        id: 'uuid-1',
        ...dto,
        detectedAt: new Date(dto.detectedAt),
      };
      mockDb.detection.create.mockResolvedValue(createdDetection);
      mockClustersService.aggregateDetection.mockResolvedValue({
        action: 'created',
        clusterId: 'c-1',
      });

      const result = await service.create(dto);

      expect(mockDb.detection.create).toHaveBeenCalledWith({
        data: {
          deviceId: dto.deviceId,
          userId: null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          confidence: dto.confidence,
          speedKmh: dto.speedKmh,
          zAccelPeak: dto.zAccelPeak,
          modelVersion: dto.modelVersion,
          detectedAt: new Date(dto.detectedAt),
        },
      });

      expect(mockClustersService.aggregateDetection).toHaveBeenCalledWith({
        latitude: dto.latitude,
        longitude: dto.longitude,
        confidence: dto.confidence,
        zAccelPeak: dto.zAccelPeak,
        detectedAt: new Date(dto.detectedAt),
      });

      expect(result).toEqual(createdDetection);
    });
  });

  describe('createBatch', () => {
    it('should save multiple detections and trigger aggregateDetection for each item', async () => {
      const dto: CreateBatchDetectionDto = {
        detections: [
          {
            deviceId: 'dev-1',
            latitude: -6.2088,
            longitude: 106.8456,
            confidence: 0.9,
            detectedAt: '2026-09-01T12:00:00.000Z',
          },
          {
            deviceId: 'dev-2',
            latitude: -6.2089,
            longitude: 106.8457,
            confidence: 0.85,
            detectedAt: '2026-09-01T12:00:05.000Z',
          },
        ],
      };

      mockDb.detection.createMany.mockResolvedValue({ count: 2 });
      mockClustersService.aggregateDetection.mockResolvedValue({
        action: 'created',
        clusterId: 'c-1',
      });

      const result = await service.createBatch(dto);

      expect(mockDb.detection.createMany).toHaveBeenCalledTimes(1);
      expect(mockClustersService.aggregateDetection).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ count: 2 });
    });
  });

  describe('findByDeviceId', () => {
    it('should query detections by deviceId with limit', async () => {
      const mockList = [{ id: 'uuid-1', deviceId: 'dev-1' }];
      mockDb.detection.findMany.mockResolvedValue(mockList);

      const result = await service.findByDeviceId('dev-1', 20);

      expect(mockDb.detection.findMany).toHaveBeenCalledWith({
        where: { deviceId: 'dev-1' },
        orderBy: { detectedAt: 'desc' },
        take: 20,
      });
      expect(result).toEqual(mockList);
    });
  });
});
