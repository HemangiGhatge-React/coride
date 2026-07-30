import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { RideStatus } from '@prisma/client';

const ALLOWED_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
    ACTIVE: ['CANCELLED', 'COMPLETED'],
    CANCELLED: [],
    COMPLETED: [],
};

@Injectable()
export class RidesService {
    constructor(
        private prisma: PrismaService,
        private vehiclesService: VehiclesService,
    ) { }

    async create(
        driverId: string,
        data: {
            vehicleId: string;
            origin: string;
            destination: string;
            departureTime: Date;
            seatsTotal: number;
            totalFuelCost: number;
        },
    ) {
        await this.vehiclesService.findOneOwnedBy(data.vehicleId, driverId);

        const costPerSeat = new Decimal(data.totalFuelCost)
            .div(data.seatsTotal)
            .toDecimalPlaces(0, Decimal.ROUND_UP);

        return this.prisma.ride.create({
            data: {
                driverId,
                vehicleId: data.vehicleId,
                origin: data.origin,
                destination: data.destination,
                departureTime: data.departureTime,
                seatsTotal: data.seatsTotal,
                seatsAvailable: data.seatsTotal,
                totalFuelCost: data.totalFuelCost,
                costPerSeat: costPerSeat.toString(),
            },
        });
    }




    async findAll() {
        return this.prisma.ride.findMany({
            where: { status: 'ACTIVE' },
            include: { vehicle: true, driver: { select: { id: true, name: true } } },
        });
    }

    async findOne(id: string) {
        const ride = await this.prisma.ride.findUnique({
            where: { id },
            include: { vehicle: true, driver: { select: { id: true, name: true } } },
        });
        if (!ride) throw new NotFoundException('Ride not found');
        return ride;
    }

    async update(
        id: string,
        driverId: string,
        data: Partial<{ origin: string; destination: string; departureTime: Date; status: RideStatus }>,
    ) {
        const ride = await this.prisma.ride.findUnique({ where: { id } });
        if (!ride) throw new NotFoundException('Ride not found');
        if (ride.driverId !== driverId) throw new ForbiddenException('You do not own this ride');
        if (data.status && data.status !== ride.status) {
            if (!ALLOWED_TRANSITIONS[ride.status].includes(data.status)) {
                throw new ConflictException(`Cannot transition ride from ${ride.status} to ${data.status}`);
            }

            if (data.status === RideStatus.CANCELLED) {
                const confirmedBookings = await this.prisma.booking.count({
                    where: { rideId: id, status: 'CONFIRMED' },
                });
                if (confirmedBookings > 0) {
                    throw new ConflictException(
                        'Cannot cancel a ride with confirmed bookings. Cancel or resolve bookings first.',
                    );
                }
            }
        }

        return this.prisma.ride.update({ where: { id }, data });
    }
}
