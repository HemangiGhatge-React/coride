import { PrismaService } from '../prisma/prisma.service';
export declare class VehiclesService {
    private prisma;
    constructor(prisma: PrismaService);
    create(ownerId: string, data: {
        make: string;
        model: string;
        plate: string;
        seats: number;
    }): Promise<{
        id: string;
        make: string;
        model: string;
        plate: string;
        seats: number;
        ownerId: string;
    }>;
    findMine(ownerId: string): Promise<{
        id: string;
        make: string;
        model: string;
        plate: string;
        seats: number;
        ownerId: string;
    }[]>;
    findOneOwnedBy(vehicleId: string, ownerId: string): Promise<{
        id: string;
        make: string;
        model: string;
        plate: string;
        seats: number;
        ownerId: string;
    }>;
}
