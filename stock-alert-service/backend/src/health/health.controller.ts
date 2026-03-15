import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '../redis/redis.decorator';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
    @InjectRedis() private redis: Redis,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    const dbOk = await this.prismaHealth.pingCheck('database', this.prisma);
    const redisPing = await this.redis.ping();
    return {
      status: 'ok',
      database: dbOk,
      redis: redisPing === 'PONG' ? 'ok' : 'error',
    };
  }
}
