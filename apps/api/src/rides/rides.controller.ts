import { Body, Controller, Get, Post, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { IsString, IsInt, IsNumber, IsDateString, Min, MinLength, IsOptional } from 'class-validator';
import { RidesService } from './rides.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RideStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

class CreateRideDto {
    @IsString()
    vehicleId: string;

    @IsString()
    @MinLength(1)
    origin: string;

    @IsString()
    @MinLength(1)
    destination: string;

    @IsDateString()
    departureTime: string;

    @IsInt()
    @Min(1)
    seatsTotal: number;

    @IsNumber()
    @Min(0)
    totalFuelCost: number;
}

class UpdateRideDto {
    @IsOptional()
    @IsString()
    origin?: string;

    @IsOptional()
    @IsString()
    destination?: string;

    @IsOptional()
    @IsDateString()
    departureTime?: string;

    @IsOptional()
    @IsEnum(RideStatus)
    status?: RideStatus;
}

@Controller('rides')
export class RidesController {
    constructor(private ridesService: RidesService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Request() req, @Body() body: CreateRideDto) {
        return this.ridesService.create(req.user.userId, {
            ...body,
            departureTime: new Date(body.departureTime),
        });
    }

    @Get()
    async findAll() {
        return this.ridesService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.ridesService.findOne(id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async update(@Request() req, @Param('id') id: string, @Body() body: UpdateRideDto) {
        return this.ridesService.update(id, req.user.userId, {
            ...body,
            departureTime: body.departureTime ? new Date(body.departureTime) : undefined,
        });
    }

}