import { Module } from '@nestjs/common';
import { KrStockAdapter } from './kr-stock.adapter';
import { UsStockAdapter } from './us-stock.adapter';

@Module({
  providers: [KrStockAdapter, UsStockAdapter],
  exports: [KrStockAdapter, UsStockAdapter],
})
export class DataSourcesModule {}
