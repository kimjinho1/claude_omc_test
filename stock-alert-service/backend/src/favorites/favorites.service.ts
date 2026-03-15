import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const results = await this.prisma.favorite.findMany({
      where: { userId },
      include: { stock: { include: { analytics: true } } },
    });
    this.logger.debug(`findAll favorites: userId=${userId} count=${results.length}`);
    return results;
  }

  async add(userId: string, symbol: string) {
    this.logger.debug(`add favorite: userId=${userId} symbol=${symbol}`);
    const stock = await this.prisma.stock.findUnique({ where: { symbol } });
    if (!stock) throw new NotFoundException(`Stock ${symbol} not found`);

    try {
      return await this.prisma.favorite.create({ data: { userId, symbol } });
    } catch {
      throw new ConflictException('Already in favorites');
    }
  }

  async remove(userId: string, symbol: string) {
    this.logger.debug(`remove favorite: userId=${userId} symbol=${symbol}`);
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
