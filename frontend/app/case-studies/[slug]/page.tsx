import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
    <div className="container py-14">
      <h1 className="text-4xl font-bold">{caseStudy.title}</h1>
      <p className="mt-3 text-muted-foreground">{caseStudy.summary}</p>
      <div className="mt-8 grid gap-4">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold">Challenge</h2>
            <p className="mt-2 text-sm text-muted-foreground">{caseStudy.challenge}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold">Implementation</h2>
            <p className="mt-2 text-sm text-muted-foreground">{caseStudy.implementation}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold">Result</h2>
            <p className="mt-2 text-sm text-muted-foreground">{caseStudy.result}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
