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
var VippsClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VippsClient = exports.VippsError = exports.VIPPS_SCOPES = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jose_1 = require("jose");
const REQUEST_TIMEOUT_MS = 10_000;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
exports.VIPPS_SCOPES = 'openid name email';
class VippsError extends Error {
}
exports.VippsError = VippsError;
let VippsClient = VippsClient_1 = class VippsClient {
    config;
    logger = new common_1.Logger(VippsClient_1.name);
    discovery;
    jwks;
    constructor(config) {
        this.config = config;
    }
    getConfig() {
        const clientId = this.config.get('VIPPS_CLIENT_ID');
        const clientSecret = this.config.get('VIPPS_CLIENT_SECRET');
        const merchantSerialNumber = this.config.get('VIPPS_MERCHANT_SERIAL_NUMBER');
        const redirectUri = this.config.get('VIPPS_REDIRECT_URI');
        if (!clientId || !clientSecret || !merchantSerialNumber || !redirectUri)
            return null;
        return {
            baseUrl: this.config.get('VIPPS_BASE_URL') ?? 'https://apitest.vipps.no',
            clientId,
            clientSecret,
            merchantSerialNumber,
            redirectUri,
        };
    }
    async buildAuthorizeUrl(cfg, state, nonce) {
        const { authorization_endpoint } = await this.getDiscovery(cfg);
        const url = new URL(authorization_endpoint);
        url.search = new URLSearchParams({
            client_id: cfg.clientId,
            response_type: 'code',
            scope: exports.VIPPS_SCOPES,
            state,
            nonce,
            redirect_uri: cfg.redirectUri,
            final_redirect_is_app: 'true',
        }).toString();
        return url.toString();
    }
    async resolveIdentity(cfg, code, nonce) {
        const oidc = await this.getDiscovery(cfg);
        const tokens = await this.request(oidc.token_endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Merchant-Serial-Number': cfg.merchantSerialNumber,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: cfg.redirectUri,
            }).toString(),
        });
        if (!tokens.access_token || !tokens.id_token) {
            throw new VippsError('Token response missing access_token or id_token');
        }
        let idSub;
        try {
            const { payload } = await (0, jose_1.jwtVerify)(tokens.id_token, this.getJwks(oidc.jwks_uri), {
                issuer: oidc.issuer,
                audience: cfg.clientId,
                algorithms: ['RS256'],
            });
            if (payload.nonce !== nonce)
                throw new VippsError('ID token nonce mismatch');
            if (!payload.sub)
                throw new VippsError('ID token missing sub');
            idSub = payload.sub;
        }
        catch (err) {
            if (err instanceof VippsError)
                throw err;
            throw new VippsError(`ID token verification failed: ${err.message}`);
        }
        const info = await this.request(oidc.userinfo_endpoint, {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                'Merchant-Serial-Number': cfg.merchantSerialNumber,
            },
        });
        if (info.sub !== idSub)
            throw new VippsError('Userinfo sub does not match ID token');
        if (!info.email)
            throw new VippsError('Userinfo missing email (is the email scope enabled?)');
        return {
            sub: idSub,
            email: info.email.toLowerCase(),
            emailVerified: info.email_verified === true,
            name: info.name?.trim() || info.email,
        };
    }
    async getDiscovery(cfg) {
        if (this.discovery &&
            Date.now() - this.discovery.fetchedAt < DISCOVERY_TTL_MS) {
            return this.discovery.config;
        }
        const config = await this.request(`${cfg.baseUrl}/access-management-1.0/access/.well-known/openid-configuration`, {});
        this.discovery = { config, fetchedAt: Date.now() };
        return config;
    }
    getJwks(uri) {
        if (!this.jwks || this.jwks.uri !== uri) {
            this.jwks = { uri, getKey: (0, jose_1.createRemoteJWKSet)(new URL(uri)) };
        }
        return this.jwks.getKey;
    }
    async request(url, init) {
        let res;
        try {
            res = await fetch(url, {
                ...init,
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        }
        catch (err) {
            throw new VippsError(`Request to ${url} failed: ${err.message}`);
        }
        if (!res.ok) {
            this.logger.warn(`Vipps ${url} responded ${res.status}: ${await res.text().catch(() => '')}`);
            throw new VippsError(`Vipps responded ${res.status}`);
        }
        return (await res.json());
    }
};
exports.VippsClient = VippsClient;
exports.VippsClient = VippsClient = VippsClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], VippsClient);
//# sourceMappingURL=vipps.client.js.map