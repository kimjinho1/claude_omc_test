import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { OAuthUserDto } from './auth.service';

@Controller('users')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('sync')
  sync(@Body() dto: OAuthUserDto) {
    return this.authService.syncUser(dto);
  }
}
