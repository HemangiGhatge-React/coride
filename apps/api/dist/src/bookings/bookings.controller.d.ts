import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './bookings.dto';
export declare class BookingsController {
    private bookingsService;
    constructor(bookingsService: BookingsService);
    create(req: any, body: CreateBookingDto): Promise<{
        id: string;
        rideId: string;
        riderId: string;
        seatsBooked: number;
        paymentStatus: import("@prisma/client").$Enums.PaymentStatus;
        status: import("@prisma/client").$Enums.BookingStatus;
        createdAt: Date;
    }>;
}
