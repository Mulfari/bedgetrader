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

export interface SpotMarketTicker extends BaseMarketTicker {
  marketType: 'spot';
  bidPrice: string;
  askPrice: string;
}

export interface PerpetualMarketTicker extends BaseMarketTicker {
  marketType: 'perpetual';
  openInterest: string;
  fundingRate: string;
  nextFundingTime: number;
  leverage: string;
  interestRate: {
    long: string;
    short: string;
  };
}

export type MarketTicker = SpotMarketTicker | PerpetualMarketTicker;

export interface MarketWebSocketMessage {
  topic?: string;
  type?: string;
  ts?: number;
  data?: any;
  code?: number;
} 