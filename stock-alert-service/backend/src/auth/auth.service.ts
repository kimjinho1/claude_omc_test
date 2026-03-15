import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async syncUser(dto: OAuthUserDto) {
    this.logger.debug(`syncUser: email=${dto.email}, provider=${dto.provider}`);
    const user = await this.usersService.upsert(dto);
    this.logger.debug(`user synced: userId=${user.id}`);
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { user, accessToken: token };
  }
}
