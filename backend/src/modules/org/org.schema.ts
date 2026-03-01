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
      appointmentDurationMin: z.number().int().positive().optional()
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
