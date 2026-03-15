import { JwtService } from '@nestjs/jwt';

describe('JWT validation', () => {
  const secret = 'test-secret';
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService({ secret });
  });

  it('signs and verifies a valid token', () => {
    const payload = { sub: 'user-123', email: 'test@example.com' };
    const token = jwtService.sign(payload);
    const decoded = jwtService.verify<typeof payload>(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.email).toBe('test@example.com');
  });

  it('throws on tampered token', () => {
    const token = jwtService.sign({ sub: 'user-1' });
    const tampered = token.slice(0, -3) + 'xxx';
    expect(() => jwtService.verify(tampered)).toThrow();
  });

  it('throws on expired token', async () => {
    const token = jwtService.sign({ sub: 'user-1' }, { expiresIn: '1ms' });
    await new Promise((r) => setTimeout(r, 5));
    expect(() => jwtService.verify(token)).toThrow();
  });

  it('throws on token signed with wrong secret', () => {
    const wrongService = new JwtService({ secret: 'wrong-secret' });
    const token = wrongService.sign({ sub: 'user-1' });
    expect(() => jwtService.verify(token)).toThrow();
  });

  it('payload sub maps to user id correctly', () => {
    const userId = 'clx1234abcdef';
    const token = jwtService.sign({ sub: userId, email: 'u@test.com' });
    const decoded = jwtService.verify<{ sub: string; email: string }>(token);
    expect(decoded.sub).toBe(userId);
  });
});
