import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
  ],
  providers: [PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {} 