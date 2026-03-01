import { Router } from "express";
import { twiml as Twiml } from "twilio";
import { prisma } from "../../lib/prisma";
import { verifyTwilioRequest } from "../../middleware/webhook-security";

export const smsRouter = Router();

smsRouter.post("/", verifyTwilioRequest, async (req, res) => {
  const toNumber = (req.body.To as string | undefined) || "";
  const orgPhone = await prisma.phoneNumber.findFirst({
    where: { e164Number: toNumber, status: { not: "RELEASED" } },
    include: { organization: { include: { businessSettings: true } } }
  });
  const response = new Twiml.MessagingResponse();
  if (!orgPhone?.organization) {
    response.message("This SMS line is not configured.");
    return res.type("text/xml").send(response.toString());
  }

  if (!orgPhone.organization.live || orgPhone.organization.status !== "LIVE") {
    response.message(`Thanks for contacting ${orgPhone.organization.name}. Your account is in setup mode and we'll follow up soon.`);
    return res.type("text/xml").send(response.toString());
  }

  response.message(`Thanks for contacting ${orgPhone.organization.name}. We received your message and will follow up shortly.`);
  return res.type("text/xml").send(response.toString());
});
