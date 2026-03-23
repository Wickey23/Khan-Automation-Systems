"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { sendSupportMessage } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";

export default function DashboardSupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { showToast } = useToast();

  async function onSend() {
    setSending(true);
    try {
      await sendSupportMessage(subject, message);
      showToast({ title: "Support request sent" });
      setSubject("");
      setMessage("");
    } catch (error) {
      showToast({ title: "Failed to send", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <ClientGuard>
      <PageShell className="space-y-6">
        <PageHeader
          eyebrow="Legacy support"
          title="Support"
          description="Send a direct support message to the operations team."
        />
        <SectionShell className="surface-panel space-y-4">
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
            <p className="inline-flex items-center gap-2 font-medium text-slate-900">
              <LifeBuoy className="h-4 w-4 text-slate-500" />
              Share context, urgency, and expected outcome for faster support routing.
            </p>
          </div>
          <div><Label>Subject</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Example: Booking flow not saving requests" /></div>
          <div><Label>Message</Label><Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Include what happened, where it happened, and what you expected." /></div>
          <Button onClick={onSend} disabled={sending}>{sending ? "Sending..." : "Send"}</Button>
        </SectionShell>
      </PageShell>
    </ClientGuard>
  );
}
