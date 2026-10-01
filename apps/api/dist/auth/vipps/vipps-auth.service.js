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
var VippsAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VippsAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const users_service_1 = require("../../users/users.service");
const tokens_service_1 = require("../tokens.service");
const vipps_client_1 = require("./vipps.client");
const STATE_AUDIENCE = 'coride:vipps-state';
const LOGIN_CODE_AUDIENCE = 'coride:vipps-login-code';
const STATE_TTL = '10m';
const LOGIN_CODE_TTL = '2m';
let VippsAuthService = VippsAuthService_1 = class VippsAuthService {
    vipps;
    jwt;
    config;
    users;
    tokens;
    logger = new common_1.Logger(VippsAuthService_1.name);
    constructor(vipps, jwt, config, users, tokens) {
        this.vipps = vipps;
        this.jwt = jwt;
        this.config = config;
        this.users = users;
        this.tokens = tokens;
    }
    allowedAppRedirects() {
        return (this.config.get('VIPPS_APP_REDIRECT_URIS') ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    async start(appRedirect, codeChallenge) {
        if (!this.allowedAppRedirects().includes(appRedirect)) {
            throw new common_1.BadRequestException('INVALID_APP_REDIRECT');
        }
        const cfg = this.vipps.getConfig();
        if (!cfg) {
            return this.appRedirectUrl(appRedirect, { error: 'not_configured' });
        }
        const nonce = (0, crypto_1.randomUUID)();
        const state = this.jwt.sign({ nonce, codeChallenge, appRedirect }, {
            audience: STATE_AUDIENCE,
            expiresIn: STATE_TTL,
        });
        try {
            return await this.vipps.buildAuthorizeUrl(cfg, state, nonce);
        }
        catch (err) {
            this.logger.warn(`Vipps start failed: ${err.message}`);
            return this.appRedirectUrl(appRedirect, { error: 'vipps_error' });
        }
    }
    async callback(query) {
        let state;
        try {
            state = this.jwt.verify(query.state ?? '', {
                audience: STATE_AUDIENCE,
            });
        }
        catch {
            const fallback = this.allowedAppRedirects()[0];
            if (!fallback)
                throw new common_1.BadRequestException('INVALID_STATE');
            return this.appRedirectUrl(fallback, { error: 'invalid_state' });
        }
        if (query.error) {
            this.logger.log(`Vipps returned error=${query.error} (${query.error_description ?? ''})`);
            const error = query.error === 'access_denied' ? 'cancelled' : 'vipps_error';
            return this.appRedirectUrl(state.appRedirect, { error });
        }
        const cfg = this.vipps.getConfig();
        if (!cfg || !query.code) {
            return this.appRedirectUrl(state.appRedirect, {
                error: cfg ? 'vipps_error' : 'not_configured',
            });
        }
        try {
            const identity = await this.vipps.resolveIdentity(cfg, query.code, state.nonce);
            const user = await this.users.findOrCreateFromVipps(identity);
            const loginCode = this.jwt.sign({ sub: user.id, cc: state.codeChallenge }, {
                audience: LOGIN_CODE_AUDIENCE,
                expiresIn: LOGIN_CODE_TTL,
            });
            return this.appRedirectUrl(state.appRedirect, { code: loginCode });
        }
        catch (err) {
            if (err instanceof common_1.ConflictException) {
                return this.appRedirectUrl(state.appRedirect, {
                    error: 'email_conflict',
                });
            }
            if (!(err instanceof vipps_client_1.VippsError))
                throw err;
            this.logger.warn(`Vipps callback failed: ${err.message}`);
            return this.appRedirectUrl(state.appRedirect, { error: 'vipps_error' });
        }
    }
    async exchange(code, codeVerifier) {
        let payload;
        try {
            payload = this.jwt.verify(code, {
                audience: LOGIN_CODE_AUDIENCE,
            });
        }
        catch {
            throw new common_1.UnauthorizedException('INVALID_LOGIN_CODE');
        }
        const challenge = (0, crypto_1.createHash)('sha256')
            .update(codeVerifier)
            .digest('base64url');
        if (challenge !== payload.cc) {
            throw new common_1.UnauthorizedException('INVALID_LOGIN_CODE');
        }
        const user = await this.users.findById(payload.sub);
        if (!user)
            throw new common_1.UnauthorizedException('INVALID_LOGIN_CODE');
        const { password, ...safeUser } = user;
        return { ...(await this.tokens.issueSession(user)), user: safeUser };
    }
    appRedirectUrl(appRedirect, params) {
        const sep = appRedirect.includes('?') ? '&' : '?';
        return `${appRedirect}${sep}${new URLSearchParams(params).toString()}`;
    }
};
exports.VippsAuthService = VippsAuthService;
exports.VippsAuthService = VippsAuthService = VippsAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [vipps_client_1.VippsClient,
        jwt_1.JwtService,
        config_1.ConfigService,
        users_service_1.UsersService,
        tokens_service_1.TokensService])
], VippsAuthService);
//# sourceMappingURL=vipps-auth.service.js.map