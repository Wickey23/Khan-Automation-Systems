import { Router } from "express";
import { twiml as Twiml } from "twilio";
import { prisma } from "../../lib/prisma";

export const voiceRouter = Router();

voiceRouter.post("/", async (req, res) => {
  const response = new Twiml.VoiceResponse();
  const fromNumber = (req.body.From as string | undefined) || "unknown";
  const toNumber = (req.body.To as string | undefined) || "unknown";
  const orgPhone = await prisma.phoneNumber.findFirst({
    where: { e164Number: toNumber, status: { not: "RELEASED" } },
    include: { organization: true }
  });

  if (!orgPhone?.organization) {
    response.say("This line is not configured yet.");
    response.hangup();
    return res.type("text/xml").send(response.toString());
  }

  await prisma.callLog.create({
    data: {
      orgId: orgPhone.orgId,
      providerCallId: (req.body.CallSid as string | undefined) || null,
      fromNumber,
      toNumber,
      outcome: "MESSAGE_TAKEN"
    }
  });

  response.say(`Thanks for calling ${orgPhone.organization.name}. We have received your request and will contact you shortly.`);
  response.pause({ length: 1 });
  response.say("Goodbye.");
  response.hangup();

  return res.type("text/xml").send(response.toString());
});
