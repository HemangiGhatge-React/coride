import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './jwt.strategy';
import { TokensService } from './tokens.service';
import { VippsClient } from './vipps/vipps.client';
import { VippsAuthService } from './vipps/vipps-auth.service';
import { VippsController } from './vipps/vipps.controller';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // Expiry and audience are set per token type at sign time (see TokensService,
    // VippsAuthService) rather than one global default.
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    TokensService,
    VippsClient,
    VippsAuthService,
  ],
  controllers: [AuthController, VippsController],
})
export class AuthModule {}
