import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Liveness check for Render; deliberately doesn't touch the database.
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
