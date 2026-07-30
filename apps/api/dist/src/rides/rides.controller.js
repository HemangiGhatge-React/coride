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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RidesController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const rides_service_1 = require("./rides.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const client_1 = require("@prisma/client");
const class_validator_2 = require("class-validator");
class CreateRideDto {
    vehicleId;
    origin;
    destination;
    departureTime;
    seatsTotal;
    totalFuelCost;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRideDto.prototype, "vehicleId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateRideDto.prototype, "origin", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateRideDto.prototype, "destination", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateRideDto.prototype, "departureTime", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateRideDto.prototype, "seatsTotal", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRideDto.prototype, "totalFuelCost", void 0);
class UpdateRideDto {
    origin;
    destination;
    departureTime;
    status;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRideDto.prototype, "origin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRideDto.prototype, "destination", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateRideDto.prototype, "departureTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_2.IsEnum)(client_1.RideStatus),
    __metadata("design:type", String)
], UpdateRideDto.prototype, "status", void 0);
let RidesController = class RidesController {
    ridesService;
    constructor(ridesService) {
        this.ridesService = ridesService;
    }
    async create(req, body) {
        return this.ridesService.create(req.user.userId, {
            ...body,
            departureTime: new Date(body.departureTime),
        });
    }
    async findAll() {
        return this.ridesService.findAll();
    }
    async findOne(id) {
        return this.ridesService.findOne(id);
    }
    async update(req, id, body) {
        return this.ridesService.update(id, req.user.userId, {
            ...body,
            departureTime: body.departureTime ? new Date(body.departureTime) : undefined,
        });
    }
};
exports.RidesController = RidesController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateRideDto]),
    __metadata("design:returntype", Promise)
], RidesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RidesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RidesController.prototype, "findOne", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateRideDto]),
    __metadata("design:returntype", Promise)
], RidesController.prototype, "update", null);
exports.RidesController = RidesController = __decorate([
    (0, common_1.Controller)('rides'),
    __metadata("design:paramtypes", [rides_service_1.RidesService])
], RidesController);
//# sourceMappingURL=rides.controller.js.map