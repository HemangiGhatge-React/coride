import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { VippsIdentity } from '../../users/users.service';

const REQUEST_TIMEOUT_MS = 10_000;
const DISCOVERY_TTL_MS = 60 * 60 * 1000; // Vipps sends Cache-Control: max-age=3600
export const VIPPS_SCOPES = 'openid name email';

interface OidcConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
}

interface TokenResponse {
  access_token: string;
  id_token: string;
}

interface UserInfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export interface VippsConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  merchantSerialNumber: string;
  redirectUri: string;
}

/** Thrown for any failure talking to Vipps or validating its response. */
export class VippsError extends Error {}

/**
 * Thin OIDC client for Vipps Login (authorization code flow, client_secret_basic).
 * Endpoints come from the discovery document, as Vipps recommends.
 */
@Injectable()
export class VippsClient {
  private readonly logger = new Logger(VippsClient.name);
  private discovery?: { config: OidcConfiguration; fetchedAt: number };
  private jwks?: { uri: string; getKey: JWTVerifyGetKey };

  constructor(private config: ConfigService) {}

  /** Returns null when Vipps login is not configured in this environment. */
  getConfig(): VippsConfig | null {
    const clientId = this.config.get<string>('VIPPS_CLIENT_ID');
    const clientSecret = this.config.get<string>('VIPPS_CLIENT_SECRET');
    const merchantSerialNumber = this.config.get<string>(
      'VIPPS_MERCHANT_SERIAL_NUMBER',
    );
    const redirectUri = this.config.get<string>('VIPPS_REDIRECT_URI');
    if (!clientId || !clientSecret || !merchantSerialNumber || !redirectUri)
      return null;
    return {
      baseUrl:
        this.config.get<string>('VIPPS_BASE_URL') ?? 'https://apitest.vipps.no',
      clientId,
      clientSecret,
      merchantSerialNumber,
      redirectUri,
    };
  }

  async buildAuthorizeUrl(
    cfg: VippsConfig,
    state: string,
    nonce: string,
  ): Promise<string> {
    const { authorization_endpoint } = await this.getDiscovery(cfg);
    const url = new URL(authorization_endpoint);
    url.search = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: 'code',
      scope: VIPPS_SCOPES,
      state,
      nonce,
      redirect_uri: cfg.redirectUri,
      // Our final hop is a redirect into the mobile app; lets Vipps enable its
      // return-to-app compatibility handling.
      final_redirect_is_app: 'true',
    }).toString();
    return url.toString();
  }

  /** Exchange the authorization code, verify the ID token, and fetch userinfo. */
  async resolveIdentity(
    cfg: VippsConfig,
    code: string,
    nonce: string,
  ): Promise<VippsIdentity> {
    const oidc = await this.getDiscovery(cfg);

    const tokens = await this.request<TokenResponse>(oidc.token_endpoint, {
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

    let idSub: string;
    try {
      const { payload } = await jwtVerify(
        tokens.id_token,
        this.getJwks(oidc.jwks_uri),
        {
          issuer: oidc.issuer,
          audience: cfg.clientId,
          algorithms: ['RS256'],
        },
      );
      if (payload.nonce !== nonce)
        throw new VippsError('ID token nonce mismatch');
      if (!payload.sub) throw new VippsError('ID token missing sub');
      idSub = payload.sub;
    } catch (err) {
      if (err instanceof VippsError) throw err;
      throw new VippsError(
        `ID token verification failed: ${(err as Error).message}`,
      );
    }

    const info = await this.request<UserInfoResponse>(oidc.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Merchant-Serial-Number': cfg.merchantSerialNumber,
      },
    });
    if (info.sub !== idSub)
      throw new VippsError('Userinfo sub does not match ID token');
    if (!info.email)
      throw new VippsError(
        'Userinfo missing email (is the email scope enabled?)',
      );

    return {
      sub: idSub,
      email: info.email.toLowerCase(),
      emailVerified: info.email_verified === true,
      name: info.name?.trim() || info.email,
    };
  }

  private async getDiscovery(cfg: VippsConfig): Promise<OidcConfiguration> {
    if (
      this.discovery &&
      Date.now() - this.discovery.fetchedAt < DISCOVERY_TTL_MS
    ) {
      return this.discovery.config;
    }
    const config = await this.request<OidcConfiguration>(
      `${cfg.baseUrl}/access-management-1.0/access/.well-known/openid-configuration`,
      {},
    );
    this.discovery = { config, fetchedAt: Date.now() };
    return config;
  }

  private getJwks(uri: string): JWTVerifyGetKey {
    if (!this.jwks || this.jwks.uri !== uri) {
      this.jwks = { uri, getKey: createRemoteJWKSet(new URL(uri)) };
    }
    return this.jwks.getKey;
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new VippsError(
        `Request to ${url} failed: ${(err as Error).message}`,
      );
    }
    if (!res.ok) {
      // Log the body server-side only; never forward Vipps error details to the client.
      this.logger.warn(
        `Vipps ${url} responded ${res.status}: ${await res.text().catch(() => '')}`,
      );
      throw new VippsError(`Vipps responded ${res.status}`);
    }
    return (await res.json()) as T;
  }
}
