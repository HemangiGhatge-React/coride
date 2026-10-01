import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { UsersService } from '../../users/users.service';
import { TokensService } from '../tokens.service';
import { VippsClient, VippsError } from './vipps.client';

const STATE_AUDIENCE = 'coride:vipps-state';
const LOGIN_CODE_AUDIENCE = 'coride:vipps-login-code';
const STATE_TTL = '10m';
const LOGIN_CODE_TTL = '2m';

/** Error codes delivered to the app on the final redirect. The app maps these to UI copy. */
export type VippsLoginError =
  | 'cancelled'
  | 'vipps_error'
  | 'email_conflict'
  | 'invalid_state'
  | 'not_configured';

interface StatePayload {
  nonce: string;
  codeChallenge: string;
  appRedirect: string;
}

interface LoginCodePayload {
  sub: string;
  cc: string;
}

/**
 * Orchestrates mobile → Vipps → backend → mobile login.
 *
 * The app generates a PKCE pair and sends only the challenge to /start. The
 * challenge travels inside the signed `state`, and the one-time login code the
 * app finally receives is bound to it, so only the app instance that started
 * the flow can redeem it for a session. Session tokens never appear in a URL.
 */
@Injectable()
export class VippsAuthService {
  private readonly logger = new Logger(VippsAuthService.name);

  constructor(
    private vipps: VippsClient,
    private jwt: JwtService,
    private config: ConfigService,
    private users: UsersService,
    private tokens: TokensService,
  ) {}

  /** Allowlisted app deep links; prevents /start from being used as an open redirect. */
  private allowedAppRedirects(): string[] {
    return (this.config.get<string>('VIPPS_APP_REDIRECT_URIS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async start(appRedirect: string, codeChallenge: string): Promise<string> {
    if (!this.allowedAppRedirects().includes(appRedirect)) {
      throw new BadRequestException('INVALID_APP_REDIRECT');
    }
    const cfg = this.vipps.getConfig();
    if (!cfg) {
      return this.appRedirectUrl(appRedirect, { error: 'not_configured' });
    }
    const nonce = randomUUID();
    const state = this.jwt.sign(
      { nonce, codeChallenge, appRedirect } satisfies StatePayload,
      {
        audience: STATE_AUDIENCE,
        expiresIn: STATE_TTL,
      },
    );
    try {
      return await this.vipps.buildAuthorizeUrl(cfg, state, nonce);
    } catch (err) {
      this.logger.warn(`Vipps start failed: ${(err as Error).message}`);
      return this.appRedirectUrl(appRedirect, { error: 'vipps_error' });
    }
  }

  /** Handles Vipps' redirect back to us. Always returns a URL to redirect the browser to. */
  async callback(query: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }): Promise<string> {
    let state: StatePayload;
    try {
      state = this.jwt.verify<StatePayload>(query.state ?? '', {
        audience: STATE_AUDIENCE,
      });
    } catch {
      // We cannot trust any redirect target from a bad state; fall back to the
      // first allowlisted one so the user still lands back in the app.
      const fallback = this.allowedAppRedirects()[0];
      if (!fallback) throw new BadRequestException('INVALID_STATE');
      return this.appRedirectUrl(fallback, { error: 'invalid_state' });
    }

    if (query.error) {
      this.logger.log(
        `Vipps returned error=${query.error} (${query.error_description ?? ''})`,
      );
      const error: VippsLoginError =
        query.error === 'access_denied' ? 'cancelled' : 'vipps_error';
      return this.appRedirectUrl(state.appRedirect, { error });
    }

    const cfg = this.vipps.getConfig();
    if (!cfg || !query.code) {
      return this.appRedirectUrl(state.appRedirect, {
        error: cfg ? 'vipps_error' : 'not_configured',
      });
    }

    try {
      const identity = await this.vipps.resolveIdentity(
        cfg,
        query.code,
        state.nonce,
      );
      const user = await this.users.findOrCreateFromVipps(identity);
      const loginCode = this.jwt.sign(
        { sub: user.id, cc: state.codeChallenge } satisfies LoginCodePayload,
        {
          audience: LOGIN_CODE_AUDIENCE,
          expiresIn: LOGIN_CODE_TTL,
        },
      );
      return this.appRedirectUrl(state.appRedirect, { code: loginCode });
    } catch (err) {
      if (err instanceof ConflictException) {
        return this.appRedirectUrl(state.appRedirect, {
          error: 'email_conflict',
        });
      }
      if (!(err instanceof VippsError)) throw err;
      this.logger.warn(`Vipps callback failed: ${err.message}`);
      return this.appRedirectUrl(state.appRedirect, { error: 'vipps_error' });
    }
  }

  /** App redeems the login code + its PKCE verifier for a session. */
  async exchange(code: string, codeVerifier: string) {
    let payload: LoginCodePayload;
    try {
      payload = this.jwt.verify<LoginCodePayload>(code, {
        audience: LOGIN_CODE_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('INVALID_LOGIN_CODE');
    }
    const challenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    if (challenge !== payload.cc) {
      throw new UnauthorizedException('INVALID_LOGIN_CODE');
    }
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('INVALID_LOGIN_CODE');

    const { password, ...safeUser } = user;
    return { ...(await this.tokens.issueSession(user)), user: safeUser };
  }

  private appRedirectUrl(
    appRedirect: string,
    params: { code: string } | { error: VippsLoginError },
  ): string {
    const sep = appRedirect.includes('?') ? '&' : '?';
    return `${appRedirect}${sep}${new URLSearchParams(params).toString()}`;
  }
}
