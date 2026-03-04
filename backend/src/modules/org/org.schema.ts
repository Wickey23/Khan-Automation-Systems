import { z } from "zod";

export const onboardingAnswersSchema = z.object({
  businessProfile: z
    .object({
      legalBusinessName: z.string().optional(),
      displayName: z.string().optional(),
      industry: z.string().optional(),
      address: z.string().optional(),
      serviceArea: z.string().optional(),
      website: z.string().optional()
    })
    .optional(),
  hoursAvailability: z
    .object({
      businessHours: z.record(z.string(), z.any()).optional(),
      holidayPolicy: z.string().optional(),
      afterHoursInstructions: z.string().optional()
    })
    .optional(),
  servicesPricing: z
    .object({
      serviceCategories: z.array(z.string()).optional(),
      startingPriceRanges: z.string().optional()
    })
    .optional(),
  bookingScheduling: z
    .object({
      enableAppointments: z.boolean().optional(),
      bookingMethod: z.enum(["manual", "google_calendar", "manager_notify"]).optional(),
      appointmentDurationMin: z.number().int().positive().optional(),
      usesBookingApp: z.enum(["yes", "no", "not_sure"]).optional(),
      bookingAppName: z.string().optional(),
      bookingAppMode: z.enum(["direct_booking", "staff_review", "link_only"]).optional(),
      bookingLink: z.string().optional(),
      bookingAccountEmail: z.string().optional(),
      appointmentBufferMin: z.number().int().min(0).optional()
    })
    .optional(),
  callHandlingPreferences: z
    .object({
      greetingTone: z.string().optional(),
      languages: z.array(z.string()).optional(),
      transferNumbers: z.array(z.string()).optional(),
      transferWhen: z.array(z.string()).optional(),
      voicemailBehavior: z.string().optional()
    })
    .optional(),
  intakeQuestions: z
    .object({
      askCallerName: z.boolean().optional(),
      askPhone: z.boolean().optional(),
      askVehicleType: z.boolean().optional(),
      askIssueDescription: z.boolean().optional(),
      askDesiredDateTime: z.boolean().optional(),
      askLocation: z.boolean().optional(),
      customQuestions: z.array(z.string()).optional()
    })
    .optional(),
  policies: z
    .object({
      warrantyPolicy: z.string().optional(),
      cancellationPolicy: z.string().optional(),
      diagnosticsPolicy: z.string().optional()
    })
    .optional(),
  notifications: z
    .object({
      managerEmails: z.array(z.string().email()).optional(),
      managerPhones: z.array(z.string()).optional(),
      leadSummaryRecipients: z.array(z.string().email()).optional()
    })
    .optional(),
  existingTools: z
    .object({
      shopManagementSystem: z.string().optional(),
      crm: z.string().optional(),
      websiteForm: z.string().optional()
    })
    .optional(),
  demoTestMode: z
    .object({
      enabled: z.boolean().optional()
    })
    .optional()
});

export const saveOnboardingSchema = z.object({
  answers: onboardingAnswersSchema
});

export const submitOnboardingSchema = z.object({
  answers: onboardingAnswersSchema.optional()
});

export const updateOrgProfileSchema = z.object({
  name: z.string().min(2).optional(),
  industry: z.string().optional().nullable()
});

export const updateBusinessSettingsSchema = z.object({
  hoursJson: z.string().optional(),
  afterHoursMode: z.enum(["TAKE_MESSAGE", "TRANSFER", "VOICEMAIL"]).optional(),
  transferNumbersJson: z.string().optional(),
  notificationEmailsJson: z.string().optional(),
  notificationPhonesJson: z.string().optional(),
  notificationEmailRecipientsJson: z.string().optional(),
  notificationTogglesJson: z.string().optional(),
  languagesJson: z.string().optional(),
  recordingConsentEnabled: z.boolean().optional(),
  smsConsentText: z.string().optional(),
  timezone: z.string().optional(),
  averageJobValueUsd: z.number().int().min(0).max(1000000).optional(),
  appointmentDurationMinutes: z.number().int().min(5).max(480).optional(),
  appointmentBufferMinutes: z.number().int().min(0).max(240).optional(),
  bookingLeadTimeHours: z.number().int().min(0).max(168).optional(),
  bookingMaxDaysAhead: z.number().int().min(1).max(90).optional(),
  classificationShadowMode: z.boolean().optional(),
  classificationLlmDailyCap: z.number().int().min(0).max(2000).optional(),
  servicesJson: z.string().optional(),
  policiesJson: z.string().optional()
});

export const sendOrgMessageSchema = z.object({
  to: z.string().min(5),
  body: z.string().min(1).max(1000),
  leadId: z.string().optional()
});
