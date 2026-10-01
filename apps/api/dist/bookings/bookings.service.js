"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BookingsService = class BookingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(riderId, rideId, seatsBooked = 1) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const rides = await tx.$queryRaw `SELECT id, status, "seatsAvailable", "driverId" FROM "Ride" WHERE id = ${rideId} FOR UPDATE`;
                const ride = rides[0];
                if (!ride)
                    throw new common_1.NotFoundException('Ride not found');
                if (riderId === ride.driverId) {
                    throw new common_1.ConflictException('Drivers cannot book their own ride');
                }
                if (ride.status !== 'ACTIVE') {
                    throw new common_1.ConflictException('Ride is not open for booking');
                }
                if (ride.seatsAvailable < seatsBooked) {
                    throw new common_1.ConflictException('Not enough seats available');
                }
                await tx.ride.update({
                    where: { id: rideId },
                    data: { seatsAvailable: { decrement: seatsBooked } },
                });
                return tx.booking.create({
                    data: { rideId, riderId, seatsBooked },
                });
            });
        }
        catch (err) {
            if (err.code === 'P2002') {
                throw new common_1.ConflictException('You have already booked this ride');
            }
            throw err;
        }
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map