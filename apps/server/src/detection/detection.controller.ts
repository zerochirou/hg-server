import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DetectionService } from './detection.service';
import { CreateBatchDetectionDto } from './dto/create-batch-detection.dto';
import { CreateDetectionDto } from './dto/create-detection.dto';

@Controller('detections')
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDetectionDto: CreateDetectionDto) {
    return this.detectionService.create(createDetectionDto);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(@Body() createBatchDetectionDto: CreateBatchDetectionDto) {
    return this.detectionService.createBatch(createBatchDetectionDto);
  }

  @Get()
  async findAll(
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.detectionService.findAll({
      limit: limit ? parseInt(limit, 10) : 100,
      search,
      deviceId,
    });
  }

  @Get('device/:deviceId')
  async findByDeviceId(@Param('deviceId') deviceId: string) {
    return this.detectionService.findByDeviceId(deviceId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.detectionService.findById(id);
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
  ) {
    return this.detectionService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.detectionService.delete(id);
  }
}
