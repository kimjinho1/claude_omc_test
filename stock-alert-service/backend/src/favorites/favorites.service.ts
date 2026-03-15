import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: { stock: { include: { analytics: true } } },
    });
  }

  async add(userId: string, symbol: string) {
    const stock = await this.prisma.stock.findUnique({ where: { symbol } });
    if (!stock) throw new NotFoundException(`Stock ${symbol} not found`);

    try {
      return await this.prisma.favorite.create({ data: { userId, symbol } });
    } catch {
      throw new ConflictException('Already in favorites');
    }
  }

  async remove(userId: string, symbol: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_symbol: { userId, symbol } },
    });
    if (!favorite) throw new NotFoundException('Not in favorites');
    return this.prisma.favorite.delete({
      where: { userId_symbol: { userId, symbol } },
    });
  }

  async getFavoriteSymbols(userId: string): Promise<string[]> {
    const favs = await this.prisma.favorite.findMany({ where: { userId } });
    return favs.map((f) => f.symbol);
  }
}
