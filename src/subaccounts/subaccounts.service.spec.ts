import { Test, TestingModule } from '@nestjs/testing';
import { SubaccountsService } from './subaccounts.service';

describe('SubaccountsService', () => {
  let service: SubaccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubaccountsService],
    }).compile();

    service = module.get<SubaccountsService>(SubaccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
