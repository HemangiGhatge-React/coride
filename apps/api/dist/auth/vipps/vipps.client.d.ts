import { ConfigService } from '@nestjs/config';
import type { VippsIdentity } from '../../users/users.service';
export declare const VIPPS_SCOPES = "openid name email";
export interface VippsConfig {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    merchantSerialNumber: string;
    redirectUri: string;
}
export declare class VippsError extends Error {
}
export declare class VippsClient {
    private config;
    private readonly logger;
    private discovery?;
    private jwks?;
    constructor(config: ConfigService);
    getConfig(): VippsConfig | null;
    buildAuthorizeUrl(cfg: VippsConfig, state: string, nonce: string): Promise<string>;
    resolveIdentity(cfg: VippsConfig, code: string, nonce: string): Promise<VippsIdentity>;
    private getDiscovery;
    private getJwks;
    private request;
}
