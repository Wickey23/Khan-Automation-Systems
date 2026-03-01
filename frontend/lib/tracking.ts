type EventPayload = Record<string, string | number | boolean | undefined>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export async function trackEvent(name: string, payload: EventPayload = {}) {
  // Keep default behavior local-friendly for now.
  // eslint-disable-next-line no-console
  console.log("[event]", name, payload);

  if (!API_BASE) return;
  if (!process.env.NEXT_PUBLIC_SITE_URL) return;

  try {
    await fetch(`${API_BASE}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, payload })
    });
  } catch {
    // Event sink is optional in v1.
  }
}
