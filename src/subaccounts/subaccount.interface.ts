export interface SubAccount {
  id: string;
  userId: string;
  exchange: string;
  apiKey: string;
  secretKey: string;
  name: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
} 