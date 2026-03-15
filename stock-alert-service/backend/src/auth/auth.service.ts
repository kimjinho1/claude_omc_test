import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

export interface OAuthUserDto {
  email: string;
  name?: string;
  image?: string;
  provider: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async syncUser(dto: OAuthUserDto) {
    const user = await this.usersService.upsert(dto);
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { user, accessToken: token };
  }
}
