"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, MailX } from "lucide-react";
import { unsubscribeOutreachToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function OutreachUnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing your unsubscribe request...");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Unsubscribe token is missing.");
      return;
    }
    void unsubscribeOutreachToken(token)
      .then(() => {
        setState("success");
        setMessage("You have been unsubscribed from outreach emails.");
      })
      .catch((error) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Unable to unsubscribe.");
      });
  }, [token]);

  return (
    <div className="relative min-h-[70vh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-14 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Return to homepage
        </Link>
        <Card className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/95 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.45)]">
          <CardHeader className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(241,245,249,0.7)_100%)]">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white">
              {state === "success" ? <CheckCircle2 className="h-5 w-5" /> : state === "error" ? <AlertCircle className="h-5 w-5" /> : <MailX className="h-5 w-5" />}
            </div>
            <CardTitle className="text-2xl tracking-[-0.02em] text-slate-950">Outreach Preferences</CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              {state === "success" ? "Your email preferences have been updated." : state === "error" ? "We could not complete this request." : "Processing your unsubscribe request..."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">{message}</div>
            <div className="flex flex-wrap gap-2">
              {state === "error" ? (
                <Button variant="outline" onClick={() => window.location.assign("/")}>
                  Go to homepage
                </Button>
              ) : null}
              {state === "success" ? (
                <Button asChild variant="outline">
                  <Link href="/">Back to site</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OutreachUnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-[70vh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-14 sm:px-6">
          <div className="mx-auto w-full max-w-2xl">
            <Card className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/95 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.45)]">
              <CardHeader className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(241,245,249,0.7)_100%)]">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white">
                  <MailX className="h-5 w-5" />
                </div>
                <CardTitle className="text-2xl tracking-[-0.02em] text-slate-950">Outreach Preferences</CardTitle>
                <p className="mt-2 text-sm text-slate-600">Processing your unsubscribe request...</p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                  Processing your unsubscribe request...
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <OutreachUnsubscribeContent />
    </Suspense>
  );
}
