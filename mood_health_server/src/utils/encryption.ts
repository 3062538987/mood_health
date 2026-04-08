import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY environment variable is required");
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const key = Buffer.from(ENCRYPTION_KEY!, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid encryption key length. Expected ${KEY_LENGTH} bytes, got ${key.length} bytes`,
    );
  }
  return key;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export function encrypt(text: string): string {
  if (!text) return text;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    const result: EncryptedData = {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };

    return JSON.stringify(result);
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

export function decrypt(encryptedData: string): string {
  if (!encryptedData) return encryptedData;

  if (!encryptedData.startsWith("{")) {
    return encryptedData;
  }

  try {
    const data: EncryptedData = JSON.parse(encryptedData);

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(data.iv, "hex"),
    );

    decipher.setAuthTag(Buffer.from(data.authTag, "hex"));

    let decrypted = decipher.update(data.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return encryptedData;
  }
}

export function encryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return encrypt(value);
}

export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return decrypt(value);
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("hex");
}
