// GitHub login charset: alphanumeric + single hyphens, 1-39 chars
const SLUG_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
export const isValidSlug = (s: string): boolean => SLUG_RE.test(s);
