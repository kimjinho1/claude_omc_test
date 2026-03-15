import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
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
    return this.prisma.alertSetting.findUnique({ where: { userId } });
  }

  async upsertAlertSettings(userId: string, thresholds: number[]) {
    return this.prisma.alertSetting.upsert({
      where: { userId },
      update: { thresholds },
      create: { userId, thresholds },
    });
  }
}
