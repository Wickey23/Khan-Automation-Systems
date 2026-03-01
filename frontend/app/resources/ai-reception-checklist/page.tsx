import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "AI Reception Checklist"
};

export default function ChecklistPage() {
  return (
    <div className="container py-14">
      <h1 className="text-4xl font-bold">AI Reception Checklist</h1>
      <p className="mt-3 text-muted-foreground">
        A practical checklist to evaluate call coverage, intake quality, and follow-up workflows.
      </p>
      <Card className="mt-8 max-w-2xl">
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Includes readiness checks for call flow, escalation, SMS follow-up, and data capture standards.
          </p>
          <Button asChild>
            <a href="/files/ai-reception-checklist.pdf" download>
              Download PDF
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
