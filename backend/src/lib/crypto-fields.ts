import crypto from "crypto";
import { env } from "../config/env";

function getKey() {
  const raw = String(env.ENCRYPTION_KEY_BASE64 || "").trim();
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length !== 32) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function encryptField(value: string) {
  const key = getKey();
  if (!key) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptField(value: string) {
  if (!value.startsWith("enc:v1:")) return value;
  const key = getKey();
  if (!key) return value;
  const [, , ivB64, tagB64, payloadB64] = value.split(":");
  if (!ivB64 || !tagB64 || !payloadB64) return value;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const payload = Buffer.from(payloadB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(payload), decipher.final()]);
  return plaintext.toString("utf8");
}

