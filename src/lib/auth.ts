import argon2 from "argon2";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

import type { AuthUser } from "@/lib/database-types";
import {
  approveUser,
  countUsers,
  createSession,
  createUser,
  deletePendingUser,
  disableUserTwoFactor,
  deleteExpiredSessions,
  deleteSession,
  enableUserTwoFactor,
  getSessionUserByTokenHash,
  getUserByEmail,
  getUserWithTotpById,
  listPendingUsers,
  setUserTotpSecret,
} from "@/lib/sqlite";

const SESSION_COOKIE_NAME = "barcelona_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export class AuthError extends Error {
  status: number;
  requiresTwoFactor: boolean;

  constructor(
    message: string,
    status = 401,
    options?: { requiresTwoFactor?: boolean },
  ) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.requiresTwoFactor = options?.requiresTwoFactor ?? false;
  }
}

export async function registerUser(input: {
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  validatePassword(input.password);

  if (getUserByEmail(email)) {
    throw new AuthError("An account with that email already exists", 409);
  }

  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });
  const isFirstUser = countUsers() === 0;
  const user = createUser({
    email,
    passwordHash,
    isAdmin: isFirstUser,
    isApproved: isFirstUser,
  });

  return {
    user,
    autoApproved: isFirstUser,
  };
}

export async function loginUser(input: {
  email: string;
  password: string;
  totpCode?: string;
}) {
  const email = normalizeEmail(input.email);
  const user = getUserByEmail(email);

  if (!user) {
    throw new AuthError("Invalid email or password", 401);
  }

  const matches = await argon2.verify(user.passwordHash, input.password);

  if (!matches) {
    throw new AuthError("Invalid email or password", 401);
  }

  if (!user.isApproved) {
    throw new AuthError("Your account is pending admin approval", 403);
  }

  if (user.twoFactorEnabled) {
    if (!input.totpCode) {
      throw new AuthError("Two-factor code required", 401, {
        requiresTwoFactor: true,
      });
    }

    const isValid = verifyTotpToken(user.email, user.totpSecret, input.totpCode);

    if (!isValid) {
      throw new AuthError("Invalid two-factor code", 401, {
        requiresTwoFactor: true,
      });
    }
  }

  return user;
}

export async function createUserSession(userId: number) {
  deleteExpiredSessions();

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  ).toISOString();

  createSession({
    tokenHash,
    userId,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    deleteSession(hashSessionToken(token));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  deleteExpiredSessions();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const user = getSessionUserByTokenHash(hashSessionToken(token));

  if (!user || !user.isApproved) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    if (token) {
      deleteSession(hashSessionToken(token));
    }
    return null;
  }

  return user;
}

export async function requirePageUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requirePageAdmin() {
  const user = await requirePageUser();

  if (!user.isAdmin) {
    redirect("/");
  }

  return user;
}

export async function requireApiUser(options?: { admin?: boolean }) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError("Authentication required", 401);
  }

  if (options?.admin && !user.isAdmin) {
    throw new AuthError("Admin access required", 403);
  }

  return user;
}

export function listPendingApprovalUsers() {
  return listPendingUsers();
}

export function approvePendingUser(userId: number) {
  const user = approveUser(userId);

  if (!user) {
    throw new AuthError("User not found", 404);
  }

  return user;
}

export function removePendingUser(userId: number) {
  const removed = deletePendingUser(userId);

  if (!removed) {
    throw new AuthError("Pending user not found", 404);
  }
}

export async function getTwoFactorSetup(userId: number) {
  const user = getUserWithTotpById(userId);

  if (!user) {
    throw new AuthError("User not found", 404);
  }

  const secret = user.totpSecret ?? new OTPAuth.Secret().base32;

  if (!user.totpSecret) {
    setUserTotpSecret(userId, secret);
  }

  const totp = createTotp(user.email, secret);
  const otpauthUrl = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    enabled: user.twoFactorEnabled,
    secret,
    otpauthUrl,
    qrDataUrl,
  };
}

export function confirmTwoFactorSetup(userId: number, token: string) {
  const user = getUserWithTotpById(userId);

  if (!user || !user.totpSecret) {
    throw new AuthError("Two-factor setup has not been started", 400);
  }

  if (!verifyTotpToken(user.email, user.totpSecret, token)) {
    throw new AuthError("Invalid verification code", 400);
  }

  enableUserTwoFactor(userId);
}

export async function turnOffTwoFactor(userId: number, password: string) {
  const user = getUserWithTotpById(userId);

  if (!user || !user.totpSecret || !user.twoFactorEnabled) {
    throw new AuthError("Two-factor authentication is not enabled", 400);
  }

  const userWithPassword = getUserByEmail(user.email);

  if (!userWithPassword) {
    throw new AuthError("User not found", 404);
  }

  const matches = await argon2.verify(userWithPassword.passwordHash, password);

  if (!matches) {
    throw new AuthError("Incorrect password", 401);
  }

  disableUserTwoFactor(userId);
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("A valid email address is required", 400);
  }

  return email;
}

function validatePassword(password: string) {
  if (password.length < 10) {
    throw new AuthError("Password must be at least 10 characters long", 400);
  }
}

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createTotp(email: string, secret: string) {
  return new OTPAuth.TOTP({
    issuer: "Barcelona",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

function verifyTotpToken(
  email: string,
  secret: string | null,
  token: string,
) {
  if (!secret) {
    return false;
  }

  const sanitizedToken = token.replace(/\s+/g, "");

  if (!/^\d{6}$/.test(sanitizedToken)) {
    return false;
  }

  return createTotp(email, secret).validate({
    token: sanitizedToken,
    window: 1,
  }) !== null;
}
