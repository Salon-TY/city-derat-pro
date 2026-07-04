export const EMPLOYEE_EMAIL_DOMAIN = "team.cityderat.local";

/** Normalise un identifiant : minuscules, sans espaces. */
export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

/** Identifiant employé -> email interne Supabase. */
export function usernameToEmail(u: string): string {
  return `${normalizeUsername(u)}@${EMPLOYEE_EMAIL_DOMAIN}`;
}

/** Règle de validation d'un identifiant : 3–30 car., a-z 0-9 . _ - */
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
