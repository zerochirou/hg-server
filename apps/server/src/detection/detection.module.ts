import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PotholeClustersModule } from '../pothole-clusters/pothole-clusters.module';
import { DetectionController } from './detection.controller';
import { DetectionService } from './detection.service';

@Module({
  imports: [DbModule, PotholeClustersModule],
  controllers: [DetectionController],
  providers: [DetectionService],
  exports: [DetectionService],
})
export class DetectionModule {}
