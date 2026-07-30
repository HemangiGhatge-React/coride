// booking.dto.ts
import { IsString, IsInt, Min, IsOptional } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  rideId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seatsBooked?: number;
}