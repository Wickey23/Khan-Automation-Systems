import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, role: UserRole.SUPER_ADMIN },
    create: { email: email.toLowerCase(), passwordHash, role: UserRole.SUPER_ADMIN }
  });

  // eslint-disable-next-line no-console
  console.log(`Admin user seeded for ${email}`);

  if (process.env.SEED_OUTREACH_DEMO === "true") {
    const org = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" }
    });
    if (org) {
      const leads = [
        { companyName: "Atlas Truck Repair", contactName: "Mike Porter", email: "mike@atlastruckrepair.com", city: "Columbus", state: "OH", industry: "Truck Repair" },
        { companyName: "Northline Fleet Service", contactName: "Dana Reed", email: "dana@northlinefleet.com", city: "Indianapolis", state: "IN", industry: "Fleet Service" },
        { companyName: "Summit HVAC Service", contactName: "Chris Hale", email: "chris@summithvacservice.com", city: "Cleveland", state: "OH", industry: "HVAC" }
      ];

      for (const lead of leads) {
        const existing = await prisma.outreachLead.findFirst({
          where: { orgId: org.id, email: lead.email.toLowerCase() }
        });
        if (!existing) {
          await prisma.outreachLead.create({
            data: {
              orgId: org.id,
              email: lead.email.toLowerCase(),
              companyName: lead.companyName,
              contactName: lead.contactName,
              city: lead.city,
              state: lead.state,
              industry: lead.industry
            }
          });
        }
      }

      const sequence = await prisma.outreachSequence.upsert({
        where: { orgId_name: { orgId: org.id, name: "Intro Outreach" } },
        update: {},
        create: {
          orgId: org.id,
          name: "Intro Outreach",
          description: "Simple three-step intro sequence."
        }
      });

      const stepCount = await prisma.outreachSequenceStep.count({ where: { sequenceId: sequence.id } });
      if (stepCount === 0) {
        await prisma.outreachSequenceStep.createMany({
          data: [
            {
              sequenceId: sequence.id,
              stepNumber: 1,
              delayHours: 0,
              subject: "Quick intro from Khan Systems",
              bodyText: "Hi {{firstName}}, I help service businesses tighten missed-call follow-up and booking operations. Worth a quick look?"
            },
            {
              sequenceId: sequence.id,
              stepNumber: 2,
              delayHours: 48,
              subject: "Following up",
              bodyText: "Wanted to follow up in case my first note got buried. We help teams close follow-up gaps without replacing the office."
            },
            {
              sequenceId: sequence.id,
              stepNumber: 3,
              delayHours: 96,
              subject: "Last note",
              bodyText: "Last note from me. If improving missed-call capture and follow-up is on your list, I can send a short walkthrough."
            }
          ]
        });
      }

      // eslint-disable-next-line no-console
      console.log(`Outreach demo seed ensured for org ${org.id}`);
    }
  }
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
