import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('alert-settings')
  getAlertSettings(@CurrentUser() user: { id: string }) {
    return this.usersService.getAlertSettings(user.id);
  }

  @Put('alert-settings')
  updateAlertSettings(
    @CurrentUser() user: { id: string },
    @Body() body: { thresholds: number[] },
  ) {
    return this.usersService.upsertAlertSettings(user.id, body.thresholds);
  }
}
