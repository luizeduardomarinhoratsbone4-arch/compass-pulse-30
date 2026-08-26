/** Único e-mail com acesso à plataforma. */
export const ALLOWED_EMAIL = "infradata.bets@gmail.com";

export const isAllowedEmail = (email?: string | null) =>
  (email ?? "").trim().toLowerCase() === ALLOWED_EMAIL;
