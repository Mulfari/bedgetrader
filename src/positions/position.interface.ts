export interface BybitPosition {
  positionIdx: number;
  riskId: number;
  riskLimitValue: string;
  symbol: string;
  side: string;
  size: string;
  avgPrice: string;
  positionValue: string;
  tradeMode: number;
  positionStatus: string;
  autoAddMargin: number;
  adlRankIndicator: number;
  leverage: string;
  positionBalance: string;
  markPrice: string;
  liqPrice: string;
  bustPrice: string;
  positionMM: string;
  positionIM: string;
  tpslMode: string;
  takeProfit: string;
  stopLoss: string;
  trailingStop: string;
  unrealisedPnl: string;
  curRealisedPnl: string;
  cumRealisedPnl: string;
  createdTime: string;
  updatedTime: string;
}

export interface BybitPositionResponse {
  retCode: number;
  retMsg: string;
  result: {
    list: BybitPosition[];
    nextPageCursor: string;
    category: string;
  };
  retExtInfo: Record<string, any>;
  time: number;
} 