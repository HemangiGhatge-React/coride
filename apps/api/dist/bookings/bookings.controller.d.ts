import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './bookings.dto';
export declare class BookingsController {
    private bookingsService;
    constructor(bookingsService: BookingsService);
    create(req: any, body: CreateBookingDto): Promise<{
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.BookingStatus;
        rideId: string;
        riderId: string;
        seatsBooked: number;
        paymentStatus: import("@prisma/client").$Enums.PaymentStatus;
    }>;
}
