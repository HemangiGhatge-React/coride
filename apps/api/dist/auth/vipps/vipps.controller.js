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
exports.VippsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const vipps_auth_service_1 = require("./vipps-auth.service");
class StartQueryDto {
    app_redirect;
    code_challenge;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StartQueryDto.prototype, "app_redirect", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^[A-Za-z0-9_-]{43}$/),
    __metadata("design:type", String)
], StartQueryDto.prototype, "code_challenge", void 0);
class CallbackQueryDto {
    code;
    state;
    scope;
    error;
    error_description;
    error_code;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CallbackQueryDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CallbackQueryDto.prototype, "state", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CallbackQueryDto.prototype, "scope", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CallbackQueryDto.prototype, "error", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CallbackQueryDto.prototype, "error_description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CallbackQueryDto.prototype, "error_code", void 0);
class ExchangeDto {
    code;
    code_verifier;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ExchangeDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(43, 128),
    __metadata("design:type", String)
], ExchangeDto.prototype, "code_verifier", void 0);
let VippsController = class VippsController {
    vippsAuth;
    constructor(vippsAuth) {
        this.vippsAuth = vippsAuth;
    }
    async start(query, res) {
        res.redirect(await this.vippsAuth.start(query.app_redirect, query.code_challenge));
    }
    async callback(query, res) {
        res.redirect(await this.vippsAuth.callback(query));
    }
    async exchange(body) {
        return this.vippsAuth.exchange(body.code, body.code_verifier);
    }
};
exports.VippsController = VippsController;
__decorate([
    (0, common_1.Get)('start'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [StartQueryDto, Object]),
    __metadata("design:returntype", Promise)
], VippsController.prototype, "start", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CallbackQueryDto, Object]),
    __metadata("design:returntype", Promise)
], VippsController.prototype, "callback", null);
__decorate([
    (0, common_1.Post)('exchange'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ExchangeDto]),
    __metadata("design:returntype", Promise)
], VippsController.prototype, "exchange", null);
exports.VippsController = VippsController = __decorate([
    (0, common_1.Controller)('auth/vipps'),
    __metadata("design:paramtypes", [vipps_auth_service_1.VippsAuthService])
], VippsController);
//# sourceMappingURL=vipps.controller.js.map