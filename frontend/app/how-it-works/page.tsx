import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, MessageSquareText, PhoneCall, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "How It Works"
};

const rolloutSteps = [
  {
    title: "1. Audit the current front-desk flow",
    copy: "We map how calls are handled today, what details office staff need, how quotes are created, and where follow-up usually breaks down."
  },
  {
    title: "2. Configure intake, routing, and escalation",
    copy: "Scripts, call outcomes, appointment-request logic, alerts, and fallback rules are configured around your real workflow instead of a generic template."
  },
  {
    title: "3. Launch with guardrails",
    copy: "The system goes live with escalation controls, booking logic, and message handling tuned for reliability before we chase volume."
  },
  {
    title: "4. Tighten the workflow with real usage",
    copy: "Once calls and requests are flowing through the portal, we refine summaries, routing, follow-up behavior, and dashboard visibility based on actual office use."
  }
];

const operatingLayers = [
  {
    title: "Call intake",
    icon: PhoneCall,
    copy: "Answer inbound calls, capture job details, identify urgency, and create a cleaner first record for the office."
  },
  {
    title: "Message follow-up",
    icon: MessageSquareText,
    copy: "Confirm next steps by text, keep booking conversations moving, and give staff a cleaner inbox for manual intervention."
  },
  {
    title: "Scheduling workspace",
    icon: CalendarClock,
    copy: "Review requests first, see what is closest to booked, and keep the office focused on the work that needs a decision."
  },
  {
    title: "Operations visibility",
    icon: SlidersHorizontal,
    copy: "Use the client portal and daily dashboard to monitor booking status, action items, and system readiness in one place."
  }
];

const principles = [
  "Launch into the existing operating stack first, then change tools only if the process actually improves.",
  "Keep the front desk in control with clear escalation paths and visible action queues.",
  "Treat summaries, appointment requests, and follow-up as one workflow instead of separate systems.",
  "Optimize for reliability, readability, and handoff quality before chasing edge-case automation."
];

export default function HowItWorksPage() {
  return (
    <div>
      <section className="border-b bg-[radial-gradient(circle_at_top_left,_rgba(31,58,138,0.08),_transparent_36%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="page-shell py-14 md:py-18">
          <div className="max-w-4xl space-y-5">
            <p className="page-eyebrow">How It Works</p>
            <h1>Operational rollout built for service businesses that need cleaner intake and faster follow-up.</h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              The rollout is structured to make your office more consistent, not more complicated. We start with the real workflow, configure around it, launch with guardrails, and refine using live booking and follow-up activity.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/book">Book a 15-min Call</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/#pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell section-shell">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {rolloutSteps.map((item) => (
            <Card key={item.title} className="h-full">
              <CardContent className="space-y-3 p-6">
                <p className="text-lg font-semibold">{item.title}</p>
                <p className="text-sm leading-6 text-muted-foreground">{item.copy}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="surface-muted">
        <div className="page-shell section-shell">
          <div className="max-w-3xl space-y-3">
            <p className="page-eyebrow">What gets built</p>
            <h2>The system is organized around one operating loop</h2>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              Calls, follow-up, scheduling, and office visibility are treated as one continuous workflow. That is what makes the portal feel usable instead of fragmented.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {operatingLayers.map(({ title, icon: Icon, copy }) => (
              <Card key={title} className="shadow-none">
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">{title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell section-shell">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-start">
          <div className="space-y-4">
            <p className="page-eyebrow">Implementation principles</p>
            <h2>Designed to feel professional for office staff, not experimental.</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              The product direction is built around disciplined rollout and clean daily usage. The point is to reduce operational drag, not introduce another difficult system to manage.
            </p>
          </div>
          <Card>
            <CardContent className="space-y-3 p-6">
              {principles.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm leading-6 text-foreground/88">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t">
        <div className="page-shell py-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="page-eyebrow">Next step</p>
              <h2>Want a walkthrough based on your current process?</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                We can review how your office handles intake today, where missed follow-up is happening, and what the cleanest first deployment path looks like.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/book">
                Book a 15-min Call
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
