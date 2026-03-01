"use client";

import { useState } from "react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { sendSupportMessage } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      showToast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <ClientGuard>
      <div className="container max-w-3xl py-10">
        <h1 className="text-3xl font-bold">Support</h1>
        <div className="mt-6 space-y-4">
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
          <Button onClick={onSend} disabled={sending}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </ClientGuard>
  );
}
