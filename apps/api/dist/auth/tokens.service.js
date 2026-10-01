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
exports.TokensService = exports.ACCESS_TOKEN_AUDIENCE = exports.ACCESS_TOKEN_TTL = void 0;
exports.hashToken = hashToken;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
exports.ACCESS_TOKEN_TTL = '15m';
exports.ACCESS_TOKEN_AUDIENCE = 'coride:api';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REUSE_GRACE_MS = 30 * 1000;
function hashToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
let TokensService = class TokensService {
    prisma;
    jwtService;
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async issueSession(user) {
        return {
            access_token: this.signAccessToken(user),
            refresh_token: await this.createRefreshToken(user.id, (0, crypto_1.randomUUID)()),
        };
    }
    async rotate(refreshToken) {
        const now = new Date();
        const existing = await this.prisma.refreshToken.findUnique({
            where: { tokenHash: hashToken(refreshToken) },
            include: { user: true },
        });
        if (!existing || existing.expiresAt <= now) {
            throw new common_1.UnauthorizedException('INVALID_REFRESH_TOKEN');
        }
        if (existing.revokedAt) {
            const familyStillActive = (await this.prisma.refreshToken.count({
                where: { familyId: existing.familyId, revokedAt: null },
            })) > 0;
            const withinGrace = now.getTime() - existing.revokedAt.getTime() < REUSE_GRACE_MS;
            await this.revokeFamily(existing.familyId);
            if (!familyStillActive || !withinGrace) {
                throw new common_1.UnauthorizedException('REFRESH_TOKEN_REUSED');
            }
        }
        else {
            const claimed = await this.prisma.refreshToken.updateMany({
                where: { id: existing.id, revokedAt: null },
                data: { revokedAt: now },
            });
            if (claimed.count === 0) {
                throw new common_1.UnauthorizedException('INVALID_REFRESH_TOKEN');
            }
        }
        return {
            access_token: this.signAccessToken(existing.user),
            refresh_token: await this.createRefreshToken(existing.userId, existing.familyId),
        };
    }
    async revoke(refreshToken) {
        const existing = await this.prisma.refreshToken.findUnique({
            where: { tokenHash: hashToken(refreshToken) },
        });
        if (existing) {
            await this.revokeFamily(existing.familyId);
        }
    }
    signAccessToken(user) {
        return this.jwtService.sign({ sub: user.id, email: user.email, role: user.role }, { expiresIn: exports.ACCESS_TOKEN_TTL, audience: exports.ACCESS_TOKEN_AUDIENCE });
    }
    async createRefreshToken(userId, familyId) {
        const token = (0, crypto_1.randomBytes)(32).toString('base64url');
        await this.prisma.refreshToken.create({
            data: {
                userId,
                familyId,
                tokenHash: hashToken(token),
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
            },
        });
        return token;
    }
    async revokeFamily(familyId) {
        await this.prisma.refreshToken.updateMany({
            where: { familyId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
};
exports.TokensService = TokensService;
exports.TokensService = TokensService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], TokensService);
//# sourceMappingURL=tokens.service.js.map