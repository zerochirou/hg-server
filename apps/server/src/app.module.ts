import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth';
import { DbModule } from './db/db.module';
import { DetectionModule } from './detection/detection.module';
import { PotholeClustersModule } from './pothole-clusters/pothole-clusters.module';

@Module({
  imports: [
    DbModule,
    AuthModule.forRoot({
      auth,
      bodyParser: false,
    }),
    DetectionModule,
    PotholeClustersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
