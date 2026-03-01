import { CallOutcome } from "@prisma/client";
import { Router } from "express";
import { twiml as Twiml } from "twilio";
import { prisma } from "../../lib/prisma";
import { isWithinBusinessHours } from "../twilio/hours";

export const voiceRouter = Router();

voiceRouter.post("/", async (req, res) => {
  const clientId = req.query.clientId as string | undefined;
  if (!clientId) {
    return res.status(400).type("text/xml").send("<Response><Say>Missing client identifier.</Say></Response>");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { setting: true, aiConfig: true, phoneLine: true }
  });

  if (!client) {
    return res.status(404).type("text/xml").send("<Response><Say>Client not found.</Say></Response>");
  }

  const response = new Twiml.VoiceResponse();
  const fromNumber = (req.body.From as string | undefined) || "unknown";
  const toNumber = (req.body.To as string | undefined) || client.phoneLine?.phoneNumber || "unknown";

  if (client.status !== "LIVE") {
    response.say("This service line is not active yet. Please contact the business directly.");
    response.hangup();
    await prisma.call.create({
      data: {
        clientId,
        fromNumber,
        toNumber,
        outcome: CallOutcome.UNKNOWN
      }
    });
    return res.type("text/xml").send(response.toString());
  }

  const withinHours = isWithinBusinessHours(client.setting?.businessHoursJson);
  const transferNumber = client.setting?.transferNumber || "";

  if (!withinHours) {
    response.say(
      client.aiConfig?.afterHoursMessage ||
        "Thanks for calling. We are currently closed. Please leave a message and we will call you back."
    );
    response.hangup();
    await prisma.call.create({
      data: {
        clientId,
        fromNumber,
        toNumber,
        outcome: CallOutcome.UNKNOWN
      }
    });
    return res.type("text/xml").send(response.toString());
  }

  response.say(client.aiConfig?.greetingText || `Thanks for calling ${client.name}. Please hold while we transfer you.`);

  if (transferNumber) {
    response.dial(transferNumber);
    await prisma.call.create({
      data: {
        clientId,
        fromNumber,
        toNumber,
        outcome: CallOutcome.TRANSFERRED
      }
    });
  } else {
    response.say("A transfer number is not configured yet. Please try again later.");
    response.hangup();
    await prisma.call.create({
      data: {
        clientId,
        fromNumber,
        toNumber,
        outcome: CallOutcome.UNKNOWN
      }
    });
  }

  return res.type("text/xml").send(response.toString());
});
