export interface BaseMarketTicker {
  symbol: string;
  price: string;
  indexPrice: string;
  change: string;
  volume: string;
  high24h: string;
  low24h: string;
  volumeUSDT: string;
  favorite: boolean;
}

export interface SpotMarketTicker {
  symbol: string;
  price: string;
  indexPrice: string;
  change: string;
  volume: string;
  high24h: string;
  low24h: string;
  volumeUSDT: string;
  marketType: 'spot';
  bidPrice: string;
  askPrice: string;
  favorite: boolean;
}

export interface PerpetualMarketTicker extends BaseMarketTicker {
  marketType: 'perpetual';
  openInterest: string;
  fundingRate: string;
  nextFundingTime: number;
  fundingRateTimestamp?: number;
  leverage: string;
  markPrice: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
}

export type MarketTicker = SpotMarketTicker | PerpetualMarketTicker;

export interface MarketWebSocketMessage {
  topic?: string;
  type?: string;
  ts?: number;
  data?: any;
  code?: number;
  op?: string;
  req_id?: string;
} 