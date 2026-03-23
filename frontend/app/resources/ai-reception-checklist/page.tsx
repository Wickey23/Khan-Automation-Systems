import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "AI Reception Checklist"
};

export default function ChecklistPage() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#ecfdf5_100%)]">
      <div className="container py-14 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-8">
          <section className="rounded-[28px] border border-slate-200/90 bg-white/92 p-6 shadow-[0_26px_50px_-34px_rgba(15,23,42,0.45)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Free resource</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">AI Reception Checklist</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              A practical checklist to evaluate call coverage, intake quality, escalation readiness, and follow-up reliability.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["Call flow quality", "Escalation readiness", "SMS follow-up discipline"].map((item) => (
                <Card key={item} className="border-slate-200/90 bg-slate-50/80">
                  <CardContent className="p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {item}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Card className="max-w-2xl border-slate-200/90 bg-white/95 shadow-[0_24px_46px_-32px_rgba(15,23,42,0.45)]">
            <CardContent className="space-y-4 p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <FileText className="h-4 w-4 text-slate-500" />
                Download asset
              </p>
              <p className="text-sm text-slate-600">
                Includes readiness checks for call flow, escalation, SMS follow-up, and data capture standards.
              </p>
              <Button asChild>
                <a href="/files/ai-reception-checklist.pdf" download>
                  Download PDF
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
