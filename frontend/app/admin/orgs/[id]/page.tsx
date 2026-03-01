"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  assignOrgTwilioNumber,
  fetchAdminOrgById,
  goLiveOrg,
  pauseOrg,
  resetOrgUserPassword,
  saveAdminOrgNotes,
  updateAdminOrgStatus,
  updateOrgAiConfig
} from "@/lib/api";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type OrgDetail = {
  id: string;
  name: string;
  status: "NEW" | "ONBOARDING" | "READY_FOR_REVIEW" | "PROVISIONING" | "LIVE" | "PAUSED";
  live: boolean;
  onboardingSubmissions?: Array<{ answersJson: string; status: string; notesFromAdmin?: string | null }>;
  phoneNumbers?: Array<{ e164Number: string; status: string }>;
  aiAgentConfigs?: Array<{ provider: string; agentId?: string | null; status: string; updatedAt: string }>;
  users?: Array<{ id: string; email: string; role: string; createdAt: string }>;
};

export default function AdminOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [status, setStatus] = useState<OrgDetail["status"]>("ONBOARDING");
  const [notes, setNotes] = useState("");
  const [e164Number, setE164Number] = useState("");
  const [twilioPhoneSid, setTwilioPhoneSid] = useState("");
  const [agentId, setAgentId] = useState("");
  const [voice, setVoice] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

  async function load() {
    const data = await fetchAdminOrgById(id);
    const next = data.org as OrgDetail;
    setOrg(next);
    setStatus(next.status);
    const latestAi = next.aiAgentConfigs?.[0];
    setAgentId(latestAi?.agentId || "");
  }

  useEffect(() => {
    void load().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onboardingAnswers = useMemo(() => {
    const raw = org?.onboardingSubmissions?.[0]?.answersJson;
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [org]);

  async function updateStatus() {
    await updateAdminOrgStatus(id, status);
    showToast({ title: "Organization status updated" });
    await load();
  }

  async function saveNotes(statusType: "NEEDS_CHANGES" | "APPROVED") {
    await saveAdminOrgNotes(id, notes, statusType);
    showToast({ title: "Review note saved" });
    await load();
  }

  async function assignNumber() {
    await assignOrgTwilioNumber(id, { e164Number, twilioPhoneSid: twilioPhoneSid || undefined });
    showToast({ title: "Phone number assigned" });
    await load();
  }

  async function saveAiConfig() {
    await updateOrgAiConfig(id, {
      provider: "VAPI",
      agentId,
      voice,
      model,
      systemPrompt,
      status: "ACTIVE"
    });
    showToast({ title: "AI config saved" });
    await load();
  }

  async function resetUserPassword(userId: string) {
    const password = passwordDrafts[userId] || "";
    if (password.length < 8) {
      showToast({ title: "Password too short", description: "Use at least 8 characters.", variant: "error" });
      return;
    }
    await resetOrgUserPassword(id, userId, password);
    showToast({ title: "Password reset", description: "Client user password updated." });
    setPasswordDrafts((current) => ({ ...current, [userId]: "" }));
  }

  return (
    <AdminGuard>
      <div className="container py-10">
        <Link href="/admin/orgs" className="text-sm text-primary">
          Back to organizations
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{org?.name || "Organization"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live: {org?.live ? "Yes" : "No"}</p>

        <div className="mt-6 grid gap-6">
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">Onboarding Answers</h2>
            <pre className="mt-3 max-h-72 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(onboardingAnswers, null, 2)}</pre>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">Review + Status</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Status</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrgDetail["status"])}
                >
                  <option value="NEW">NEW</option>
                  <option value="ONBOARDING">ONBOARDING</option>
                  <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
                  <option value="PROVISIONING">PROVISIONING</option>
                  <option value="LIVE">LIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>
            <Button className="mt-3" onClick={() => void updateStatus()}>
              Save status
            </Button>
            <div className="mt-4">
              <Label>Notes to client</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <Button variant="outline" onClick={() => void saveNotes("NEEDS_CHANGES")}>
                  Mark needs changes
                </Button>
                <Button onClick={() => void saveNotes("APPROVED")}>Mark approved</Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">Provisioning</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>E164 Number</Label>
                <Input placeholder="+15165551234" value={e164Number} onChange={(e) => setE164Number(e.target.value)} />
              </div>
              <div>
                <Label>Twilio SID (optional)</Label>
                <Input value={twilioPhoneSid} onChange={(e) => setTwilioPhoneSid(e.target.value)} />
              </div>
            </div>
            <Button className="mt-3" onClick={() => void assignNumber()}>
              Assign Twilio number
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Assigned: {org?.phoneNumbers?.[0]?.e164Number || "none"}
            </p>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">AI Agent Config</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><Label>Vapi Agent ID</Label><Input value={agentId} onChange={(e) => setAgentId(e.target.value)} /></div>
              <div><Label>Voice</Label><Input value={voice} onChange={(e) => setVoice(e.target.value)} /></div>
              <div><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>System Prompt</Label><Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} /></div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void saveAiConfig()}>Save AI config</Button>
              <Button variant="outline" onClick={() => void goLiveOrg(id)}>Go Live</Button>
              <Button variant="outline" onClick={() => void pauseOrg(id)}>Pause</Button>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">Organization Users</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Passwords cannot be viewed. You can set a new password for any client user.
            </p>
            <div className="mt-4 grid gap-3">
              {(org?.users || []).map((user) => (
                <div key={user.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="password"
                      placeholder="New password (min 8 chars)"
                      value={passwordDrafts[user.id] || ""}
                      onChange={(e) =>
                        setPasswordDrafts((current) => ({ ...current, [user.id]: e.target.value }))
                      }
                    />
                    <Button onClick={() => void resetUserPassword(user.id)}>Set new password</Button>
                  </div>
                </div>
              ))}
              {!org?.users?.length ? <p className="text-sm text-muted-foreground">No users found.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </AdminGuard>
  );
}
