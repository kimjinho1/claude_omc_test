import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IStockDataSource,
  OHLCVBar,
  StockFundamentals,
  StockQuote,
} from './interfaces/stock-data-source.interface';

interface KisTokenResponse {
  access_token: string;
}

interface KisQuoteOutput {
  stck_prpr: string;
  prdy_vrss: string;
  prdy_ctrt: string;
  acml_vol: string;
}

interface KisQuoteResponse {
  output: KisQuoteOutput;
}

interface KisOhlcvBar {
  stck_bsop_date: string;
  stck_oprc: string;
  stck_hgpr: string;
  stck_lwpr: string;
  stck_clpr: string;
  acml_vol: string;
}

interface KisHistoryResponse {
  output2: KisOhlcvBar[];
}

interface KisFundamentalsOutput {
  per: string;
  pbr: string;
  dvnd_yied: string;
  w52_hgpr: string;
  w52_lwpr: string;
}

interface KisFundamentalsResponse {
  output: KisFundamentalsOutput;
}

/**
 * 한국투자증권 REST API 어댑터
 * Docs: https://apiportal.koreainvestment.com/
 */
@Injectable()
export class KrStockAdapter implements IStockDataSource {
  private readonly logger = new Logger(KrStockAdapter.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly baseUrl = 'https://openapi.koreainvestment.com:9443';

  constructor(private config: ConfigService) {
    this.appKey = config.get<string>('KIS_APP_KEY') || '';
    this.appSecret = config.get<string>('KIS_APP_SECRET') || '';
  }

  private async ensureToken() {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }
    try {
      const res = await fetch(`${this.baseUrl}/oauth2/tokenP`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          appkey: this.appKey,
          appsecret: this.appSecret,
        }),
      });
      const tokenData = (await res.json()) as KisTokenResponse;
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23h
      return this.accessToken;
    } catch (err) {
      this.logger.error('KIS token fetch failed', err);
      return null;
    }
  }

  private async kisGet<T>(
    path: string,
    headers: Record<string, string>,
  ): Promise<T> {
    const token = await this.ensureToken();
    if (!token) throw new Error('KIS auth failed');
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey: this.appKey,
        appsecret: this.appSecret,
        ...headers,
      },
    });
    return (await res.json()) as T;
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    try {
      const data = await this.kisGet<KisQuoteResponse>(
        `/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}`,
        { tr_id: 'FHKST01010100' },
      );
      const output = data.output;
      return {
        symbol,
        price: output.stck_prpr,
        change: output.prdy_vrss,
        changePercent: output.prdy_ctrt,
        volume: parseInt(output.acml_vol),
        timestamp: new Date(),
      };
    } catch (err) {
      this.logger.error(`KIS getQuote failed for ${symbol}`, err);
      return {
        symbol,
        price: '0',
        change: '0',
        changePercent: '0',
        timestamp: new Date(),
      };
    }
  }

  async getHistory(
    symbol: string,
    period: '1d' | '1w' | '1m',
  ): Promise<OHLCVBar[]> {
    const periodCode = period === '1d' ? 'D' : period === '1w' ? 'W' : 'M';
    try {
      const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const data = await this.kisGet<KisHistoryResponse>(
        `/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}&fid_input_date_1=20240101&fid_input_date_2=${endDate}&fid_period_div_code=${periodCode}&fid_org_adj_prc=0`,
        { tr_id: 'FHKST03010100' },
      );
      return (data.output2 || []).map((bar: KisOhlcvBar) => ({
        date: bar.stck_bsop_date,
        open: bar.stck_oprc,
        high: bar.stck_hgpr,
        low: bar.stck_lwpr,
        close: bar.stck_clpr,
        volume: parseInt(bar.acml_vol),
      }));
    } catch (err) {
      this.logger.error(`KIS getHistory failed for ${symbol}`, err);
      return [];
    }
  }

  async getFundamentals(symbol: string): Promise<StockFundamentals> {
    try {
      const data = await this.kisGet<KisFundamentalsResponse>(
        `/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}`,
        { tr_id: 'FHKST01010100' },
      );
      const output = data.output;
      return {
        per: output.per,
        pbr: output.pbr,
        dividendYield: output.dvnd_yied,
        week52High: output.w52_hgpr,
        week52Low: output.w52_lwpr,
      };
    } catch (err) {
      this.logger.error(`KIS getFundamentals failed for ${symbol}`, err);
      return {};
    }
  }
}
