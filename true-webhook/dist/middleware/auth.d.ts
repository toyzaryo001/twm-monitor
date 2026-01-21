import { Request, Response, NextFunction } from "express";
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                email: string;
                role: string;
                networkId?: string | null;
            };
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireMaster(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireNetworkAccess(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map