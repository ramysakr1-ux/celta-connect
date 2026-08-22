// Shared between Course Admin's roster (dashboard/admin/courses/[id]) and
// Centre Admin's role invites (centre/roles) -- same compact vocabulary as
// email-history-panel.tsx's full history list, just for a single roster-row
// pill rather than a list.
export type EmailDeliveryStatus = "sent" | "delivered" | "opened" | "bounced" | "failed";

export const DELIVERY_LABEL: Record<EmailDeliveryStatus, string> = {
  sent: "Pending",
  delivered: "Delivered",
  opened: "Delivered",
  bounced: "Bounced",
  failed: "Failed",
};

export const DELIVERY_PILL_CLASS: Record<EmailDeliveryStatus, string> = {
  sent: "status-pill-pending",
  delivered: "status-pill-on-track",
  opened: "status-pill-on-track",
  bounced: "status-pill-at-risk",
  failed: "status-pill-at-risk",
};
