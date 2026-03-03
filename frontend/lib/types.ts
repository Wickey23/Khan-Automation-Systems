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
  source?: "WEB_FORM" | "PHONE_CALL" | "SMS";
  dnc?: boolean;
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
  orgId?: string;
  source?: "WEB_FORM" | "PHONE_CALL" | "SMS";
  createAccount?: boolean;
};

export type ClientStatus = "NEEDS_CONFIGURATION" | "LIVE" | "PAUSED" | "CANCELED";
export type OrgStatus =
  | "NEW"
  | "ONBOARDING"
  | "SUBMITTED"
  | "NEEDS_CHANGES"
  | "APPROVED"
  | "PROVISIONING"
  | "TESTING"
  | "LIVE"
  | "PAUSED";

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
  role: "SUPER_ADMIN" | "CLIENT_ADMIN" | "CLIENT_STAFF" | "ADMIN" | "CLIENT";
  clientId?: string | null;
  orgId?: string | null;
};

export type Organization = {
  id: string;
  name: string;
  industry: string | null;
  status: OrgStatus;
  live: boolean;
  onboardingApprovedAt?: string | null;
  goLiveAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingSubmission = {
  id: string;
  orgId: string;
  status: "DRAFT" | "SUBMITTED" | "REVIEWED" | "NEEDS_CHANGES" | "APPROVED";
  answersJson: string;
  configPackageJson?: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  notesFromAdmin: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrgSubscription = {
  id: string;
  status: string;
  plan: "STARTER" | "PRO";
  currentPeriodEnd: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

export type OrgDemoStatus = {
  mode: "GUIDED_DEMO" | null;
  state: "ACTIVE" | "OVER_CAP" | "EXPIRED" | "NOT_ELIGIBLE";
  eligible: boolean;
  windowEndsAt: string | null;
  callCap: number;
  callsUsed: number;
  callsRemaining: number;
  overLimit: boolean;
};

export type BillingStatusPayload = {
  subscription: OrgSubscription | null;
  demo: OrgDemoStatus;
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

export type OrgCallRecord = {
  id: string;
  orgId: string;
  providerCallId: string | null;
  fromNumber: string;
  toNumber: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  recordingUrl: string | null;
  transcript: string | null;
  outcome: "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "SPAM";
  summary: string;
  aiProvider?: "VAPI" | "OPENAI" | "OTHER" | null;
  aiSummary?: string | null;
  appointmentRequested?: boolean;
  leadId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCallRecord = OrgCallRecord & {
  organization?: {
    id: string;
    name: string;
  } | null;
};

export type OrgMessage = {
  id: string;
  threadId: string;
  orgId: string;
  leadId: string | null;
  direction: "INBOUND" | "OUTBOUND";
  status: "RECEIVED" | "QUEUED" | "SENT" | "FAILED" | "DELIVERED";
  body: string;
  provider: string;
  providerMessageId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  errorText: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
};

export type OrgMessageThread = {
  id: string;
  orgId: string;
  leadId: string | null;
  channel: string;
  contactName: string | null;
  contactPhone: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    name: string;
    business: string;
    phone: string;
  } | null;
  messages: OrgMessage[];
};

export type CustomerBaseRecord = {
  phoneNumber: string;
  displayName: string;
  nameConfidence: "HIGH" | "MEDIUM" | "LOW";
  totalCalls: number;
  firstCallAt: string;
  lastCallAt: string;
  lastOutcome: string | null;
  flaggedVIP: boolean;
  lead: {
    id: string;
    name: string;
    business: string;
    email: string;
    urgency: string | null;
    notes: string | null;
  } | null;
  recentCalls: Array<{
    startedAt: string;
    outcome: string;
    aiSummary: string | null;
    appointmentRequested: boolean | null;
  }>;
  lastSmsAt: string | null;
};

export type AdminMessageThread = OrgMessageThread & {
  organization?: {
    id: string;
    name: string;
  } | null;
};

export type BusinessSettings = {
  id: string;
  orgId: string;
  hoursJson: string;
  afterHoursMode: "TAKE_MESSAGE" | "TRANSFER" | "VOICEMAIL";
  transferNumbersJson: string;
  notificationEmailsJson: string;
  notificationPhonesJson: string;
  languagesJson: string;
  recordingConsentEnabled: boolean;
  smsConsentText: string;
  timezone: string;
  servicesJson: string;
  policiesJson: string;
  updatedAt: string;
};

export type OrgKnowledgeFile = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type ProspectStatus = "NEW" | "QUALIFIED" | "CONTACTED" | "NURTURE" | "WON" | "LOST";

export type Prospect = {
  id: string;
  orgId: string | null;
  name: string;
  business: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  status: ProspectStatus;
  source: "MANUAL" | "CSV_IMPORT" | "ENRICHED";
  score: number | null;
  scoreReason: string | null;
  tags: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReadinessCheck = {
  ok: boolean;
  reason: string;
  fixHint: string;
};

export type ReadinessReport = {
  checks: {
    billingActive: ReadinessCheck;
    onboardingSubmitted: ReadinessCheck;
    onboardingApproved: ReadinessCheck;
    businessSettingsValid: ReadinessCheck;
    providerLineAssigned: ReadinessCheck;
    toolSecretConfigured: ReadinessCheck;
    webhooksVerified: ReadinessCheck;
    notificationsVerified: ReadinessCheck;
    testCallsPassed: ReadinessCheck;
  };
  canGoLive: boolean;
};

export type ConfigPackage = {
  id: string;
  orgId: string;
  version: number;
  json: Record<string, unknown>;
  generatedAt: string;
  generatedByUserId: string | null;
};

export type TestRun = {
  id: string;
  orgId: string;
  scenarioId: string;
  providerCallId: string | null;
  status: "PASS" | "FAIL";
  notes: string | null;
  createdAt: string;
};

export type TestScenario = {
  id: string;
  orgId: string;
  name: string;
  script: string;
  expectedOutcome: string;
  tagsJson: string;
  testRuns: TestRun[];
};

export type AuditEvent = {
  id: string;
  orgId: string | null;
  actorUserId: string;
  actorRole: string;
  action: string;
  metadataJson: string;
  createdAt: string;
};

export type DemoConfig = {
  demoNumber: string;
  demoVapiAssistantId: string;
  demoVapiPhoneNumberId: string;
  demoTitle: string;
  demoSubtitle: string;
  demoQuestions: string[];
};

export type DemoCallLog = {
  id: string;
  providerCallId: string;
  assistantId: string | null;
  phoneNumberId: string | null;
  fromNumber: string;
  toNumber: string;
  status: string | null;
  outcome: "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "SPAM" | null;
  aiSummary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  successEvaluation: number | null;
  durationSec: number | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrgAnalytics = {
  range: "7d" | "30d" | "custom";
  start: string;
  end: string;
  kpis: {
    totalCalls: number;
    answeredCalls: number;
    answerRate: number;
    leadsCreated: number;
    leadCaptureRate: number;
    avgCallDurationSec: number;
    smsThreads: number;
    smsEngagedThreads: number;
    smsEngagementRate: number;
    appointmentRequests: number;
    missedCalls: number;
    callQualityAverage: number;
    autoRecoverySent: number;
    autoRecoveryLeadConversions: number;
    unknownNameRate: number;
    dataFreshnessAt: string | null;
  };
  charts: {
    callsPerDay: Array<{ day: string; value: number }>;
    leadsPerDay: Array<{ day: string; value: number }>;
    outcomeBreakdown: Array<{ outcome: string; value: number }>;
  };
};

export type OrgDataQuality = {
  window: "30d";
  unknownNameRate: number;
  unknownNameCount: number;
  leadCount: number;
  missingLeadLinkageCount: number;
  completedCallCount: number;
  duplicateLeadCandidates: Array<{ phone: string; count: number }>;
};

export type OrgMessagingReadiness = {
  state: "A2P_REGISTERED" | "A2P_PENDING" | "A2P_BLOCKED";
  provider: "TWILIO" | "VAPI" | null;
  assignedNumber: string | null;
  plan: "STARTER" | "PRO" | null;
  subscriptionStatus: string | null;
  billingActive: boolean;
  canSendOperationalSms: boolean;
  reasons: string[];
};

export type AdminSystemDashboard = {
  inboundCalls: { last5m: number; last1h: number; last24h: number };
  webhookSuccessRate: number;
  twilioErrorRate: number;
  vapiProcessingErrorRate: number;
  slaSeverityByOrg: Array<{ orgId: string; orgName: string; severity: "INFO" | "WARN" | "CRITICAL" }>;
  callsByRoutingTier: Array<{ tier: number; count: number }>;
  autoRecoveryVolumeLast24h: number;
  callsMissingLeadLinkage: number;
  callsStuckNonTerminalOver1h: number;
  orgExposurePercent: number;
  trafficExposurePercent: number;
  p1AckTimeP95Ms: number | null;
  p1ResolutionTimeP95Ms: number | null;
  lowIncidentVolumeWarning: boolean;
};

export type AdminSystemReadiness = {
  webhookSuccessRate: number;
  avgCallQuality: number;
  autoRecoveryRate: number;
  leadLinkageRate: number;
  P1IncidentCountLast30d: number;
  SLAStatusDistribution: {
    INFO: number;
    WARN: number;
    CRITICAL: number;
  };
  DataIntegrityAnomalies: number;
};

export type AdminScaleGate = {
  evaluationTimestamp: string;
  result: "PASS" | "FAIL";
  failingCriteria: string[];
  warnings: {
    lowIncidentVolumeWarning: boolean;
    lowIncidentVolumeContext: {
      p1IncidentCount14d: number;
      minRecommendedSampleSize: number;
    };
  };
  exposure: {
    orgExposurePercent: number;
    trafficExposurePercent: number;
    thresholds: {
      orgExposureThreshold: number;
      trafficExposureThreshold: number;
    };
  };
  cooldown: {
    systemicFailTriggered: boolean;
    required: boolean;
    status: "PASS" | "FAIL";
  };
  metrics: {
    webhookSuccessRate: number;
    leadLinkageRate: number;
    p1AckTimeP95Ms: number | null;
    p1ResolutionTimeP95Ms: number | null;
  };
};

export type OrgHealth = {
  level: "GREEN" | "YELLOW" | "RED";
  score: number;
  summary: string;
  checks: Record<string, { ok: boolean; reason: string; fixHint: string }>;
  metrics: {
    avgSuccessScore: number;
    recentActivityAt: string | null;
  };
};

export type AiAgentConfigVersion = {
  id: string;
  orgId: string;
  aiAgentConfigId: string;
  version: number;
  configJson: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
};

export type ConfigPackageVersion = {
  id: string;
  orgId: string;
  configPackageId: string;
  version: number;
  packageJson: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
};

export type PublicSystemStatus = {
  status: "OPERATIONAL" | "DEGRADED";
  timestamp: string;
  components: {
    voice: "OPERATIONAL" | "DEGRADED";
    sms: "OPERATIONAL" | "DEGRADED";
    billing: "OPERATIONAL" | "DEGRADED";
    webhooks: "OPERATIONAL" | "DEGRADED";
  };
};
