import { Test, TestingModule } from '@nestjs/testing';
import { DetectionController } from './detection.controller';
import { DetectionService } from './detection.service';
import { CreateBatchDetectionDto } from './dto/create-batch-detection.dto';
import { CreateDetectionDto } from './dto/create-detection.dto';

describe('DetectionController', () => {
  let controller: DetectionController;

  const mockDetectionService = {
    create: jest.fn(),
    createBatch: jest.fn(),
    findByDeviceId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DetectionController],
      providers: [
        {
          provide: DetectionService,
          useValue: mockDetectionService,
        },
      ],
    }).compile();

    controller = module.get<DetectionController>(DetectionController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call DetectionService.create with correct DTO', async () => {
      const dto: CreateDetectionDto = {
        deviceId: 'dev-1',
        latitude: -6.2,
        longitude: 106.8,
        confidence: 0.9,
        detectedAt: '2026-09-01T12:00:00.000Z',
      };
      const expectedResult = { id: 'uuid-1', ...dto };
      mockDetectionService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto);

      expect(mockDetectionService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createBatch', () => {
    it('should call DetectionService.createBatch with correct DTO', async () => {
      const dto: CreateBatchDetectionDto = {
        detections: [
          {
            deviceId: 'dev-1',
            latitude: -6.2,
            longitude: 106.8,
            confidence: 0.9,
            detectedAt: '2026-09-01T12:00:00.000Z',
          },
        ],
      };
      mockDetectionService.createBatch.mockResolvedValue({ count: 1 });

      const result = await controller.createBatch(dto);

      expect(mockDetectionService.createBatch).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ count: 1 });
    });
  });

  describe('findByDeviceId', () => {
    it('should call DetectionService.findByDeviceId', async () => {
      const expectedList = [{ id: 'uuid-1', deviceId: 'dev-1' }];
      mockDetectionService.findByDeviceId.mockResolvedValue(expectedList);

      const result = await controller.findByDeviceId('dev-1');

      expect(mockDetectionService.findByDeviceId).toHaveBeenCalledWith('dev-1');
      expect(result).toEqual(expectedList);
    });
  });
});
