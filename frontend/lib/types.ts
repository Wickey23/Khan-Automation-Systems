export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
export type LeadPipelineStage = "NEW_LEAD" | "QUOTED" | "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED";
export type LeadClassification =
  | "BOOKED_JOB"
  | "QUOTE_REQUEST"
  | "EMERGENCY"
  | "CUSTOMER_SUPPORT"
  | "SPAM"
  | "MISSED_CALL_RECOVERY"
  | "GENERAL_INQUIRY";

export type FrontDeskPriority = "urgent" | "high" | "normal" | "low";
export type FrontDeskFollowUpState = "needs_follow_up" | "contacted" | "booked" | "closed" | "spam";

export type OrgCallFrontDesk = {
  callerName: string | null;
  callerPhone: string;
  serviceRequested: string | null;
  urgency: string | null;
  serviceLocation: string | null;
  appointmentRequested: boolean;
  summary: string;
  needsFollowUp: boolean;
  followUpState: FrontDeskFollowUpState;
  frontDeskPriority: FrontDeskPriority;
  recommendedAction: string;
};

export type LeadFrontDesk = {
  state: FrontDeskFollowUpState;
  needsFollowUp: boolean;
  frontDeskPriority: FrontDeskPriority;
  recommendedAction: string;
  lastActivityAt: string | null;
  lastActivityType: "call" | "message" | "appointment_request" | "appointment" | "lead" | null;
  summary: string;
};

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
  sourceSection?: string | null;
  ctaVariant?: string | null;
  status: LeadStatus;
  pipelineStage?: LeadPipelineStage;
  tags: string;
  notes: string | null;
  serviceRequested?: string | null;
  serviceAddress?: string | null;
  appointmentRequested?: boolean;
  qualified?: boolean;
  qualificationReason?: string | null;
  classification?: LeadClassification | null;
  classificationConfidence?: number | null;
  source?: "WEB_FORM" | "PHONE_CALL" | "SMS";
  dnc?: boolean;
  latestCallId?: string | null;
  latestMessageThreadId?: string | null;
  latestAppointmentRequestId?: string | null;
  frontDesk?: LeadFrontDesk;
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
  sourceSection?: string;
  ctaVariant?: string;
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

export type TeamRole = "ADMIN" | "MANAGER" | "VIEWER";
export type TeamStatus = "ACTIVE" | "INVITED";

