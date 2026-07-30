import { PrismaService } from '../prisma/prisma.service';
export declare class BookingsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(riderId: string, rideId: string, seatsBooked?: number): Promise<{
        id: string;
        rideId: string;
        riderId: string;
        seatsBooked: number;
        paymentStatus: import("@prisma/client").$Enums.PaymentStatus;
        status: import("@prisma/client").$Enums.BookingStatus;
        createdAt: Date;
    }>;
}
