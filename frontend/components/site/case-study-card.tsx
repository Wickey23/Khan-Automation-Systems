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
    <Card>
      <CardHeader>
        <Badge variant="outline" className="w-fit">
          {industry}
        </Badge>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{result}</p>
        <Link href={`/case-studies/${slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          View case study <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
