import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CaseStudyCard({
  slug,
  title,
  industry,
  result
}: {
  slug: string;
  title: string;
  industry: string;
  result: string;
}) {
  return (
    <Card className="group h-full rounded-[22px] border-slate-200/90 bg-white/95 shadow-[0_20px_42px_-32px_rgba(15,23,42,0.45)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_54px_-30px_rgba(15,23,42,0.48)]">
      <CardHeader className="space-y-3">
        <Badge variant="outline" className="w-fit">
          {industry}
        </Badge>
        <CardTitle className="text-[22px] tracking-[-0.02em] text-slate-950">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-7 text-slate-600">{result}</p>
        <Link href={`/case-studies/${slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5">
          View case study <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
