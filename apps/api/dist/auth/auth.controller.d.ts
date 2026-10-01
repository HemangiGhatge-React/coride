import { AuthService } from './auth.service';
declare class RegisterDto {
    email: string;
    password: string;
    name: string;
}
declare class LoginDto {
    email: string;
    password: string;
}
declare class RefreshTokenDto {
    refresh_token: string;
}
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(body: RegisterDto): Promise<{
        id: string;
        email: string;
        vippsSub: string | null;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    }>;
    login(body: LoginDto): Promise<{
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
    refresh(body: RefreshTokenDto): Promise<import("./tokens.service").SessionTokens>;
    logout(body: RefreshTokenDto): Promise<void>;
    me(req: {
        user: {
            userId: string;
        };
    }): Promise<{
        id: string;
        email: string;
        vippsSub: string | null;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    }>;
}
export {};
