export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";

export type Lead = {
  id: string;
  name: string;
  business: string;
  email: string;
  phone: string;
  industry: string | null;
  message: string | null;
  preferredContact: string | null;
  urgency: string | null;
  sourcePage: string | null;
  status: LeadStatus;
  tags: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  ip: string | null;
  userAgent: string | null;
};

export type LeadPayload = {
  name: string;
  business: string;
  email: string;
  phone: string;
  industry?: string;
  message?: string;
  preferredContact?: "call" | "text" | "email";
  urgency?: "this_week" | "this_month" | "exploring";
  sourcePage: string;
};

export type ClientStatus = "NEEDS_CONFIGURATION" | "LIVE" | "PAUSED" | "CANCELED";

export type Client = {
  id: string;
  name: string;
  industry: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
  setting?: Setting | null;
  aiConfig?: AIConfig | null;
  phoneLine?: PhoneLine | null;
  subscriptions?: Subscription[];
};

export type Subscription = {
  id: string;
  plan: "STARTER" | "PRO";
  status: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

export type Setting = {
  id: string;
  clientId: string;
  businessHoursJson: string;
  transferNumber: string;
  servicesJson: string | null;
  bookingLink: string | null;
  paused: boolean;
  updatedAt: string;
};

export type PhoneLine = {
  id: string;
  clientId: string;
  provider: string;
  phoneNumber: string | null;
  twilioIncomingPhoneSid: string | null;
  voiceWebhookUrl: string | null;
  smsWebhookUrl: string | null;
  capabilitiesJson: string | null;
  updatedAt: string;
};

export type AIConfig = {
  id: string;
  clientId: string;
  greetingText: string | null;
  systemPrompt: string | null;
  intakeQuestionsJson: string | null;
  transferRulesJson: string | null;
  afterHoursMessage: string | null;
  smsEnabled: boolean;
  testMode: boolean;
  updatedAt: string;
};

export type AuthUser = {
  userId: string;
  email: string;
  role: "ADMIN" | "CLIENT";
  clientId?: string | null;
};

export type CallRecord = {
  id: string;
  clientId: string;
  fromNumber: string;
  toNumber: string;
  startedAt: string;
  endedAt: string | null;
  outcome: "AI_HANDLED" | "TRANSFERRED" | "MISSED" | "UNKNOWN";
  recordingUrl: string | null;
  transcript: string | null;
  summary: string | null;
};
