import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  providers: [PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {} 