import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { SpotMarketController } from './spot.controller';
import { SpotMarketService } from './spot.service';

@Module({
  controllers: [MarketController, SpotMarketController],
  providers: [MarketService, SpotMarketService],
  exports: [MarketService, SpotMarketService],
})
export class MarketModule {} 