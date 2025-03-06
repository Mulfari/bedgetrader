export interface MarketTicker {
  symbol: string;
  price: string;
  indexPrice: string;
  change: string;
  volume: string;
  high24h: string;
  low24h: string;
  volumeUSDT: string;
  openInterest: string;
  fundingRate: string;
  nextFundingTime: number;
  leverage: string;
  favorite: boolean;
  interestRate: {
    long: string;
    short: string;
  };
}

export interface MarketWebSocketMessage {
  topic?: string;
  type?: string;
  data: any;
  ts?: number;
  code?: number;
} 