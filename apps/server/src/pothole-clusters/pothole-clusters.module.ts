import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PotholeClustersController } from './pothole-clusters.controller';
import { PotholeClustersService } from './pothole-clusters.service';

@Module({
  imports: [DbModule],
  controllers: [PotholeClustersController],
  providers: [PotholeClustersService],
  exports: [PotholeClustersService],
})
export class PotholeClustersModule {}
