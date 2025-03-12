import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [PositionsController],
  providers: [PositionsService, PrismaService],
  exports: [PositionsService],
})
export class PositionsModule {} 