import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { CaseStudyCard } from "@/components/site/case-study-card";
import { Card, CardContent } from "@/components/ui/card";
import { caseStudies } from "@/lib/case-studies";

export const metadata: Metadata = {
  title: "Case Studies"
};

export default function CaseStudiesPage() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <div className="container py-14 sm:py-16">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="rounded-[28px] border border-slate-200/90 bg-white/92 p-6 shadow-[0_26px_50px_-34px_rgba(15,23,42,0.45)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operational outcomes</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">Case studies</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Practical examples of how service teams improved lead flow, response speed, and booking conversion with Front Desk OS.
            </p>
            <Card className="mt-5 border-slate-200/90 bg-slate-50/80">
              <CardContent className="p-4">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <TrendingUp className="h-4 w-4 text-slate-500" />
                  Snapshot: real-world intake and dispatch workflow improvements.
                </p>
              </CardContent>
            </Card>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            {caseStudies.map((item) => (
              <CaseStudyCard
                key={item.slug}
                slug={item.slug}
                title={item.title}
                industry={item.industry}
                result={item.summary}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
