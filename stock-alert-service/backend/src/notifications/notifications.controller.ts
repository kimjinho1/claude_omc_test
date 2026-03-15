import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('subscribe')
  subscribe(
    @CurrentUser() user: { id: string },
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.notificationsService.subscribe(user.id, body);
  }

  @Delete('unsubscribe')
  unsubscribe(
    @CurrentUser() user: { id: string },
    @Body('endpoint') endpoint: string,
  ) {
    return this.notificationsService.unsubscribe(user.id, endpoint);
  }
}
