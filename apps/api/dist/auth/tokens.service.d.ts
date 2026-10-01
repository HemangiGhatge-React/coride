import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export declare const ACCESS_TOKEN_TTL = "15m";
export declare const ACCESS_TOKEN_AUDIENCE = "coride:api";
export interface SessionUser {
    id: string;
    email: string;
    role: string;
}
export interface SessionTokens {
    access_token: string;
    refresh_token: string;
}
export declare function hashToken(token: string): string;
export declare class TokensService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    issueSession(user: SessionUser): Promise<SessionTokens>;
    rotate(refreshToken: string): Promise<SessionTokens>;
    revoke(refreshToken: string): Promise<void>;
    private signAccessToken;
    private createRefreshToken;
    private revokeFamily;
}
