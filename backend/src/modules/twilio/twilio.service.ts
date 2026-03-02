import Twilio from "twilio";
import { env } from "../../config/env";

function getTwilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  return Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

export async function provisionNumber(options: {
  areaCode?: string;
  sms?: boolean;
  voiceWebhookUrl: string;
  smsWebhookUrl?: string;
}) {
  const client = getTwilioClient();
  if (!client) {
    throw new Error("Twilio credentials are not configured.");
  }

  let available = await client.availablePhoneNumbers("US").local.list({
    areaCode: options.areaCode ? Number(options.areaCode) : undefined,
    limit: 1,
    smsEnabled: options.sms || false,
    voiceEnabled: true
  });

  if (!available.length) {
    available = await client.availablePhoneNumbers("US").local.list({
      limit: 1,
      smsEnabled: options.sms || false,
      voiceEnabled: true
    });
  }

  if (!available.length) {
    throw new Error("No available Twilio numbers were found.");
  }

  const chosen = available[0];
  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: chosen.phoneNumber,
    voiceUrl: options.voiceWebhookUrl,
    voiceMethod: "POST",
    smsUrl: options.sms ? options.smsWebhookUrl : undefined,
    smsMethod: options.sms ? "POST" : undefined
  });

  return {
    sid: purchased.sid,
    phoneNumber: purchased.phoneNumber,
    voiceWebhookUrl: options.voiceWebhookUrl,
    smsWebhookUrl: options.sms ? options.smsWebhookUrl || null : null,
    capabilitiesJson: JSON.stringify({
      voice: true,
      sms: Boolean(options.sms)
    })
  };
}

export async function configureWebhooks(input: {
  sid: string;
  voiceWebhookUrl: string;
  smsWebhookUrl?: string | null;
}) {
  const client = getTwilioClient();
  if (!client) {
    throw new Error("Twilio credentials are not configured.");
  }

  const updated = await client.incomingPhoneNumbers(input.sid).update({
    voiceUrl: input.voiceWebhookUrl,
    voiceMethod: "POST",
    smsUrl: input.smsWebhookUrl || undefined,
    smsMethod: input.smsWebhookUrl ? "POST" : undefined
  });

  return updated;
}

export async function releaseNumber(sid: string) {
  const client = getTwilioClient();
  if (!client) {
    throw new Error("Twilio credentials are not configured.");
  }
  await client.incomingPhoneNumbers(sid).remove();
}

export async function sendSmsMessage(input: {
  from: string;
  to: string;
  body: string;
}) {
  const client = getTwilioClient();
  if (!client) {
    throw new Error("Twilio credentials are not configured.");
  }
  const message = await client.messages.create({
    from: input.from,
    to: input.to,
    body: input.body
  });

  return {
    sid: message.sid,
    status: message.status
  };
}
