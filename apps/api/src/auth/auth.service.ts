import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { TokensService } from './tokens.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tokensService: TokensService,
  ) {}

  async register(data: { email: string; password: string; name: string }) {
    const hashed = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      email: data.email,
      password: hashed,
      name: data.name,
    });
    const { password, ...result } = user;
    return result;
  }

  async validateUser(email: string, plainPassword: string) {
    const user = await this.usersService.findByEmail(email);
    // Vipps-only accounts have no password and cannot use password login.
    if (!user || !user.password) return null;
    const match = await bcrypt.compare(plainPassword, user.password);
    if (!match) return null;
    const { password, ...result } = user;
    return result;
  }

  async login(email: string, plainPassword: string) {
    const user = await this.validateUser(email, plainPassword);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { ...(await this.tokensService.issueSession(user)), user };
  }

  async refresh(refreshToken: string) {
    return this.tokensService.rotate(refreshToken);
  }

  async logout(refreshToken: string) {
    await this.tokensService.revoke(refreshToken);
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    const { password, ...result } = user;
    return result;
  }
}
