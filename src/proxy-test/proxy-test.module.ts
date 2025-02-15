import { Module } from '@nestjs/common';
import { ProxyTestController } from './proxy-test.controller';

@Module({
  controllers: [ProxyTestController],
})
export class ProxyTestModule {}
