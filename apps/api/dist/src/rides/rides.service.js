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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RidesService = void 0;
const common_1 = require("@nestjs/common");
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_service_1 = require("../prisma/prisma.service");
const vehicles_service_1 = require("../vehicles/vehicles.service");
const client_1 = require("@prisma/client");
const ALLOWED_TRANSITIONS = {
    ACTIVE: ['CANCELLED', 'COMPLETED'],
    CANCELLED: [],
    COMPLETED: [],
};
let RidesService = class RidesService {
    prisma;
    vehiclesService;
    constructor(prisma, vehiclesService) {
        this.prisma = prisma;
        this.vehiclesService = vehiclesService;
    }
    async create(driverId, data) {
        await this.vehiclesService.findOneOwnedBy(data.vehicleId, driverId);
        const costPerSeat = new decimal_js_1.default(data.totalFuelCost)
            .div(data.seatsTotal)
            .toDecimalPlaces(0, decimal_js_1.default.ROUND_UP);
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
    async findOne(id) {
        const ride = await this.prisma.ride.findUnique({
            where: { id },
            include: { vehicle: true, driver: { select: { id: true, name: true } } },
        });
        if (!ride)
            throw new common_1.NotFoundException('Ride not found');
        return ride;
    }
    async update(id, driverId, data) {
        const ride = await this.prisma.ride.findUnique({ where: { id } });
        if (!ride)
            throw new common_1.NotFoundException('Ride not found');
        if (ride.driverId !== driverId)
            throw new common_1.ForbiddenException('You do not own this ride');
        if (data.status && data.status !== ride.status) {
            if (!ALLOWED_TRANSITIONS[ride.status].includes(data.status)) {
                throw new common_1.ConflictException(`Cannot transition ride from ${ride.status} to ${data.status}`);
            }
            if (data.status === client_1.RideStatus.CANCELLED) {
                const confirmedBookings = await this.prisma.booking.count({
                    where: { rideId: id, status: 'CONFIRMED' },
                });
                if (confirmedBookings > 0) {
                    throw new common_1.ConflictException('Cannot cancel a ride with confirmed bookings. Cancel or resolve bookings first.');
                }
            }
        }
        return this.prisma.ride.update({ where: { id }, data });
    }
};
exports.RidesService = RidesService;
exports.RidesService = RidesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        vehicles_service_1.VehiclesService])
], RidesService);
//# sourceMappingURL=rides.service.js.map