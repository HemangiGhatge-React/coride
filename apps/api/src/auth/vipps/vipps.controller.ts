import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { VippsAuthService } from './vipps-auth.service';

class StartQueryDto {
  @IsString()
  app_redirect: string;

  // base64url SHA-256 digest
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  code_challenge: string;
}

class CallbackQueryDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsString() error?: string;
  @IsOptional() @IsString() error_description?: string;
  @IsOptional() @IsString() error_code?: string;
}

class ExchangeDto {
  @IsString()
  @MinLength(1)
  code: string;

  // RFC 7636 verifier length bounds
  @IsString()
  @Length(43, 128)
  code_verifier: string;
}

@Controller('auth/vipps')
export class VippsController {
  constructor(private vippsAuth: VippsAuthService) {}

  /** Opened by the app in an auth browser session; redirects to Vipps. */
  @Get('start')
  async start(@Query() query: StartQueryDto, @Res() res: Response) {
    res.redirect(
      await this.vippsAuth.start(query.app_redirect, query.code_challenge),
    );
  }

  /** Vipps redirects here (VIPPS_REDIRECT_URI); we redirect into the app. */
  @Get('callback')
  async callback(@Query() query: CallbackQueryDto, @Res() res: Response) {
    res.redirect(await this.vippsAuth.callback(query));
  }

  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() body: ExchangeDto) {
    return this.vippsAuth.exchange(body.code, body.code_verifier);
  }
}
