import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import { TokensService } from '../tokens.service';
import { VippsClient } from './vipps.client';
export type VippsLoginError = 'cancelled' | 'vipps_error' | 'email_conflict' | 'invalid_state' | 'not_configured';
export declare class VippsAuthService {
    private vipps;
    private jwt;
    private config;
    private users;
    private tokens;
    private readonly logger;
    constructor(vipps: VippsClient, jwt: JwtService, config: ConfigService, users: UsersService, tokens: TokensService);
    private allowedAppRedirects;
    start(appRedirect: string, codeChallenge: string): Promise<string>;
    callback(query: {
        code?: string;
        state?: string;
        error?: string;
        error_description?: string;
    }): Promise<string>;
    exchange(code: string, codeVerifier: string): Promise<{
        user: {
            id: string;
            email: string;
            vippsSub: string | null;
            name: string;
            role: import("@prisma/client").$Enums.Role;
            createdAt: Date;
        };
        access_token: string;
        refresh_token: string;
    }>;
    private appRedirectUrl;
}
