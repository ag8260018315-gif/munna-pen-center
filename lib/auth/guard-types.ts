export type AdminRole = "OWNER" | "STAFF";

export interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
  /** True only for the development preview session (no database configured, not production). */
  isPreview: boolean;
}
