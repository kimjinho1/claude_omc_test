import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.favoritesService.findAll(user.id);
  }

  @Post(':symbol')
  add(@CurrentUser() user: { id: string }, @Param('symbol') symbol: string) {
    return this.favoritesService.add(user.id, symbol.toUpperCase());
  }

  @Delete(':symbol')
  remove(@CurrentUser() user: { id: string }, @Param('symbol') symbol: string) {
    return this.favoritesService.remove(user.id, symbol.toUpperCase());
  }
}
