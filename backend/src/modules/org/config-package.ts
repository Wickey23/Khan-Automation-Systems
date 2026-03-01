type JsonMap = Record<string, unknown>;

function asObject(value: unknown): JsonMap {
  return value && typeof value === "object" ? (value as JsonMap) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function buildConfigPackage(answers: JsonMap) {
  const businessProfile = asObject(answers.businessProfile);
  const hours = asObject(answers.hoursAvailability);
  const services = asObject(answers.servicesPricing);
  const booking = asObject(answers.bookingScheduling);
  const callPrefs = asObject(answers.callHandlingPreferences);
  const intake = asObject(answers.intakeQuestions);
  const policies = asObject(answers.policies);
  const notifications = asObject(answers.notifications);

  const intakeQuestions = [
    { key: "caller_name", label: "Caller name", type: "string", required: true },
    { key: "phone", label: "Phone number", type: "string", required: true },
    { key: "asset_type", label: "Vehicle/equipment type", type: "string", required: true },
    { key: "issue", label: "Issue description", type: "string", required: true },
    { key: "desired_time", label: "Desired date/time", type: "string", required: false },
    { key: "location", label: "Service location", type: "string", required: false },
    ...asStringArray(intake.customQuestions).map((q, index) => ({
      key: `custom_${index + 1}`,
      label: q,
      type: "string",
      required: false
    }))
  ];

  return {
    businessProfile: {
      legalBusinessName: String(businessProfile.legalBusinessName || ""),
      displayName: String(businessProfile.displayName || ""),
      industry: String(businessProfile.industry || ""),
      address: String(businessProfile.address || ""),
      serviceArea: String(businessProfile.serviceArea || ""),
      website: String(businessProfile.website || "")
    },
    hours: {
      schedule: asObject(hours.businessHours),
      holidayPolicy: String(hours.holidayPolicy || ""),
      afterHoursInstructions: String(hours.afterHoursInstructions || "")
    },
    services: asStringArray(services.serviceCategories),
    policies: {
      warranty: String(policies.warrantyPolicy || ""),
      cancellation: String(policies.cancellationPolicy || ""),
      diagnostics: String(policies.diagnosticsPolicy || "")
    },
    intakeSchema: intakeQuestions,
    transferRules: {
      transferNumbers: asStringArray(callPrefs.transferNumbers),
      whenToTransfer: asStringArray(callPrefs.transferWhen),
      voicemailBehavior: String(callPrefs.voicemailBehavior || "take_message")
    },
    escalationKeywords: ["towing", "no brakes", "accident", "smoke", "won't start"],
    appointmentPolicy: {
      enabled: Boolean(booking.enableAppointments),
      method: String(booking.bookingMethod || "manager_notify"),
      durationMin: Number(booking.appointmentDurationMin || 30)
    },
    notifications: {
      managerEmails: asStringArray(notifications.managerEmails),
      managerPhones: asStringArray(notifications.managerPhones),
      leadSummaryRecipients: asStringArray(notifications.leadSummaryRecipients)
    },
    consentScripts: {
      recordingConsent:
        "This call may be recorded for quality and training purposes. Do you consent to continue?",
      smsConsent: "By continuing, you agree to receive text updates about your service request."
    }
  };
}
