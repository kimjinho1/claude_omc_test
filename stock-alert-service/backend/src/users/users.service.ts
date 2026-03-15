import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async upsert(dto: {
    email: string;
    name?: string;
    image?: string;
    provider: string;
  }) {
    this.logger.debug(`upsert user: email=${dto.email}`);
    return this.prisma.user.upsert({
      where: { email: dto.email },
      update: { name: dto.name, image: dto.image },
      create: {
        email: dto.email,
        name: dto.name,
        image: dto.image,
        provider: dto.provider,
      },
    });
  }

  async getAlertSettings(userId: string) {
    this.logger.debug(`getAlertSettings: userId=${userId}`);
    return this.prisma.alertSetting.findUnique({ where: { userId } });
  }

  async upsertAlertSettings(userId: string, thresholds: number[]) {
    this.logger.debug(
      `upsertAlertSettings: userId=${userId} thresholds=${JSON.stringify(thresholds)}`,
    );
    return this.prisma.alertSetting.upsert({
      where: { userId },
      update: { thresholds },
      create: { userId, thresholds },
    });
  }
}
