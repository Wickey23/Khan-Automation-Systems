import type { Metadata } from "next";
import { CaseStudyCard } from "@/components/site/case-study-card";
import { caseStudies } from "@/lib/case-studies";

export const metadata: Metadata = {
  title: "Case Studies"
};

export default function CaseStudiesPage() {
  return (
    <div className="container py-14">
      <h1 className="text-4xl font-bold">Case Studies</h1>
      <p className="mt-3 text-muted-foreground">Examples of practical lead-flow improvements for service businesses.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
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
  );
}
