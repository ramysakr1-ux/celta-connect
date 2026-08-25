export const ROLE_KEYS = ["mct", "act", "trainee", "assessor", "volunteer", "centre_admin"] as const;
export type DemoLoginRoleKey = (typeof ROLE_KEYS)[number];
