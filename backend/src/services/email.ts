import nodemailer from "nodemailer";
import { env } from "../config/env";

function buildTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: env.SMTP_SECURE === "true",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

async function sendOrLog(subject: string, text: string, to: string) {
  const transporter = buildTransporter();
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.log("[email-stub]", subject, "\n" + text);
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text
  });
}

export async function sendLeadNotificationEmail(payload: {
  leadId: string;
  name: string;
  business: string;
  phone: string;
  email: string;
  sourcePage?: string | null;
  adminUrl: string;
}) {
  const subject = `New Lead: ${payload.business} (${payload.name})`;
  const text = [
    "New lead captured.",
    `Lead ID: ${payload.leadId}`,
    `Name: ${payload.name}`,
    `Business: ${payload.business}`,
    `Phone: ${payload.phone}`,
    `Email: ${payload.email}`,
    `Source Page: ${payload.sourcePage || "-"}`,
    `Admin Link: ${payload.adminUrl}/admin/leads/${payload.leadId}`
  ].join("\n");

  await sendOrLog(subject, text, env.LEAD_NOTIFICATION_EMAIL);
}

export async function sendNewSubscribedClientNotification(payload: {
  clientName: string;
  email: string;
  plan: string;
  clientId: string;
}) {
  const subject = `New subscribed client: ${payload.clientName}`;
  const text = [
    "A new client subscription was completed.",
    `Client: ${payload.clientName}`,
    `Email: ${payload.email}`,
    `Plan: ${payload.plan}`,
    `Client ID: ${payload.clientId}`
  ].join("\n");
  await sendOrLog(subject, text, env.LEAD_NOTIFICATION_EMAIL);
}

export async function sendClientWelcomeEmail(payload: {
  email: string;
  tempPassword: string;
  appUrl: string;
}) {
  const subject = "Your Khan Automation Systems dashboard access";
  const text = [
    "Your workspace is created.",
    `Login email: ${payload.email}`,
    `Temporary password: ${payload.tempPassword}`,
    `Login URL: ${payload.appUrl}/admin/login`,
    "Please change credentials after first login."
  ].join("\n");
  await sendOrLog(subject, text, payload.email);
}
