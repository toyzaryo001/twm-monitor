interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    networkId?: string | null;
}
export declare function signToken(payload: TokenPayload): string;
export declare function verifyToken(token: string): TokenPayload | null;
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, stored: string): Promise<boolean>;
export declare function generateSecret(length?: number): string;
export {};
//# sourceMappingURL=auth.d.ts.map