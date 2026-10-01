import { PrismaService } from '../prisma/prisma.service';
export interface VippsIdentity {
    sub: string;
    email: string;
    emailVerified: boolean;
    name: string;
}
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findByEmail(email: string): Promise<{
        id: string;
        email: string;
        vippsSub: string | null;
        password: string | null;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    } | null>;
    findById(id: string): Promise<{
        id: string;
        email: string;
        vippsSub: string | null;
        password: string | null;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    } | null>;
    create(data: {
        email: string;
        password: string;
        name: string;
    }): Promise<{
        id: string;
        email: string;
        vippsSub: string | null;
        password: string | null;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    }>;
    findOrCreateFromVipps(identity: VippsIdentity): Promise<{
        id: string;
        email: string;
        vippsSub: string | null;
        password: string | null;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        createdAt: Date;
    }>;
}
