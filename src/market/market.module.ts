import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { SpotMarketController } from './spot.controller';
import { SpotMarketService } from './spot.service';
import { PerpetualMarketController } from './perpetual.controller';
import { PerpetualMarketService } from './perpetual.service';

@Module({
  controllers: [MarketController, SpotMarketController, PerpetualMarketController],
  providers: [MarketService, SpotMarketService, PerpetualMarketService],
  exports: [MarketService, SpotMarketService, PerpetualMarketService],
})
export class MarketModule {} 