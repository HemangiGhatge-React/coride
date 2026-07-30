// booking.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RideStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
    constructor(private prisma: PrismaService) { }

    async create(riderId: string, rideId: string, seatsBooked: number = 1) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                // Lock the ride row for the duration of this transaction
                const rides = await tx.$queryRaw<{ id: string; status: RideStatus; seatsAvailable: number; driverId: string }[]>`SELECT id, status, "seatsAvailable", "driverId" FROM "Ride" WHERE id = ${rideId} FOR UPDATE`;
                const ride = rides[0];
                if (!ride) throw new NotFoundException('Ride not found');
                if (riderId === ride.driverId) {
                    throw new ConflictException('Drivers cannot book their own ride');
                }
                if (ride.status !== 'ACTIVE') {
                    throw new ConflictException('Ride is not open for booking');
                }
                if (ride.seatsAvailable < seatsBooked) {
                    throw new ConflictException('Not enough seats available');
                }

                await tx.ride.update({
                    where: { id: rideId },
                    data: { seatsAvailable: { decrement: seatsBooked } },
                });

                return tx.booking.create({
                    data: { rideId, riderId, seatsBooked },
                });
            });
        } catch (err) {
            if (err.code === 'P2002') {
                throw new ConflictException('You have already booked this ride');
            }
            throw err;
        }
    }
}