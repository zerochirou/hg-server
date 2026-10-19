import { Test, TestingModule } from '@nestjs/testing';
import type { UserSession } from '@thallesp/nestjs-better-auth';
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
    findAll: jest.fn(),
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

  describe('Role & User Data Isolation', () => {
    it('should assign authenticated user ID to detection when creating', async () => {
      const dto: CreateDetectionDto = {
        deviceId: 'dev-1',
        latitude: -6.2,
        longitude: 106.8,
        confidence: 0.9,
        detectedAt: '2026-09-01T12:00:00.000Z',
      };
      const mockSession = {
        session: {
          id: 's1',
          userId: 'user-123',
          token: 'tok',
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        user: {
          id: 'user-123',
          email: 'u@test.com',
          emailVerified: true,
          name: 'User',
          createdAt: new Date(),
          updatedAt: new Date(),
          role: 'user',
        },
      } as unknown as UserSession;
      mockDetectionService.create.mockImplementation((d: CreateDetectionDto) =>
        Promise.resolve({ id: 'uuid-1', ...d }),
      );

      const result = await controller.create(dto, mockSession);
      expect(dto.userId).toBe('user-123');
      expect(result.userId).toBe('user-123');
    });

    it('should scope findAll to session.user.id for regular users', async () => {
      mockDetectionService.findAll = jest.fn().mockResolvedValue([]);
      const regularSession = {
        session: {
          id: 's2',
          userId: 'user-abc',
          token: 'tok',
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        user: {
          id: 'user-abc',
          email: 'u@test.com',
          emailVerified: true,
          name: 'User',
          createdAt: new Date(),
          updatedAt: new Date(),
          role: 'user',
        },
      } as unknown as UserSession;

      await controller.findAll(
        '10',
        undefined,
        undefined,
        'user-xyz',
        regularSession,
      );

      expect(mockDetectionService.findAll).toHaveBeenCalledWith({
        limit: 10,
        search: undefined,
        deviceId: undefined,
        userId: 'user-abc', // Scoped to user-abc, NOT user-xyz!
      });
    });

    it('should allow admin to query detections across all users or filter by userId', async () => {
      mockDetectionService.findAll = jest.fn().mockResolvedValue([]);
      const adminSession = {
        session: {
          id: 's3',
          userId: 'admin-1',
          token: 'tok',
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        user: {
          id: 'admin-1',
          email: 'a@test.com',
          emailVerified: true,
          name: 'Admin',
          createdAt: new Date(),
          updatedAt: new Date(),
          role: 'admin',
        },
      } as unknown as UserSession;

      await controller.findAll(
        '10',
        undefined,
        undefined,
        'user-xyz',
        adminSession,
      );

      expect(mockDetectionService.findAll).toHaveBeenCalledWith({
        limit: 10,
        search: undefined,
        deviceId: undefined,
        userId: 'user-xyz', // Admin can query requested userId
      });
    });

    it('should prevent unauthenticated callers from reading other users data', async () => {
      mockDetectionService.findAll = jest.fn().mockResolvedValue([]);

      await controller.findAll(
        '10',
        undefined,
        undefined,
        'user-target',
        undefined,
      );

      expect(mockDetectionService.findAll).toHaveBeenCalledWith({
        limit: 10,
        search: undefined,
        deviceId: undefined,
        userId: 'unauthorized_guest_target',
      });
    });
  });
});
