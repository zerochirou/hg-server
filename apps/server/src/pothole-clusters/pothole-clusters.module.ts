import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { DbscanClusteringService } from './dbscan-clustering.service';
import { PotholeClustersController } from './pothole-clusters.controller';
import { PotholeClustersService } from './pothole-clusters.service';

@Module({
  imports: [DbModule],
  controllers: [PotholeClustersController],
  providers: [PotholeClustersService, DbscanClusteringService],
  exports: [PotholeClustersService, DbscanClusteringService],
})
export class PotholeClustersModule {}
