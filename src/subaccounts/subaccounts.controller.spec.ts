import { Test, TestingModule } from '@nestjs/testing';
import { SubaccountsController } from './subaccounts.controller';

describe('SubaccountsController', () => {
  let controller: SubaccountsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubaccountsController],
    }).compile();

    controller = module.get<SubaccountsController>(SubaccountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
