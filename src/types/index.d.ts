import { SubAccount as PrismaSubAccount } from '@prisma/client';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      JWT_SECRET: string;
      PORT: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export interface SubAccount extends PrismaSubAccount {
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  subAccounts?: SubAccount[];
} 