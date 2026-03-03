"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchPublicDemoConfig } from "@/lib/api";

type DemoCallCardProps = {
  demoNumber: string;
};

function normalizePhoneForTel(input: string) {
  return input.replace(/[^\d+]/g, "");
}

export function DemoCallCard({ demoNumber }: DemoCallCardProps) {
  const [configuredNumber, setConfiguredNumber] = useState(demoNumber);
  const [title, setTitle] = useState("Voice Demo (Call From Your Phone)");
  const [subtitle, setSubtitle] = useState(
    "Call the demo line and ask questions naturally. The assistant will respond live, just like a real inbound call."
  );
  const [questions, setQuestions] = useState<string[]>([
    "What services do you offer?",
    "Can I book an appointment for this week?",
    "What happens if this is urgent?"
  ]);

  useEffect(() => {
    let active = true;
    void fetchPublicDemoConfig()
      .then((data) => {
        if (!active) return;
        if (data.demoNumber) setConfiguredNumber(data.demoNumber);
        if (data.demoTitle) setTitle(data.demoTitle);
        if (data.demoSubtitle) setSubtitle(data.demoSubtitle);
        if (Array.isArray(data.demoQuestions) && data.demoQuestions.length > 0) {
          setQuestions(data.demoQuestions.slice(0, 6));
        }
      })
      .catch(() => {
        // Keep fallback values from props/env on any API issue.
      });
    return () => {
      active = false;
    };
  }, []);

  const tel = useMemo(() => normalizePhoneForTel(configuredNumber), [configuredNumber]);
  const isConfigured = Boolean(tel && !configuredNumber.includes("DEMO_NUMBER_HERE"));
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`tel:${tel}`)}`;

  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

      <div className="mt-5 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <p className="text-sm font-medium">Demo number</p>
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-lg font-semibold tracking-wide">{configuredNumber}</p>

          <div className="flex flex-wrap gap-2">
            <Button asChild disabled={!isConfigured}>
              <a href={isConfigured ? `tel:${tel}` : "#"}>{isConfigured ? "Call Demo Now" : "Demo Number Not Set"}</a>
            </Button>
            <Button
              variant="outline"
              disabled={!isConfigured}
              onClick={() => {
                if (!isConfigured) return;
                void navigator.clipboard.writeText(configuredNumber);
              }}
            >
              Copy Number
            </Button>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
            {!isConfigured ? <li>Demo line is temporarily unavailable. Use the contact form and we will provide live access.</li> : null}
          </ul>
        </div>

        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-medium">Desktop? Scan to call</p>
          <p className="mt-1 text-xs text-muted-foreground">Open your phone camera and tap the call prompt.</p>
          <div className="mt-3 flex justify-center rounded-md border bg-white p-3">
            {isConfigured ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="QR code to call demo line" className="h-40 w-40" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center text-center text-xs text-muted-foreground">
                Demo number not configured
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
