import { createHash } from 'crypto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { VippsAuthService } from './vipps-auth.service';
import { VippsClient, VippsError } from './vipps.client';
import { UsersService } from '../../users/users.service';
import { TokensService } from '../tokens.service';

// Keep jose (ESM) and Prisma out of the test runtime.
jest.mock('./vipps.client', () => ({
  VippsClient: class {},
  VippsError: class VippsError extends Error {},
}));
jest.mock('../../users/users.service', () => ({ UsersService: class {} }));
jest.mock('../tokens.service', () => ({ TokensService: class {} }));

const APP = 'coride://auth/vipps';
const verifier = 'v'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const cfg = { clientId: 'c' };

function setup(overrides: { config?: object | null } = {}) {
  const jwt = new JwtService({ secret: 'test-secret' });
  const vipps = {
    getConfig: jest.fn(() =>
      overrides.config === undefined ? cfg : overrides.config,
    ),
    buildAuthorizeUrl: jest.fn(
      async (_c, state: string) => `https://vipps.test/auth?state=${state}`,
    ),
    resolveIdentity: jest.fn(async () => ({
      sub: 's1',
      email: 'a@b.no',
      emailVerified: true,
      name: 'A',
    })),
  };
  const users = {
    findOrCreateFromVipps: jest.fn(async () => ({ id: 'u1' })),
    findById: jest.fn(async () => ({
      id: 'u1',
      email: 'a@b.no',
      role: 'DRIVER',
      password: null,
    })),
  };
  const tokens = {
    issueSession: jest.fn(async () => ({
      access_token: 'at',
      refresh_token: 'rt',
    })),
  };
  const config = {
    get: (k: string) =>
      k === 'VIPPS_APP_REDIRECT_URIS'
        ? `${APP}, exp://x/--/auth/vipps`
        : undefined,
  };
  const service = new VippsAuthService(
    vipps as unknown as VippsClient,
    jwt,
    config as unknown as ConfigService,
    users as unknown as UsersService,
    tokens as unknown as TokensService,
  );
  return { service, vipps, users, tokens };
}

const param = (url: string, key: string) => new URL(url).searchParams.get(key);

async function startState(service: VippsAuthService) {
  return param(await service.start(APP, challenge), 'state')!;
}

describe('VippsAuthService', () => {
  it('refuses app redirects that are not allowlisted', async () => {
    const { service } = setup();
    await expect(
      service.start('https://evil.example/cb', challenge),
    ).rejects.toThrow('INVALID_APP_REDIRECT');
  });

  it('sends the user back to the app with not_configured when Vipps env is missing', async () => {
    const { service } = setup({ config: null });
    expect(await service.start(APP, challenge)).toBe(
      `${APP}?error=not_configured`,
    );
  });

  it('maps a user cancel (access_denied) to error=cancelled', async () => {
    const { service } = setup();
    const state = await startState(service);
    const url = await service.callback({ state, error: 'access_denied' });
    expect(url).toBe(`${APP}?error=cancelled`);
  });

  it('maps other Vipps errors to error=vipps_error', async () => {
    const { service } = setup();
    const state = await startState(service);
    expect(await service.callback({ state, error: 'server_error' })).toBe(
      `${APP}?error=vipps_error`,
    );
  });

  it('maps token/ID-token/network failures during code exchange to vipps_error', async () => {
    const { service, vipps } = setup();
    vipps.resolveIdentity.mockRejectedValueOnce(new VippsError('timeout'));
    const state = await startState(service);
    expect(await service.callback({ state, code: 'c' })).toBe(
      `${APP}?error=vipps_error`,
    );
  });

  it('maps an unverified-email collision to email_conflict', async () => {
    const { service, users } = setup();
    users.findOrCreateFromVipps.mockRejectedValueOnce(
      new ConflictException('EMAIL_ALREADY_REGISTERED'),
    );
    const state = await startState(service);
    expect(await service.callback({ state, code: 'c' })).toBe(
      `${APP}?error=email_conflict`,
    );
  });

  it('rejects a forged state and falls back to the first allowlisted redirect', async () => {
    const { service } = setup();
    expect(await service.callback({ state: 'forged', code: 'c' })).toBe(
      `${APP}?error=invalid_state`,
    );
  });

  it('happy path: login code is only redeemable with the matching PKCE verifier', async () => {
    const { service, tokens } = setup();
    const state = await startState(service);
    const code = param(
      await service.callback({ state, code: 'vipps-code' }),
      'code',
    )!;

    await expect(service.exchange(code, 'w'.repeat(43))).rejects.toThrow(
      UnauthorizedException,
    );

    const session = await service.exchange(code, verifier);
    expect(session).toMatchObject({
      access_token: 'at',
      refresh_token: 'rt',
      user: { id: 'u1' },
    });
    expect(session.user).not.toHaveProperty('password');
    expect(tokens.issueSession).toHaveBeenCalledTimes(1);
  });

  it('a login code cannot be used where a state is expected, and vice versa', async () => {
    const { service } = setup();
    const state = await startState(service);
    await expect(service.exchange(state, verifier)).rejects.toThrow(
      'INVALID_LOGIN_CODE',
    );
  });
});
