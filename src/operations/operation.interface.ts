export interface Operation {
  id: string;
  subAccountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  status: 'open' | 'closed' | 'canceled';
  price: number;
  quantity: number;
  filledQuantity?: number;
  remainingQuantity?: number;
  leverage?: number;
  openTime: Date;
  closeTime?: Date;
  profit?: number;
  profitPercentage?: number;
  fee?: number;
  exchange: string;
  isDemo: boolean;
}

export interface OpenOperationsResponse {
  success: boolean;
  operations: Operation[];
  totalCount: number;
  message?: string;
} 