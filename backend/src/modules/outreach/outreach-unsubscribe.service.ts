import { createHmac, timingSafeEqual } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { normalizeEmail, stopEnrollmentsForLead } from "./outreach-stop.service";

type UnsubscribePayload = {
  orgId: string;
  leadId: string;
  email: string;
  exp: number;
};

function base64urlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64urlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");
}

export function createOutreachUnsubscribeToken(input: { orgId: string; leadId: string; email: string }) {
  const payload: UnsubscribePayload = {
    orgId: input.orgId,
    leadId: input.leadId,
    email: normalizeEmail(input.email),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 365
  };
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyOutreachUnsubscribeToken(token: string): UnsubscribePayload {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) throw new Error("invalid_unsubscribe_token");
  const expected = sign(encodedPayload);
  if (signature.length !== expected.length) throw new Error("invalid_unsubscribe_token");
  const matches = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!matches) throw new Error("invalid_unsubscribe_token");
  const payload = JSON.parse(base64urlDecode(encodedPayload)) as UnsubscribePayload;
  if (!payload?.orgId || !payload?.leadId || !payload?.email) throw new Error("invalid_unsubscribe_token");
  if (payload.exp < Date.now()) throw new Error("expired_unsubscribe_token");
  return payload;
}

export function buildOutreachUnsubscribeUrl(input: { orgId: string; leadId: string; email: string }) {
  const token = createOutreachUnsubscribeToken(input);
  return `${env.OUTREACH_BASE_URL.replace(/\/$/, "")}/outreach/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function unsubscribeOutreachRecipient(input: {
  prisma: PrismaClient;
  token: string;
}) {
  const payload = verifyOutreachUnsubscribeToken(input.token);
  const email = normalizeEmail(payload.email);

  await input.prisma.$transaction(async (tx) => {
    const db = tx as any;
    await db.outreachSuppression.upsert({
      where: {
        orgId_email: {
          orgId: payload.orgId,
          email
        }
      },
      update: {
        reason: "UNSUBSCRIBED",
        source: "UNSUBSCRIBE_LINK"
      },
      create: {
        orgId: payload.orgId,
        email,
        reason: "UNSUBSCRIBED",
        source: "UNSUBSCRIBE_LINK"
      }
    });

    await db.outreachLead.updateMany({
      where: {
        orgId: payload.orgId,
        id: payload.leadId,
        email
      },
      data: {
        status: "UNSUBSCRIBED"
      }
    });

    await stopEnrollmentsForLead({
      prisma: tx,
      orgId: payload.orgId,
      leadId: payload.leadId,
      reason: "UNSUBSCRIBED",
      eventType: "UNSUBSCRIBED",
      metadata: { source: "unsubscribe_link" }
    });
  });

  return payload;
}
