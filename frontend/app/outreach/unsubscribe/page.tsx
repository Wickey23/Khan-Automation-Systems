"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { unsubscribeOutreachToken } from "@/lib/api";
import { Button } from "@/components/ui/button";

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
    <div className="container py-16">
      <div className="mx-auto max-w-xl rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Outreach unsubscribe</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        {state === "error" ? (
          <Button className="mt-4" variant="outline" onClick={() => window.location.assign("/")}>
            Go to homepage
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function OutreachUnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="container py-16">
          <div className="mx-auto max-w-xl rounded-2xl border bg-white p-8 shadow-sm">
            <h1 className="text-3xl font-semibold">Outreach unsubscribe</h1>
            <p className="mt-3 text-sm text-muted-foreground">Processing your unsubscribe request...</p>
          </div>
        </div>
      }
    >
      <OutreachUnsubscribeContent />
    </Suspense>
  );
}
