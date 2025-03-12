export interface BybitClosedPosition {
  symbol: string;
  orderType: string;
  leverage: string;
  updatedTime: string;
  side: string;
  orderId: string;
  closedPnl: string;
  avgEntryPrice: string;
  qty: string;
  cumEntryValue: string;
  createdTime: string;
  orderPrice: string;
  closedSize: string;
  avgExitPrice: string;
  execType: string;
  fillCount: string;
  cumExitValue: string;
}

export interface BybitClosedPositionResponse {
  retCode: number;
  retMsg: string;
  result: {
    list: BybitClosedPosition[];
    nextPageCursor: string;
    category: string;
  };
  retExtInfo: Record<string, any>;
  time: number;
} 