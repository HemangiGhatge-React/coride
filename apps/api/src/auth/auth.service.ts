import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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
    if (!user) return null;
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
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }
}