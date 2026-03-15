import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Controller, Get, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { JwtStrategy } from '../jwt.strategy';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { ConfigModule } from '@nestjs/config';

const TEST_SECRET = 'integration-test-secret';
const MOCK_USER = { id: 'user-abc', email: 'test@example.com' };

@Controller('test-protected')
@UseGuards(JwtAuthGuard)
class TestProtectedController {
  @Get()
  getSecret() {
    return { message: 'secret' };
  }
}

describe('JwtAuthGuard integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({ secret: TEST_SECRET }),
      ],
      controllers: [TestProtectedController],
      providers: [
        {
          provide: JwtStrategy,
          useFactory: () => {
            // Inline JwtStrategy using test secret + mock usersService
            const { PassportStrategy } = require('@nestjs/passport');
            const { ExtractJwt, Strategy } = require('passport-jwt');

            class TestJwtStrategy extends PassportStrategy(Strategy) {
              constructor() {
                super({
                  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
                  ignoreExpiration: false,
                  secretOrKey: TEST_SECRET,
                });
              }
              async validate(payload: { sub: string; email: string }) {
                if (payload.sub === MOCK_USER.id) return MOCK_USER;
                return null;
              }
            }
            return new TestJwtStrategy();
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    await request(app.getHttpServer())
      .get('/test-protected')
      .expect(401);
  });

  it('returns 401 when token is malformed', async () => {
    await request(app.getHttpServer())
      .get('/test-protected')
      .set('Authorization', 'Bearer not.a.real.token')
      .expect(401);
  });

  it('returns 401 when token is signed with wrong secret', async () => {
    const wrongToken = new JwtService({ secret: 'wrong-secret' }).sign({
      sub: MOCK_USER.id,
      email: MOCK_USER.email,
    });
    await request(app.getHttpServer())
      .get('/test-protected')
      .set('Authorization', `Bearer ${wrongToken}`)
      .expect(401);
  });

  it('returns 200 with valid Bearer token', async () => {
    const token = jwtService.sign({ sub: MOCK_USER.id, email: MOCK_USER.email });
    await request(app.getHttpServer())
      .get('/test-protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ message: 'secret' });
  });

  it('returns 401 when token is expired', async () => {
    const expiredToken = jwtService.sign(
      { sub: MOCK_USER.id, email: MOCK_USER.email },
      { expiresIn: '1ms' },
    );
    await new Promise((r) => setTimeout(r, 10));
    await request(app.getHttpServer())
      .get('/test-protected')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
});
