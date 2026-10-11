import {
  Body,
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie';

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  name: string;
}

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

// Mobile sends the token in the body; web sends it as an httpOnly cookie (no body).
// `body` is undefined (not {}) when the request has no body, which is the normal web case.
class RefreshTokenDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  refresh_token?: string;
}

// Web clients send `X-Client: web` and get the refresh token only in the httpOnly cookie, so
// script on the page can never read it. Clients without the header (mobile) get it in the body.
function isWebClient(req: Request) {
  return req.headers['x-client'] === 'web';
}

function forClient<T extends { refresh_token: string }>(req: Request, result: T) {
  if (!isWebClient(req)) return result;
  const { refresh_token: _omitted, ...rest } = result;
  return rest;
}

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'] };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      body.email,
      body.password,
      sessionMeta(req),
    );
    setRefreshCookie(res, result.refresh_token);
    return forClient(req, result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = body?.refresh_token ?? readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    try {
      const result = await this.authService.refresh(token, sessionMeta(req));
      setRefreshCookie(res, result.refresh_token);
      return forClient(req, result);
    } catch (err) {
      // A rejected token should not keep being sent by the browser (but keep it on server errors).
      if (err instanceof UnauthorizedException) clearRefreshCookie(res);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = body?.refresh_token ?? readRefreshCookie(req);
    if (token) await this.authService.logout(token);
    clearRefreshCookie(res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: { userId: string } }) {
    return this.authService.me(req.user.userId);
  }
}
