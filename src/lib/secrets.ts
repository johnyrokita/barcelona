import crypto from "crypto";

const ENCRYPTED_VALUE_PREFIX = "enc:v1";

export class SecretEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretEncryptionError";
  }
}

export function encryptManagedSecret(value: string) {
  const secretKey = getRequiredSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTED_VALUE_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptManagedSecret(value: string) {
  if (!value.startsWith(`${ENCRYPTED_VALUE_PREFIX}:`)) {
    throw new SecretEncryptionError(
      "Stored managed database password is not encrypted",
    );
  }

  const [, , ivEncoded, tagEncoded, encryptedEncoded] = value.split(":");

  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new SecretEncryptionError("Stored secret is malformed");
  }

  const secretKey = getRequiredSecretKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    secretKey,
    Buffer.from(ivEncoded, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function getRequiredSecretKey() {
  const rawSecret = process.env.BARCELONA_SECRET_KEY?.trim();

  if (!rawSecret) {
    throw new SecretEncryptionError(
      "BARCELONA_SECRET_KEY is required to encrypt and decrypt managed database passwords",
    );
  }

  return crypto.createHash("sha256").update(rawSecret).digest();
}
