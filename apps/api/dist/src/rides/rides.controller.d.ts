import { RidesService } from './rides.service';
import { RideStatus } from '@prisma/client';
declare class CreateRideDto {
    vehicleId: string;
    origin: string;
    destination: string;
    departureTime: string;
    seatsTotal: number;
    totalFuelCost: number;
}
declare class UpdateRideDto {
    origin?: string;
    destination?: string;
    departureTime?: string;
    status?: RideStatus;
}
export declare class RidesController {
    private ridesService;
    constructor(ridesService: RidesService);
    create(req: any, body: CreateRideDto): Promise<{
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
    update(req: any, id: string, body: UpdateRideDto): Promise<{
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
export {};
