import { Router } from "express";
import { twiml as Twiml } from "twilio";
import { prisma } from "../../lib/prisma";

export const smsRouter = Router();

smsRouter.post("/", async (req, res) => {
  const toNumber = (req.body.To as string | undefined) || "";
  const orgPhone = await prisma.phoneNumber.findFirst({
    where: { e164Number: toNumber, status: { not: "RELEASED" } },
    include: { organization: true }
  });
  const response = new Twiml.MessagingResponse();
  if (!orgPhone?.organization) {
    response.message("This SMS line is not configured.");
    return res.type("text/xml").send(response.toString());
  }

  response.message(`Thanks for contacting ${orgPhone.organization.name}. We received your message and will follow up shortly.`);
  return res.type("text/xml").send(response.toString());
});
