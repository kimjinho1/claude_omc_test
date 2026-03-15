import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import {
  Controller,
  Post,
  Delete,
  Put,
  Body,
  Get,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import request from 'supertest';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Application } from 'express';

const TEST_SECRET = 'notifications-test-secret';
const MOCK_USER = { id: 'user-notify-1', email: 'notify@test.com' };

// In-memory store for testing
const subscriptions: Record<string, object[]> = {};
const alertSettings: Record<string, number[]> = {};

@Controller()
class TestNotificationsController {
  @Post('notifications/subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@CurrentUser() user: { id: string }, @Body() body: object) {
    if (!subscriptions[user.id]) subscriptions[user.id] = [];
    subscriptions[user.id].push(body);
    return { ok: true };
  }

  @Delete('notifications/unsubscribe')
  @UseGuards(JwtAuthGuard)
  unsubscribe(
    @CurrentUser() user: { id: string },
    @Body() body: { endpoint: string },
  ) {
    if (subscriptions[user.id]) {
      subscriptions[user.id] = subscriptions[user.id].filter(
        (s: { endpoint: string }) => s.endpoint !== body.endpoint,
      );
    }
    return { ok: true };
  }

  @Put('users/alert-settings')
  @UseGuards(JwtAuthGuard)
  saveAlertSettings(
    @CurrentUser() user: { id: string },
    @Body() body: { thresholds: number[] },
  ) {
    alertSettings[user.id] = body.thresholds;
    return { thresholds: body.thresholds };
  }

  @Get('users/alert-settings')
  @UseGuards(JwtAuthGuard)
  getAlertSettings(@CurrentUser() user: { id: string }) {
    return { thresholds: alertSettings[user.id] ?? [] };
  }
}

class TestJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: TEST_SECRET,
    });
  }
  validate(payload: { sub: string; email: string }) {
    if (payload.sub === MOCK_USER.id) return MOCK_USER;
    return null;
  }
}

describe('Notifications & Alert Settings integration', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({ secret: TEST_SECRET }),
      ],
      controllers: [TestNotificationsController],
      providers: [{ provide: TestJwtStrategy, useClass: TestJwtStrategy }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const jwtService = moduleRef.get(JwtService);
    token = jwtService.sign({ sub: MOCK_USER.id, email: MOCK_USER.email });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /notifications/subscribe', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer() as Application)
        .post('/notifications/subscribe')
        .send({ endpoint: 'https://push.example.com/abc' })
        .expect(401);
    });

    it('saves push subscription with valid token', async () => {
      await request(app.getHttpServer() as Application)
        .post('/notifications/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://push.example.com/abc',
          keys: { p256dh: 'key123', auth: 'auth456' },
        })
        .expect(201)
        .expect({ ok: true });
    });
  });

  describe('PUT /users/alert-settings', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer() as Application)
        .put('/users/alert-settings')
        .send({ thresholds: [10, 20] })
        .expect(401);
    });

    it('saves thresholds array', async () => {
      await request(app.getHttpServer() as Application)
        .put('/users/alert-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ thresholds: [10, 15, 20] })
        .expect(200)
        .expect({ thresholds: [10, 15, 20] });
    });

    it('retrieves saved thresholds', async () => {
      await request(app.getHttpServer() as Application)
        .get('/users/alert-settings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect({ thresholds: [10, 15, 20] });
    });

    it('overwrites thresholds on second save', async () => {
      await request(app.getHttpServer() as Application)
        .put('/users/alert-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ thresholds: [20, 30] })
        .expect(200)
        .expect({ thresholds: [20, 30] });

      await request(app.getHttpServer() as Application)
        .get('/users/alert-settings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect({ thresholds: [20, 30] });
    });
  });
});
