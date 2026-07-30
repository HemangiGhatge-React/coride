// bookings.controller.ts
import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './bookings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req, @Body() body: CreateBookingDto) {
    return this.bookingsService.create(req.user.userId, body.rideId, body.seatsBooked ?? 1);
  }
}