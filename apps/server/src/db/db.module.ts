import { Module } from '@nestjs/common';
import { DbService, prisma } from './db.service';

@Module({
  providers: [
    {
      provide: DbService,
      useValue: prisma,
    },
  ],
  exports: [DbService],
})
export class DbModule {}
