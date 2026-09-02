import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { PotholeClustersService } from './pothole-clusters.service';
import { UpdateClusterStatusDto } from './dto/update-cluster-status.dto';

@Controller('pothole-clusters')
export class PotholeClustersController {
  constructor(private readonly clustersService: PotholeClustersService) {}

  /**
   * Endpoint Viewport Map / List All:
   * GET /pothole-clusters?minLat=-6.21&minLon=106.84&maxLat=-6.20&maxLon=106.85&status=active
   */
  @Get()
  async getByBoundingBox(
    @Query('minLat') minLat?: string,
    @Query('minLon') minLon?: string,
    @Query('maxLat') maxLat?: string,
    @Query('maxLon') maxLon?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('severity') severity?: string,
  ) {
    return this.clustersService.getByBoundingBox({
      minLat: minLat ? parseFloat(minLat) : undefined,
      minLon: minLon ? parseFloat(minLon) : undefined,
      maxLat: maxLat ? parseFloat(maxLat) : undefined,
      maxLon: maxLon ? parseFloat(maxLon) : undefined,
      status,
      severity,
      limit: limit ? parseInt(limit, 10) : 500,
    });
  }

  /**
   * Endpoint Cek Lubang Terdekat dari GPS Pengemudi:
   * GET /pothole-clusters/nearby?lat=-6.2088&lon=106.8456&radius=20
   */
  @Get('nearby')
  async findNearby(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Query('radius') radius?: string,
  ) {
    return this.clustersService.findNearby(
      parseFloat(lat),
      parseFloat(lon),
      radius ? parseFloat(radius) : 15,
    );
  }

  /**
   * GET /pothole-clusters/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.clustersService.getById(id);
  }

  /**
   * PATCH /pothole-clusters/:id/status (Verifikasi / Perbaikan)
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateClusterStatusDto,
  ) {
    return this.clustersService.updateStatus(id, dto);
  }

  /**
   * PATCH /pothole-clusters/:id (Full Edit)
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    dto: {
      status?: string;
      severity?: string;
      center_latitude?: number;
      center_longitude?: number;
      detection_count?: number;
      confidence_avg?: number;
    },
  ) {
    return this.clustersService.update(id, dto);
  }

  /**
   * DELETE /pothole-clusters/:id
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.clustersService.delete(id);
  }
}
