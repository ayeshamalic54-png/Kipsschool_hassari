import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { type Request, type Response, type NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "kips-school-jwt-secret-2026";

export function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): Record<string, unknown> {
  return jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token);
    (req as Request & { user: Record<string, unknown> }).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
