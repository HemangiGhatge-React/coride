import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { RideStatus } from '@prisma/client';
export declare class RidesService {
    private prisma;
    private vehiclesService;
    constructor(prisma: PrismaService, vehiclesService: VehiclesService);
    create(driverId: string, data: {
        vehicleId: string;
        origin: string;
        destination: string;
        departureTime: Date;
        seatsTotal: number;
        totalFuelCost: number;
    }): Promise<{
        id: string;
        createdAt: Date;
        origin: string;
        destination: string;
        departureTime: Date;
        seatsTotal: number;
        seatsAvailable: number;
        totalFuelCost: import("@prisma/client-runtime-utils").Decimal;
        costPerSeat: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.RideStatus;
        driverId: string;
        vehicleId: string;
    }>;
    findAll(): Promise<({
        vehicle: {
            id: string;
            make: string;
            model: string;
            plate: string;
            seats: number;
            ownerId: string;
        };
        driver: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        origin: string;
        destination: string;
        departureTime: Date;
        seatsTotal: number;
        seatsAvailable: number;
        totalFuelCost: import("@prisma/client-runtime-utils").Decimal;
        costPerSeat: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.RideStatus;
        driverId: string;
        vehicleId: string;
    })[]>;
    findOne(id: string): Promise<{
        vehicle: {
            id: string;
            make: string;
            model: string;
            plate: string;
            seats: number;
            ownerId: string;
        };
        driver: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        origin: string;
        destination: string;
        departureTime: Date;
        seatsTotal: number;
        seatsAvailable: number;
        totalFuelCost: import("@prisma/client-runtime-utils").Decimal;
        costPerSeat: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.RideStatus;
        driverId: string;
        vehicleId: string;
    }>;
    update(id: string, driverId: string, data: Partial<{
        origin: string;
        destination: string;
        departureTime: Date;
        status: RideStatus;
    }>): Promise<{
        id: string;
        createdAt: Date;
        origin: string;
        destination: string;
        departureTime: Date;
        seatsTotal: number;
        seatsAvailable: number;
        totalFuelCost: import("@prisma/client-runtime-utils").Decimal;
        costPerSeat: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.RideStatus;
        driverId: string;
        vehicleId: string;
    }>;
}
