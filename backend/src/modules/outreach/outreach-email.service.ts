import { env } from "../../config/env";

const SEND_TIMEOUT_MS = 12_000;

export type OutreachSendResult = {
  provider: "resend";
  providerMessageId: string | null;
  raw: Record<string, unknown> | null;
};

export function buildOutreachFromEmail() {
  return env.EMAIL_FROM_OUTREACH;
}

export async function sendOutreachEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<OutreachSendResult> {
  if (!env.RESEND_API_KEY) {
    throw new Error("resend_not_configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: buildOutreachFromEmail(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text
      }),
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = typeof payload?.message === "string" ? payload.message : `resend_send_failed_${response.status}`;
      throw new Error(message);
    }

    const providerMessageId =
      typeof payload?.id === "string"
        ? payload.id
        : typeof payload?.["data"] === "object" && payload.data && typeof (payload.data as Record<string, unknown>).id === "string"
          ? ((payload.data as Record<string, unknown>).id as string)
          : null;

    return {
      provider: "resend",
      providerMessageId,
      raw: payload
    };
  } finally {
    clearTimeout(timeout);
  }
}
