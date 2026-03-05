import "dotenv/config";

type CheckResult = {
  key: string;
  ok: boolean;
  message?: string;
};

function isTruthy(value: string | undefined) {
  return String(value || "").trim().toLowerCase() === "true";
}

function hasValue(value: string | undefined) {
  return String(value || "").trim().length > 0;
}

function add(results: CheckResult[], key: string, ok: boolean, message?: string) {
  results.push({ key, ok, message });
}

function runChecks() {
  const results: CheckResult[] = [];

  const appointments = isTruthy(process.env.FEATURE_APPOINTMENTS_ENABLED);
  const calendarOauth = isTruthy(process.env.FEATURE_CALENDAR_OAUTH_ENABLED);
  const notifications = isTruthy(process.env.FEATURE_NOTIFICATIONS_V1_ENABLED);
  const classification = isTruthy(process.env.FEATURE_CLASSIFICATION_V1_ENABLED);

  add(
    results,
    "FEATURE_APPOINTMENTS_ENABLED",
    hasValue(process.env.FEATURE_APPOINTMENTS_ENABLED),
    "Set true/false explicitly."
  );
  add(
    results,
    "FEATURE_CALENDAR_OAUTH_ENABLED",
    hasValue(process.env.FEATURE_CALENDAR_OAUTH_ENABLED),
    "Set true/false explicitly."
  );
  add(
    results,
    "FEATURE_NOTIFICATIONS_V1_ENABLED",
    hasValue(process.env.FEATURE_NOTIFICATIONS_V1_ENABLED),
    "Set true/false explicitly."
  );
  add(
    results,
    "FEATURE_CLASSIFICATION_V1_ENABLED",
    hasValue(process.env.FEATURE_CLASSIFICATION_V1_ENABLED),
    "Set true/false explicitly."
  );
  add(
    results,
    "FEATURE_PIPELINE_STAGE_ENABLED",
    hasValue(process.env.FEATURE_PIPELINE_STAGE_ENABLED),
    "Set true/false explicitly."
  );
  add(
    results,
    "FEATURE_PHASE1_ORG_ALLOWLIST",
    hasValue(process.env.FEATURE_PHASE1_ORG_ALLOWLIST),
    "Set org ids CSV, '*' or 'all' for broad rollout."
  );
  add(
    results,
    "ENCRYPTION_KEY_BASE64",
    hasValue(process.env.ENCRYPTION_KEY_BASE64),
    "Required for encrypted calendar token storage."
  );

  if (calendarOauth) {
    add(results, "GOOGLE_OAUTH_CLIENT_ID", hasValue(process.env.GOOGLE_OAUTH_CLIENT_ID), "Required when calendar OAuth is enabled.");
    add(results, "GOOGLE_OAUTH_CLIENT_SECRET", hasValue(process.env.GOOGLE_OAUTH_CLIENT_SECRET), "Required when calendar OAuth is enabled.");
    add(results, "GOOGLE_OAUTH_CALLBACK_URL", hasValue(process.env.GOOGLE_OAUTH_CALLBACK_URL), "Required when calendar OAuth is enabled.");
    add(results, "OUTLOOK_OAUTH_CLIENT_ID", hasValue(process.env.OUTLOOK_OAUTH_CLIENT_ID), "Required when calendar OAuth is enabled.");
    add(results, "OUTLOOK_OAUTH_CLIENT_SECRET", hasValue(process.env.OUTLOOK_OAUTH_CLIENT_SECRET), "Required when calendar OAuth is enabled.");
    add(results, "OUTLOOK_OAUTH_CALLBACK_URL", hasValue(process.env.OUTLOOK_OAUTH_CALLBACK_URL), "Required when calendar OAuth is enabled.");
  }

  if (notifications) {
    const hasEmailProvider = hasValue(process.env.RESEND_API_KEY) || hasValue(process.env.SMTP_HOST);
    add(
      results,
      "NOTIFICATION_EMAIL_PROVIDER",
      hasEmailProvider,
      "Set RESEND_API_KEY or SMTP_HOST for notification emails."
    );
  }

  if (classification) {
    add(results, "OPENAI_API_KEY", hasValue(process.env.OPENAI_API_KEY), "Required for LLM fallback path.");
  }

  if (appointments) {
    add(results, "API_BASE_URL", hasValue(process.env.API_BASE_URL), "Used for callback links and webhook-safe redirects.");
    add(results, "FRONTEND_APP_URL", hasValue(process.env.FRONTEND_APP_URL), "Used for hosted return URLs.");
  }

  return results;
}

function printResults(results: CheckResult[]) {
  const failed = results.filter((row) => !row.ok);
  const passed = results.filter((row) => row.ok);

  // eslint-disable-next-line no-console
  console.log(`Phase 1 env check: ${passed.length} passed, ${failed.length} failed`);
  for (const row of results) {
    const mark = row.ok ? "PASS" : "FAIL";
    // eslint-disable-next-line no-console
    console.log(`[${mark}] ${row.key}${row.message ? ` - ${row.message}` : ""}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

printResults(runChecks());
