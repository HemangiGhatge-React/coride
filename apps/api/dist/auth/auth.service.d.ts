import { UsersService } from '../users/users.service';
import { TokensService } from './tokens.service';
export declare class AuthService {
    private usersService;
    private tokensService;
    constructor(usersService: UsersService, tokensService: TokensService);
    register(data: {
        email: string;
        password: string;
        name: string;
    }): Promise<{
        id: string;
        email: string;
        vippsSub: string | null;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    }>;
    validateUser(email: string, plainPassword: string): Promise<{
        id: string;
        email: string;
        vippsSub: string | null;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    } | null>;
    login(email: string, plainPassword: string): Promise<{
        user: {
            id: string;
            email: string;
            vippsSub: string | null;
            name: string;
            role: import("@prisma/client").$Enums.Role;
            createdAt: Date;
        };
        access_token: string;
        refresh_token: string;
    }>;
    refresh(refreshToken: string): Promise<import("./tokens.service").SessionTokens>;
    logout(refreshToken: string): Promise<void>;
    me(userId: string): Promise<{
        id: string;
        email: string;
        vippsSub: string | null;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    }>;
}
