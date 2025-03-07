import { Module } from '@nestjs/common';
import { SpotMarketService } from './spot.service';
import { SpotMarketController } from './spot.controller';

@Module({
  controllers: [SpotMarketController],
  providers: [SpotMarketService],
  exports: [SpotMarketService],
})
export class MarketModule {} 