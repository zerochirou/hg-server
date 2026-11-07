import { Test, TestingModule } from '@nestjs/testing';
import { DbscanClusteringService } from './dbscan-clustering.service';
import { PotholeClustersController } from './pothole-clusters.controller';
import { PotholeClustersService } from './pothole-clusters.service';

describe('PotholeClustersController', () => {
  let controller: PotholeClustersController;

  const mockPotholeClustersService = {
    getByBoundingBox: jest.fn(),
    findNearby: jest.fn(),
    getById: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockDbscanClusteringService = {
    consolidateDetections: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PotholeClustersController],
      providers: [
        {
          provide: PotholeClustersService,
          useValue: mockPotholeClustersService,
        },
        {
          provide: DbscanClusteringService,
          useValue: mockDbscanClusteringService,
        },
      ],
    }).compile();

    controller = module.get<PotholeClustersController>(
      PotholeClustersController,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getByBoundingBox', () => {
    it('should parse query params and call getByBoundingBox', async () => {
      const mockResult = [
        { id: 'uuid-1', center_latitude: -6.2, center_longitude: 106.8 },
      ];
      mockPotholeClustersService.getByBoundingBox.mockResolvedValue(mockResult);

      const result = await controller.getByBoundingBox(
        '-6.22',
        '106.83',
        '-6.20',
        '106.86',
        'active',
        '100',
      );

      expect(mockPotholeClustersService.getByBoundingBox).toHaveBeenCalledWith({
        minLat: -6.22,
        minLon: 106.83,
        maxLat: -6.2,
        maxLon: 106.86,
        status: 'active',
        limit: 100,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('findNearby', () => {
    it('should call findNearby with default or provided radius', async () => {
      const mockResult = { id: 'uuid-1', distance_meters: 5.2 };
      mockPotholeClustersService.findNearby.mockResolvedValue(mockResult);

      const result = await controller.findNearby('-6.2088', '106.8456', '25');

      expect(mockPotholeClustersService.findNearby).toHaveBeenCalledWith(
        -6.2088,
        106.8456,
        25,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getById', () => {
    it('should call getById with string UUID', async () => {
      const mockResult = { id: 'uuid-1' };
      mockPotholeClustersService.getById.mockResolvedValue(mockResult);

      const result = await controller.getById('uuid-1');

      expect(mockPotholeClustersService.getById).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateStatus', () => {
    it('should call updateStatus with id and dto', async () => {
      const dto = { status: 'verified' as const, severity: 'high' as const };
      const mockResult = { id: 'uuid-1', ...dto };
      mockPotholeClustersService.updateStatus.mockResolvedValue(mockResult);

      const result = await controller.updateStatus('uuid-1', dto);

      expect(mockPotholeClustersService.updateStatus).toHaveBeenCalledWith(
        'uuid-1',
        dto,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getDbscanClusters', () => {
    it('should call consolidateDetections on dbscanService and return consolidated clusters and heatmap', async () => {
      const mockDbscanResponse = {
        clusters: [
          {
            id: 'dbscan_1',
            center_latitude: -6.2088,
            center_longitude: 106.8456,
            severity: 'high',
            confidence_avg: 0.95,
            detection_count: 5,
            user_count: 3,
            status: 'active',
            first_detected_at: new Date(),
            last_detected_at: new Date(),
            updated_at: new Date(),
            radius_meters: 15,
            points: [],
          },
        ],
        heatmap: [[-6.2088, 106.8456, 0.9]],
        total_detections: 5,
        total_clusters: 1,
        generated_at: new Date().toISOString(),
      };

      mockDbscanClusteringService.consolidateDetections.mockResolvedValue(
        mockDbscanResponse,
      );

      const result = await controller.getDbscanClusters('25', '1');

      expect(
        mockDbscanClusteringService.consolidateDetections,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          epsMeters: 25,
          minPts: 1,
        }),
      );
      expect(result).toEqual(mockDbscanResponse);
    });
  });
});
