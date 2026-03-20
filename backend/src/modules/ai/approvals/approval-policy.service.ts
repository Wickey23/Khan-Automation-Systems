const ALWAYS_APPROVAL_TOOLS = new Set([
  "queue_email",
  "queue_sms",
  "send_approved_email",
  "send_approved_sms",
  "update_appointment_status",
  "draft_outreach_email",
  "draft_outreach_sms",
  "mark_lead_status"
]);

export function toolRequiresApproval(toolKey: string) {
  return ALWAYS_APPROVAL_TOOLS.has(toolKey);
}

export function canApproveAsRole(role: string, allowClientStaffApprovals: boolean) {
  if (role === "CLIENT_ADMIN") return true;
  if (role === "CLIENT_STAFF" && allowClientStaffApprovals) return true;
  return false;
}