export type TeamMember = {
  id: string;
  role: TeamRole;
  status: TeamStatus;
  invitedEmail: string;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type TeamSeatSnapshot = {
  seatPolicy?: string;
  includedSeats: number;
  purchasedSeats: number;
  allowedSeats: number;
  activeMembers: number;
  pendingInvites?: number;
  upgradeHint?: string;
};

export type TeamMembersResponse = {
  canManage: boolean;
  seats: TeamSeatSnapshot;
  members: TeamMember[];
  seatPolicy?: string;
  activeMembers?: number;
  pendingInvites?: number;
  allowedSeats?: number;
  upgradeHint?: string;
};

export type Organization = {
  id: string;
  name: string;
  industry: string | null;
  status: OrgStatus;
  live: boolean;
  onboardingApprovedAt?: string | null;
  goLiveAt?: string | null;
  firstSuccessAt?: string | null;
  firstSuccessType?: "call" | "sms" | "booking" | null;
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
  pendingPlan?: "STARTER" | "PRO" | null;
  pendingPlanEffectiveAt?: string | null;
  pendingPlanSource?: "STRIPE_HOSTED" | "APP_FALLBACK" | null;
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

export type BillingDiagnosticStatus = "PASS" | "WARN" | "FAIL";

export type BillingDiagnosticCheck = {
  key: string;
  status: BillingDiagnosticStatus;
  message: string;
  fixHint?: string;
  reasonCode?: string;
  maskedRef?: string;
};

export type BillingDiagnosticsSummary = {
  overall: "HEALTHY" | "NEEDS_ACTION" | "BLOCKED";
  checkoutReady: boolean;
  changePlanReady: boolean;
  customerPortalReady: boolean;
  topIssues: string[];
};

export type BillingDiagnosticsPayload = {
  summary: BillingDiagnosticsSummary;
  evaluatedAt: string;
  detailed: boolean;
  checks?: {
    config: BillingDiagnosticCheck[];
    stripe: BillingDiagnosticCheck[];
    orgLinkage: BillingDiagnosticCheck[];
  };
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
  parentCallSid?: string | null;
  accountSid?: string | null;
  displayName?: string | null;
  fromNumber: string;
  toNumber: string;
  forwardedToNumber?: string | null;
  direction?: string;
  initialWebhookAt?: string | null;
  startedAt: string;
  answeredAt?: string | null;
  endedAt: string | null;
  durationSec: number | null;
  recordingUrl: string | null;
  transcript: string | null;
  outcome: "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "ABANDONED" | "SPAM";
  summary: string;
  aiProvider?: "VAPI" | "OPENAI" | "OTHER" | null;
  aiSummary?: string | null;
  appointmentRequested?: boolean;
  leadId?: string | null;
  appointmentRequestId?: string | null;
  transferReason?: string | null;
  transferTarget?: string | null;
  durationBeforeTransferSec?: number | null;
  unansweredTransfer?: boolean | null;
  recoverySmsSentAt?: string | null;
  recoverySmsResponse?: string | null;
  recoverySmsThreadId?: string | null;
  callStatus?: string | null;
  dialCallStatus?: string | null;
  answeredBy?: string | null;
  answeredByLabel?: "HUMAN" | "AI" | "UNKNOWN";
  frontDesk?: OrgCallFrontDesk;
  missedReason?: string | null;
  source?: string | null;
  hasMediaStream?: boolean;
  latestStreamStatus?: string | null;
  latestMediaStream?: {
    id: string;
    streamSid: string | null;
    trackStrategy: string;
    streamStatus: string;
    websocketConnectedAt: string | null;
    mediaStartedAt: string | null;
    mediaEndedAt: string | null;
    mediaEventCount: number;
    inboundChunkCount: number;
    outboundChunkCount: number;
    stopReason: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCallRecord = OrgCallRecord & {
  organization?: {
    id: string;
    name: string;
  } | null;
  lead?: {
    id: string;
    name: string;
    phone: string;
    serviceRequested?: string | null;
    urgency?: string | null;
    appointmentRequested?: boolean;
    notes?: string | null;
    updatedAt?: string;
  } | null;
  serviceRequest?: ServiceRequest | null;
};

export type AdminCallTranscriptSegment = {
  id: string;
  streamSid?: string | null;
  speaker: "CALLER" | "AGENT" | "UNKNOWN";
  text: string;
  confidence?: number | null;
  startTimeMs: number;
  endTimeMs: number;
  sequence: number;
  isFinal: boolean;
  createdAt: string;
};

export type AdminCallTranscriptSession = {
  id: string;
  provider: string;
  sessionStatus: "STARTED" | "ACTIVE" | "ENDED" | "ERROR";
  startedAt: string;
  endedAt?: string | null;
  errorText?: string | null;
  segments: AdminCallTranscriptSegment[];
};

export type CallState = "RINGING" | "CONNECTED" | "AI_ACTIVE" | "TRANSFERRED" | "COMPLETED";

export type AdminCallStateTransition = {
  id: string;
  fromState: CallState | null;
  toState: CallState;
  at: string;
  metadata: Record<string, unknown> | null;
};

export type WebhookJobStatusRecord = {
  jobId: string;
  type: string;
  status: string;
  message: string | null;
  durationMs: number | null;
  eventId: string | null;
  eventType: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type BookingFinalizerJobRecord = {
  id: string;
  callId: string;
  status: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  processedAt: string | null;
  smsSentAt: string | null;
  error: string | null;
  resultJson: Record<string, unknown> | null;
  decisionVersion: string | null;
  decisionInputHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CallAuditTrailEntry = {
  id: string;
  type: "transition" | "audit";
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CallReviewStatus = "idle" | "review_required" | "resolved";

export type CallReviewState = {
  status: CallReviewStatus;
  note: string | null;
  updatedAt: string | null;
  actorUserId: string | null;
  actorRole: string | null;
};

export type AdminCallDetail = AdminCallRecord & {
  transcriptStatus?: "STARTED" | "GENERATED" | "ERROR" | null;
  transcriptGeneratedAt?: string | null;
  aiSummaryGeneratedAt?: string | null;
  transcriptSessions?: AdminCallTranscriptSession[];
  stateTransitions?: AdminCallStateTransition[];
  webhookJobs?: WebhookJobStatusRecord[];
  finalizeBookingJob?: BookingFinalizerJobRecord | null;
  callAuditTrail?: CallAuditTrailEntry[];
  reviewState?: CallReviewState;
};

export type AdminQueueJobRecord = {
  id: string;
  jobId: string;
  type: string;
  status: string;
  statusLabel: string;
  message: string | null;
  durationMs: number | null;
  createdAt: string;
  callId: string | null;
  providerCallId: string | null;
  orgId: string | null;
  queue: string | null;
  attempts: number | null;
  eventId: string | null;
  eventType: string | null;
  nextAttemptAt: string | null;
  metadata: Record<string, unknown>;
  retryEligible: boolean;
  retryReason: string;
  retryMode: "failed" | "stuck" | null;
};

export type AdminQueueHealthSummary = {
  status: string;
  label: string;
  count: number;
};

export type AdminQueueTypeSummary = {
  type: string;
  count: number;
};

export type AdminQueueHealthResponse = {
  summary: AdminQueueHealthSummary[];
  typeSummary: AdminQueueTypeSummary[];
  recentJobs: AdminQueueJobRecord[];
  stuckJobs: AdminQueueJobRecord[];
  retryingJobs: AdminQueueJobRecord[];
};

export type RetriggerCallFollowUpResponse = {
  callId: string;
  reason: string;
  mode: "missing" | "queued" | "failed" | "done" | "processing" | "unknown";
};

export type RetryAdminQueueJobResponse = {
  requeuedJobId: string;
  retryMode: "failed" | "stuck" | null;
  message: string;
};

export type AdminSmsAuditEntry = {
  id: string;
  eventType: string;
  status: string | null;
  messageSid: string | null;
  threadId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  bodySnippet: string | null;
  errorText: string | null;
  automation: string | null;
  keyword: string | null;
  createdAt: string;
  orgId: string | null;
};

export type AdminSmsAuditSummary = {
  eventType: string;
  status: string;
  count: number;
};

export type AdminSmsAuditResponse = {
  summary: AdminSmsAuditSummary[];
  recentEvents: AdminSmsAuditEntry[];
};

export type UpdateCallReviewResponse = {
  reviewState: CallReviewState;
};

export type ServiceRequestStatus =
  | "NEW"
  | "NEEDS_REVIEW"
  | "NEEDS_SCHEDULING"
  | "FOLLOW_UP_SENT"
  | "RESOLVED"
  | "DISMISSED";

export type ServiceRequest = {
  id: string;
  orgId: string;
  callLogId: string;
  leadId?: string | null;
  customerName?: string | null;
  phone: string;
  serviceType?: string | null;
  urgency?: string | null;
  serviceAddress?: string | null;
  appointmentRequested: boolean;
  status: ServiceRequestStatus;
  notes?: string | null;
  assignedTo?: string | null;
  followUpSentAt?: string | null;
  requestedAt: string;
  automationMetadataJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
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
  latestCallId?: string | null;
  latestAppointmentRequestId?: string | null;
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
    frontDesk?: LeadFrontDesk;
  } | null;
  frontDesk?: LeadFrontDesk | null;
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

export type AdminUserRecord = {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "CLIENT_ADMIN" | "CLIENT_STAFF" | "CLIENT";
  clientId: string | null;
  orgId: string | null;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    status: string;
    live: boolean;
  } | null;
  client: {
    id: string;
    name: string;
    status: string;
  } | null;
  login: {
    lastLoginAt: string | null;
    lastLoginVia: string | null;
    lastOtpVerifiedAt: string | null;
    lastOtpRequestedAt: string | null;
    lastLoginFailAt: string | null;
    lastLoginFailReason: string | null;
    successCount: number;
    failCount: number;
  };
};

export type AdminRevenueSummary = {
  estimatedMrrUsd: number;
  activeSubscriptions: number;
  subscriptionsByPlan: {
    founding: number;
    starter: number;
    pro: number;
  };
  stripePaidLast30d: number | null;
  stripePaidCurrency: string | null;
  stripeError: string | null;
};

export type OutreachLeadStatus = "NEW" | "ACTIVE" | "PAUSED" | "REPLIED" | "BOUNCED" | "UNSUBSCRIBED" | "COMPLETED";
export type OutreachEnrollmentStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "STOPPED" | "FAILED";
export type OutreachEmailEventType =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "BOUNCED"
  | "COMPLAINED"
  | "FAILED"
  | "REPLIED"
  | "UNSUBSCRIBED";

export type OutreachLead = {
  id: string;
  orgId: string;
  companyName: string | null;
  contactName: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  website: string | null;
  angle: string | null;
  painPoint: string | null;
  offer: string | null;
  sourceList: string | null;
  notes: string | null;
  status: OutreachLeadStatus;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string } | null;
  enrollments?: Array<{
    id: string;
    status: OutreachEnrollmentStatus;
    currentStepNumber: number;
    nextSendAt: string | null;
    sequence?: { id: string; name: string } | null;
  }>;
  phoneEnrollments?: Array<{
    id: string;
    status: OutreachEnrollmentStatus;
    nextCallAt: string | null;
    stopReason?: string | null;
    callerConfig?: { id: string; name: string } | null;
  }>;
  emailEvents?: Array<{
    id: string;
    eventType: OutreachEmailEventType;
    subject: string | null;
    toEmail: string;
    createdAt: string;
    errorMessage: string | null;
  }>;
  phoneEvents?: Array<{
    id: string;
    eventType: "QUEUED" | "STARTED" | "COMPLETED" | "FAILED";
    status: string | null;
    toPhone: string;
    createdAt: string;
    errorMessage: string | null;
    summary?: string | null;
    providerCallId?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
};

export type OutreachPhoneCallResult = {
  leadId: string;
  callId: string | null;
  status: string;
  toNumber: string;
  phoneNumberId: string;
};

export type OutreachCallerConfig = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  vapiAssistantId: string | null;
  vapiPhoneNumberId: string | null;
  twilioFromNumber: string | null;
  timezone: string;
  windowStartHour: number;
  windowEndHour: number;
  maxCallsPerDay: number;
  prompt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutreachSequenceStep = {
  id?: string;
  sequenceId?: string;
  stepNumber: number;
  delayHours: number;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OutreachSequence = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string } | null;
  steps: OutreachSequenceStep[];
  _count?: { enrollments: number };
};

export type OutreachEnrollment = {
  id: string;
  orgId: string;
  leadId: string;
  sequenceId: string;
  currentStepNumber: number;
  nextSendAt: string | null;
  status: OutreachEnrollmentStatus;
  stopReason: string | null;
  lastSentAt: string | null;
  processingStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string } | null;
  lead?: OutreachLead | null;
  sequence?: { id: string; name: string } | null;
};

export type OutreachPhoneEnrollment = {
  id: string;
  orgId: string;
  leadId: string;
  callerConfigId: string;
  nextCallAt: string | null;
  status: OutreachEnrollmentStatus;
  stopReason: string | null;
  lastCalledAt: string | null;
  processingStartedAt: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string } | null;
  lead?: OutreachLead | null;
  callerConfig?: { id: string; name: string } | null;
};

export type OutreachEmailEvent = {
  id: string;
  orgId: string;
  leadId: string | null;
  enrollmentId: string | null;
  sequenceId: string | null;
  stepNumber: number | null;
  provider: string;
  providerMessageId: string | null;
  eventType: OutreachEmailEventType;
  subject: string | null;
  toEmail: string;
  fromEmail: string;
  errorMessage: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  organization?: { id: string; name: string } | null;
  lead?: { id: string; email: string; companyName: string | null; contactName: string | null } | null;
  sequence?: { id: string; name: string } | null;
};

export type OutreachPhoneEvent = {
  id: string;
  orgId: string;
  leadId: string | null;
  enrollmentId: string | null;
  callerConfigId: string | null;
  provider: string;
  providerCallId: string | null;
  eventType: "QUEUED" | "STARTED" | "COMPLETED" | "FAILED";
  toPhone: string;
  fromPhone: string | null;
  status: string | null;
  summary: string | null;
  errorMessage: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  organization?: { id: string; name: string } | null;
  lead?: { id: string; email: string; companyName: string | null; contactName: string | null } | null;
  callerConfig?: { id: string; name: string } | null;
};

export type OutreachPhoneEventDetail = OutreachPhoneEvent & {
  organization?: { id: string; name: string } | null;
  lead?: {
    id: string;
    companyName: string | null;
    contactName: string | null;
    email: string;
    phone: string | null;
    city: string | null;
    state: string | null;
    industry: string | null;
    angle: string | null;
    painPoint: string | null;
    offer: string | null;
    sourceList: string | null;
    notes: string | null;
  } | null;
  callerConfig?: {
    id: string;
    name: string;
    vapiAssistantId: string | null;
    vapiPhoneNumberId: string | null;
    timezone: string;
  } | null;
  enrollment?: {
    id: string;
    status: string;
    stopReason: string | null;
    lastCalledAt: string | null;
    nextCallAt: string | null;
    attemptCount: number;
  } | null;
};

export type OutreachActivityEvent =
  | ({ channel: "EMAIL" } & OutreachEmailEvent)
  | ({ channel: "PHONE" } & OutreachPhoneEvent);

export type OutreachOverview = {
  totalLeads: number;
  activeEnrollments: number;
  activePhoneEnrollments?: number;
  emailsSent: number;
  phoneCallsStarted?: number;
  failedEmails?: number;
  failedCalls?: number;
  replies: number;
  unsubscribes: number;
  activeMultiChannelLeads?: number;
  recentEvents: OutreachActivityEvent[];
};

export type OutreachBulkImportRowResult =
  | { lineNumber: number; status: "created"; leadId: string; email: string; enrollmentId?: string }
  | { lineNumber: number; status: "duplicate"; email: string; reason: string }
  | { lineNumber: number; status: "invalid"; reason: string; raw: string };

export type BusinessSettings = {
  id: string;
  orgId: string;
  hoursJson: string;
  afterHoursMode: "TAKE_MESSAGE" | "TRANSFER" | "VOICEMAIL";
  voiceRoutingMode?: "AI_FIRST" | "PASSIVE_FORWARDING" | "HUMAN_FIRST_AI_FALLBACK";
  voiceForwardingEnabled?: boolean;
  voiceForwardingNumber?: string;
  voiceRingTimeoutSeconds?: number;
  afterHoursVoiceFallbackEnabled?: boolean;
  voiceCallRecordingEnabled?: boolean;
  voiceMediaStreamingEnabled?: boolean;
  voiceMediaTrackStrategy?: "BOTH_TRACKS";
  voiceTranscriptionEnabled?: boolean;
  serviceRequestAutomationEnabled?: boolean;
  serviceRequestFollowupSmsEnabled?: boolean;
  serviceRequestInternalAlertsEnabled?: boolean;
  transferNumbersJson: string;
  notificationEmailsJson: string;
  notificationPhonesJson: string;
  notificationEmailRecipientsJson?: string;
  notificationTogglesJson?: string;
  languagesJson: string;
  recordingConsentEnabled: boolean;
  smsConsentText: string;
  timezone: string;
  averageJobValueUsd?: number;
  appointmentDurationMinutes?: number;
  appointmentBufferMinutes?: number;
  bookingLeadTimeHours?: number;
  bookingMaxDaysAhead?: number;
  classificationShadowMode?: boolean;
  classificationLlmDailyCap?: number;
  servicesJson: string;
  policiesJson: string;
  updatedAt: string;
};

export type CalendarConnection = {
  id: string;
  provider: "GOOGLE" | "OUTLOOK" | "INTERNAL";
  accountEmail: string;
  isActive: boolean;
  isPrimary?: boolean;
  selectedCalendarId?: string | null;
  expiresAt: string;
  createdAt: string;
};

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
export type CalendarProvider = "GOOGLE" | "OUTLOOK" | "INTERNAL";
export type OrgFeatureFlags = {
  appointmentsEnabled?: boolean;
  calendarOauthEnabled?: boolean;
  notificationsEnabled?: boolean;
  pipelineStageEnabled?: boolean;
  classificationEnabled?: boolean;
};

export type AccessStatus = "ready" | "setup_required" | "gated" | "blocked";
export type AccessFeatureKey = "calls" | "sms" | "appointments" | "outreach";

export type AccessFeatureState = {
  key: AccessFeatureKey;
  label: string;
  status: AccessStatus;
  reason: string;
  allowedByPlan: boolean;
  enabledByOrg: boolean;
};

export type AccessReadinessCheck = {
  key: string;
  label: string;
  description: string;
  detail?: string;
  status: AccessStatus;
};

export type OrgAccessSummary = {
  plan: {
    name: "NONE" | "STARTER" | "PRO";
    active: boolean;
  };
  features: Record<AccessFeatureKey, AccessFeatureState>;
  readinessChecklist: AccessReadinessCheck[];
};

export type Appointment = {
  id: string;
  orgId: string;
  leadId: string | null;
  callLogId: string | null;
  customerName: string;
  customerPhone: string;
  issueSummary: string;
  assignedTechnician: string | null;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  calendarProvider: CalendarProvider;
  externalCalendarEventId: string | null;
  idempotencyKey: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  callLog?: {
    id: string;
    providerCallId: string | null;
    startedAt: string;
  } | null;
};

export type AppointmentRequestStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "DENIED"
  | "SLOT_OFFERED"
  | "SCHEDULED"
  | "CLOSED";

export type AppointmentRequest = {
  id: string;
  callLogId: string;
  providerCallId: string | null;
  leadId: string | null;
  appointmentId: string | null;
  customerName: string;
  customerPhone: string;
  callerPhone: string;
  followUpPhone: string | null;
  effectiveSmsPhone: string;
  issueSummary: string;
  serviceAddress: string | null;
  startedAt: string;
  createdAt: string;
  lastEventAt: string;
  requestedStartAt: string | null;
  requestedTimeLabel: string | null;
  requestedPreference: string | null;
  requestState: string;
  status: AppointmentRequestStatus;
  source: "WORKER" | "BACKFILLED" | "MANUAL";
  assignedUserId: string | null;
  assignedUserLabel: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByLabel: string | null;
  denialReason: string | null;
  pipelineStage: LeadPipelineStage | null;
  latestMessageThreadId?: string | null;
  latestMessageAt?: string | null;
  latestMessageDirection?: "INBOUND" | "OUTBOUND" | null;
};

export type OrgCalendarEvent = {
  id: string;
  provider: "GOOGLE" | "OUTLOOK";
  title: string;
  viewUrl?: string | null;
  startAt: string;
  endAt: string;
};

export type OrgNotification = {
  id: string;
  orgId: string;
  type: "NEW_LEAD_CAPTURED" | "APPOINTMENT_BOOKED" | "MISSED_CALL_RECOVERY_NEEDED" | "EMERGENCY_CALL_FLAGGED";
  severity: "INFO" | "ACTION_REQUIRED" | "URGENT";
  title: string;
  body: string;
  targetRoleMin: string;
  readAt: string | null;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type ActionNeededItem = {
  id: string;
  type: "NEEDS_REVIEW" | "NEEDS_FOLLOW_UP" | "NEEDS_FIX";
  severity: "info" | "warning" | "critical";
  label: string;
  detail?: string;
  href: string;
  ctaLabel?: string;
  timestamp?: string | null;
  sourceModule: "conversations" | "leads" | "appointments" | "messages" | "system";
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
    appointmentsBooked?: number;
    qualifiedLeads?: number;
    missedCallsRecovered?: number;
    rescuedCalls?: number;
    aiRescueRate?: number;
    conversionRate?: number;
    averageJobValueUsd?: number;
    estimatedRevenueOpportunityUsd?: number;
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
  emailProviderConfigured?: boolean;
  auth2fa?: {
    required24h: number;
    otpSuccess24h: number;
    invalidOtp24h: number;
    emailFailure24h: number;
    testEmailsSent24h: number;
    testEmailsFailed24h: number;
  };
  securityCounters?: {
    stepUpForbidden24h: number;
    toolOrgContextRejected24h: number;
    webhookSignatureInvalid24h: number;
    webhookReplayBlocked24h: number;
    webhookRetryWorthyFailure24h: number;
    smsAutomationSuppressed24h: number;
    quotaOrgSmsHourly24h: number;
    quotaOrgSmsDaily24h: number;
    requestOfferSuppressed24h: number;
    requestClarificationSuppressed24h: number;
  };
  securityAlerts?: Array<{
    key: string;
    severity: "warning" | "critical";
    label: string;
    value: number;
  }>;
  recentSecurityEvents?: Array<{
    id: string;
    source: "AUDIT" | "WEBHOOK";
    action: string;
    orgId: string | null;
    provider: string | null;
    route: string;
    requestId: string;
    actorUserId: string | null;
    reason: string;
    createdAt: string;
  }>;
};

export type AuthSecurityStatus = {
  email: string;
  role: string;
  twoFactorEnabledForAccount: boolean;
  emailProviderConfigured: boolean;
  lastOtpEmailSentAt: string | null;
  lastOtpEmailFailedAt: string | null;
  lastOtpVerifiedAt: string | null;
  lastOtpFailureReason: string | null;
  lastTestEmailSentAt: string | null;
  lastTestEmailFailedAt: string | null;
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

export type AdminReportRecipient = {
  id: string;
  email: string;
  isActive: boolean;
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  includeSystemDashboard: boolean;
  includeSystemReadiness: boolean;
  includeScaleGate: boolean;
  includeSecuritySummary: boolean;
  includeRevenueSummary: boolean;
  includeOutreachOverview: boolean;
  includeBillingDiagnostics: boolean;
  notes: string | null;
  lastDailySentAt: string | null;
  lastWeeklySentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrgHealth = {
  level: "GREEN" | "YELLOW" | "RED";
  score: number;
  summary: string;
  checks: Record<string, { ok: boolean; reason: string; fixHint: string }>;
  metrics: {
    avgSuccessScore: number;
    avgCallQuality?: number;
    slaSeverity?: string;
    recentActivityAt: string | null;
  };
  missingChecks?: Array<{ key: string; reason: string; fixHint: string }>;
  runtimeHealth?: {
    level: "GREEN" | "YELLOW" | "RED";
    score: number;
    summary: string;
    checks: Record<string, { ok: boolean; reason: string; fixHint: string }>;
    metrics: {
      avgSuccessScore: number;
      avgCallQuality: number;
      slaSeverity: string;
      recentActivityAt: string | null;
    };
    missingChecks: Array<{ key: string; reason: string; fixHint: string }>;
  };
  readiness?: {
    level: "READY" | "NEEDS_ACTION" | "INCOMPLETE";
    summary: string;
    canGoLive: boolean;
    checks: Record<string, { ok: boolean; reason: string; fixHint: string }>;
    missingChecks: Array<{ key: string; reason: string; fixHint: string }>;
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

export type AiAgentKey =
  | "front_desk"
  | "lead_ops"
  | "communications"
  | "scheduling"
  | "crm_pipeline"
  | "task_followup"
  | "knowledge"
  | "manager_analytics"
  | "dispatch_ops";

export type AgentDefinition = {
  id: string;
  key: AiAgentKey;
  name: string;
  description: string;
  domain: string;
  enabled: boolean;
  approvalPolicy: string;
  promptKey: string;
  modelProvider: string;
  modelName: string | null;
  allowedTools: string[];
  allowedEntities: string[];
};

export type AgentActionLog = {
  id: string;
  toolKey: string | null;
  actionType: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";
  inputSummary: string | null;
  outputSummary: string | null;
  approvalRequired: boolean;
  approvalRequestId: string | null;
  entityType: string | null;
  entityId: string | null;
  errorCode: string | null;
  errorSummary: string | null;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
};

export type AgentRun = {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED_APPROVAL";
  routeReason: string;
  inputSummary: string | null;
  outputSummary: string | null;
  confidence: number | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  updatedAt: string;
  actionLogs: AgentActionLog[];
};

export type ApprovalAction = {
  id: string;
  action: "APPROVED" | "REJECTED" | "PENDING" | "EXPIRED";
  note: string | null;
  actorUserId: string | null;
  createdAt: string;
};

export type ApprovalRequest = {
  id: string;
  actionType: string;
  toolKey: string;
  entityType: string | null;
  entityId: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  deliveryChannel: "SMS" | "EMAIL" | null;
  deliveryStatus: "PENDING" | "QUEUED" | "SENDING" | "SENT" | "FAILED" | "REJECTED" | null;
  deliveryProvider: string | null;
  providerMessageId: string | null;
  approvedSubject: string | null;
  approvedContent: string | null;
  sentAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  retryable: boolean;
  retryCount: number;
  reason: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  createdAt: string;
  updatedAt: string;
  requestedByUser?: { id: string; email: string } | null;
  actions: ApprovalAction[];
};

export type AgentEntityMemory = {
  id: string;
  entityType: string;
  entityId: string;
  latestSummary: string | null;
  latestClassification: string | null;
  latestRecommendation: string | null;
  recommendationWhy: string | null;
  recommendationPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;
  approvalNeeded: boolean;
  outboundBlocked: boolean;
  lastApprovalStatus: string | null;
  lastDeliveryStatus: string | null;
  lastTaskStatus: string | null;
  riskFlagsJson: string[];
  contextJson: Record<string, unknown>;
  updatedAt: string;
};

export type EntityRecommendationInspection = {
  action: string | null;
  why: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;
  approvalNeeded: boolean;
  shouldCreateFollowup: boolean;
  blockedReasons: string[];
  refreshedAt: string;
};

export type EntityOperationalMemoryBlock = {
  entityType: string;
  entityId: string;
  latestSummary: string | null;
  latestClassification: string | null;
  recommendation: EntityRecommendationInspection | null;
  approvalSnapshot: {
    lastApprovalStatus: string | null;
    lastDeliveryStatus: string | null;
    approvalNeeded: boolean;
  };
  taskSnapshot: {
    lastTaskStatus: string | null;
    openFollowUpCount: number;
  };
  riskFlags: string[];
  outboundBlocked: boolean;
  updatedAt: string;
};

export type EntityHandoffInspection = {
  id: string;
  at: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";
  sourceAgent: string | null;
  targetAgent: string | null;
  targetTool: string | null;
  reason: string | null;
  sourceRecommendationSnapshot: Record<string, unknown> | null;
  targetResultSummary: string | null;
  suppressed: boolean;
  suppressionReason: string | null;
  createdApproval: boolean;
  createdFollowup: boolean;
  createdTask: boolean;
  approvalRequestId: string | null;
};

export type EntityAiTimelineResponse = {
  audit: AuditEvent[];
  runs: AgentRun[];
  approvals: ApprovalRequest[];
  memory?: AgentEntityMemory | null;
  operationalMemory?: EntityOperationalMemoryBlock | null;
  recommendation?: EntityRecommendationInspection | null;
  handoffs?: EntityHandoffInspection[];
};

export type AiRunResponse = {
  runId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED_APPROVAL";
  agentKey: AiAgentKey;
  routeReason: string;
  summary?: string;
  approvalRequired: boolean;
  approvalRequestId?: string;
  actions: Array<{
    toolKey: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";
    approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
    message?: string;
  }>;
};

export type FollowUpQueueItem = {
  id: string;
  entityType: string | null;
  entityId: string | null;
  reason: string;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
  task: FollowUpTask | null;
};

export type FollowUpTask = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueAt: string | null;
  assignedToUserId?: string | null;
  assignedToUser?: { id: string; email: string } | null;
  entityType?: string | null;
  entityId?: string | null;
};

export type ManagerInsightSummary = {
  since: string;
  callsTotal: number;
  callsMissed: number;
  messagesTotal: number;
  bookingRequests: number;
  openFollowUps: number;
  pendingApprovals: number;
};
