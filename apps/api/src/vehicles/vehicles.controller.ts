import { Body, Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { IsString, IsInt, Min, MinLength } from 'class-validator';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  make: string;

  @IsString()
  @MinLength(1)
  model: string;

  @IsString()
  @MinLength(1)
  plate: string;

  @IsInt()
  @Min(1)
  seats: number;
}

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Post()
  async create(@Request() req, @Body() body: CreateVehicleDto) {
    return this.vehiclesService.create(req.user.userId, body);
  }

  @Get('mine')
  async findMine(@Request() req) {
    return this.vehiclesService.findMine(req.user.userId);
  }
}