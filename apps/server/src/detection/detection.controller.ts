import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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

  @Get('device/:deviceId')
  async findByDeviceId(@Param('deviceId') deviceId: string) {
    return this.detectionService.findByDeviceId(deviceId);
  }
}
