import type { Response } from 'express';
import { VippsAuthService } from './vipps-auth.service';
declare class StartQueryDto {
    app_redirect: string;
    code_challenge: string;
}
declare class CallbackQueryDto {
    code?: string;
    state?: string;
    scope?: string;
    error?: string;
    error_description?: string;
    error_code?: string;
}
declare class ExchangeDto {
    code: string;
    code_verifier: string;
}
export declare class VippsController {
    private vippsAuth;
    constructor(vippsAuth: VippsAuthService);
    start(query: StartQueryDto, res: Response): Promise<void>;
    callback(query: CallbackQueryDto, res: Response): Promise<void>;
    exchange(body: ExchangeDto): Promise<{
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
}
export {};
