import { Router } from "express";
import { twiml as Twiml } from "twilio";
import { prisma } from "../../lib/prisma";

export const smsRouter = Router();

smsRouter.post("/", async (req, res) => {
  const clientId = req.query.clientId as string | undefined;
  if (!clientId) {
    return res.status(400).type("text/xml").send("<Response><Message>Missing client identifier.</Message></Response>");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { aiConfig: true }
  });
  if (!client) {
    return res.status(404).type("text/xml").send("<Response><Message>Client not found.</Message></Response>");
  }

  const response = new Twiml.MessagingResponse();
  if (client.status !== "LIVE") {
    response.message("This SMS workflow is not active yet. Please contact the business directly.");
    return res.type("text/xml").send(response.toString());
  }

  response.message(
    client.aiConfig?.smsEnabled
      ? "Thanks, we received your message and a team member will follow up shortly."
      : "SMS support is not enabled yet for this line."
  );
  return res.type("text/xml").send(response.toString());
});
