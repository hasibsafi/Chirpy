import { describe, it, expect, beforeAll } from "vitest";
import { makeJWT, validateJWT, hashPassword, checkPasswordHash } from "./auth";
import {getBearerToken} from "./auth";
import type { Request } from "express";
import { getAPIKey } from "./auth";

const SECRET = "test-secret-key";

describe("Password Hashing", () => {
  const password1 = "correctPassword123!";
  const password2 = "anotherPassword456!";
  let hash1: string;
  let hash2: string;

  beforeAll(async () => {
    hash1 = await hashPassword(password1);
    hash2 = await hashPassword(password2);
  });

  it("should return true for the correct password", async () => {
    const result = await checkPasswordHash(password1, hash1);
    expect(result).toBe(true);
  });

  it("should return false for the wrong password", async () => {
    const result = await checkPasswordHash(password2, hash1);
    expect(result).toBe(false);
  });
});

describe("JWT Creation and Validation", () => {
  const userId = "user-123";
  const expiresIn = 3600; // 1 hour in seconds

  it("should create and validate a JWT", () => {
    const token = makeJWT(userId, expiresIn, SECRET);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const decodedUserId = validateJWT(token, SECRET);
    expect(decodedUserId).toBe(userId);
  });

  it("should reject JWTs signed with the wrong secret", () => {
    const token = makeJWT(userId, expiresIn, SECRET);
    expect(() => validateJWT(token, "wrong-secret")).toThrow("Invalid or expired token");
  });

  it("should reject expired tokens", () => {
    const token = makeJWT(userId, -1, SECRET); // expires immediately (iat + (-1) = 1 second ago)
    expect(() => validateJWT(token, SECRET)).toThrow("Invalid or expired token");
  });
});

describe("getBearerToken", () => {
  it("should return the token from a valid Bearer header", () => {
    const req = {
      get: (name: string) => (name === "Authorization" ? "Bearer my-token-123" : undefined),
    } as unknown as Request;
    expect(getBearerToken(req)).toBe("my-token-123");
  });

  it("should throw when Authorization header is missing", () => {
    const req = { get: () => undefined } as unknown as Request;
    expect(() => getBearerToken(req)).toThrow("Missing Authorization header");
  });

  it("should throw when header format is invalid", () => {
    const req = { get: () => "InvalidFormat" } as unknown as Request;
    expect(() => getBearerToken(req)).toThrow("Invalid Authorization header format");
  });
});

//getAPIKey
describe("getAPIKey", () => {
  it("should return the key from a valid ApiKey header", () => {
    const req = {
      get: (name: string) => (name === "Authorization" ? "ApiKey my-secret-key" : undefined),
    } as unknown as Request;
    expect(getAPIKey(req)).toBe("my-secret-key");
  });

  it("should throw when Authorization header is missing", () => {
    const req = { get: () => undefined } as unknown as Request;
    expect(() => getAPIKey(req)).toThrow("Missing Authorization header");
  });

  it("should throw when header format is invalid", () => {
    const req = { get: () => "Bearer token" } as unknown as Request;
    expect(() => getAPIKey(req)).toThrow("Invalid Authorization header format");
  });
});