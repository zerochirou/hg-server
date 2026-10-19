import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OptionalAuth, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { DetectionService } from './detection.service';
import { CreateBatchDetectionDto } from './dto/create-batch-detection.dto';
import { CreateDetectionDto } from './dto/create-detection.dto';

@OptionalAuth()
@Controller('detections')
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDetectionDto: CreateDetectionDto,
    @Session() session?: UserSession,
  ) {
    if (session?.user?.id) {
      const isAdmin = session.user.role === 'admin';
      if (!isAdmin || !createDetectionDto.userId) {
        createDetectionDto.userId = session.user.id;
      }
    }
    return this.detectionService.create(createDetectionDto);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(
    @Body() createBatchDetectionDto: CreateBatchDetectionDto,
    @Session() session?: UserSession,
  ) {
    if (session?.user?.id) {
      const isAdmin = session.user.role === 'admin';
      for (const det of createBatchDetectionDto.detections) {
        if (!isAdmin || !det.userId) {
          det.userId = session.user.id;
        }
      }
    }
    return this.detectionService.createBatch(createBatchDetectionDto);
  }

  @Get()
  async findAll(
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('deviceId') deviceId?: string,
    @Query('userId') userId?: string,
    @Session() session?: UserSession,
  ) {
    const isAdmin = session?.user?.role === 'admin';
    let targetUserId: string | undefined = undefined;

    if (session?.user?.id) {
      if (isAdmin) {
        targetUserId = userId;
      } else {
        // Enforce user isolation: regular user can only view their own detections
        targetUserId = session.user.id;
      }
    } else if (deviceId) {
      // Unauthenticated caller can query by their deviceId
      targetUserId = undefined;
    } else if (userId) {
      // Unauthenticated caller cannot query private user detections
      targetUserId = 'unauthorized_guest_target';
    }

    return this.detectionService.findAll({
      limit: limit ? parseInt(limit, 10) : 100,
      search,
      deviceId,
      userId: targetUserId,
    });
  }

  @Get('device/:deviceId')
  async findByDeviceId(
    @Param('deviceId') deviceId: string,
    @Session() session?: UserSession,
  ) {
    const isAdmin = session?.user?.role === 'admin';
    const userId = !isAdmin && session?.user?.id ? session.user.id : undefined;
    if (userId) {
      return this.detectionService.findByDeviceId(deviceId, 50, userId);
    }
    return this.detectionService.findByDeviceId(deviceId);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Session() session?: UserSession) {
    const detection = await this.detectionService.findById(id);
    const isAdmin = session?.user?.role === 'admin';
    if (
      session?.user?.id &&
      !isAdmin &&
      detection.userId &&
      detection.userId !== session.user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this detection',
      );
    }
    return detection;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    dto: {
      confidence?: number;
      speedKmh?: number;
      zAccelPeak?: number;
      modelVersion?: string;
      deviceId?: string;
      latitude?: number;
      longitude?: number;
    },
    @Session() session?: UserSession,
  ) {
    const existing = await this.detectionService.findById(id);
    const isAdmin = session?.user?.role === 'admin';
    if (
      session?.user?.id &&
      !isAdmin &&
      existing.userId &&
      existing.userId !== session.user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to modify this detection',
      );
    }
    return this.detectionService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Session() session?: UserSession) {
    const existing = await this.detectionService.findById(id);
    const isAdmin = session?.user?.role === 'admin';
    if (
      session?.user?.id &&
      !isAdmin &&
      existing.userId &&
      existing.userId !== session.user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to delete this detection',
      );
    }
    return this.detectionService.delete(id);
  }
}
