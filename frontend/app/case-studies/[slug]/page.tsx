import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Sparkles, Target } from "lucide-react";
import { caseStudies } from "@/lib/case-studies";
import { Card, CardContent } from "@/components/ui/card";

type Params = { slug: string };

export async function generateStaticParams() {
  return caseStudies.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const caseStudy = caseStudies.find((item) => item.slug === params.slug);
  return {
    title: caseStudy ? caseStudy.title : "Case Study"
  };
}

export default function CaseStudyDetailPage({ params }: { params: Params }) {
  const caseStudy = caseStudies.find((item) => item.slug === params.slug);
  if (!caseStudy) notFound();

  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)]">
      <div className="container py-14 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link href="/case-studies" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back to case studies
          </Link>

          <section className="rounded-[28px] border border-slate-200/90 bg-white/92 p-6 shadow-[0_26px_50px_-34px_rgba(15,23,42,0.45)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{caseStudy.industry}</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">{caseStudy.title}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">{caseStudy.summary}</p>
          </section>

          <div className="grid gap-4">
            <Card className="border-slate-200/90 bg-white/95 shadow-[0_22px_44px_-32px_rgba(15,23,42,0.4)]">
              <CardContent className="p-6">
                <h2 className="inline-flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
                  <Target className="h-5 w-5 text-slate-500" />
                  Challenge
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{caseStudy.challenge}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200/90 bg-white/95 shadow-[0_22px_44px_-32px_rgba(15,23,42,0.4)]">
              <CardContent className="p-6">
                <h2 className="inline-flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
                  <BriefcaseBusiness className="h-5 w-5 text-slate-500" />
                  Implementation
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{caseStudy.implementation}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200/90 bg-white/95 shadow-[0_22px_44px_-32px_rgba(15,23,42,0.4)]">
              <CardContent className="p-6">
                <h2 className="inline-flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
                  <Sparkles className="h-5 w-5 text-slate-500" />
                  Result
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{caseStudy.result}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
