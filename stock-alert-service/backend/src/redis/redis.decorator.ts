import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.module';

export const InjectRedis = () => Inject(REDIS_CLIENT);
