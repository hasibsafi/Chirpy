import argon2 from "argon2";
import jwt, { JwtPayload } from "jsonwebtoken";
import type { Request } from "express";
import crypto from "crypto";

// hash password
export async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
}

export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
}

// make JWT
type JwtPayloadFields = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function makeJWT(userID: string, expiresIn: number, secret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const payload: JwtPayloadFields = {
    iss: "chirpy",
    sub: userID,
    iat,
    exp: iat + expiresIn,
  };
  return jwt.sign(payload, secret);
}

export function validateJWT(tokenString: string, secret: string): string {
    try {
      const decoded = jwt.verify(tokenString, secret) as JwtPayload;
      if (typeof decoded.sub !== "string") {
        throw new Error("Invalid token: missing subject");
      }
      return decoded.sub;
    } catch (err) {
      throw new Error("Invalid or expired token");
    }
  }
 // get bearer token from request
  export function getBearerToken(req: Request): string {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      throw new Error("Invalid Authorization header format");
    }
    return parts[1];
  }

  // generate refresh token
  export function makeRefreshToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // get polka api key from request
  export function getAPIKey(req: Request): string {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== "apikey") {
      throw new Error("Invalid Authorization header format");
    }
    return parts[1];
  }