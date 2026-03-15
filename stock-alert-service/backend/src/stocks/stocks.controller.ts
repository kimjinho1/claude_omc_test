import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StocksService } from './stocks.service';

@Controller('stocks')
@UseGuards(JwtAuthGuard)
export class StocksController {
  constructor(private stocksService: StocksService) {}

  @Get()
  findAll(@Query('market') market?: string) {
    return this.stocksService.findAll(market);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.stocksService.search(q || '');
  }

  @Get(':symbol')
  getDetail(@Param('symbol') symbol: string) {
    return this.stocksService.getDetail(symbol);
  }

  @Get(':symbol/chart')
  getChart(
    @Param('symbol') symbol: string,
    @Query('period') period: '1d' | '1w' | '1m' | '3m' | '1y' = '1m',
  ) {
    return this.stocksService.getChart(symbol, period);
  }

  @Get(':symbol/quote')
  getQuote(@Param('symbol') symbol: string) {
    return this.stocksService.getQuote(symbol);
  }
}
