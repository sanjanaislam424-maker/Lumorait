export type LoginBranding = {
  logoOpacity: number;
  logoBlur: number;
  cardOpacity: number;
  cardBlur: number;
  beamEnabled: boolean;
  beamSpread: number;
  beamOpacity: number;
  beamBlur: number;
};

export const DEFAULT_LOGIN_BRANDING: LoginBranding = {
  logoOpacity: 80,
  logoBlur: 2,
  cardOpacity: 25,
  cardBlur: 24,
  beamEnabled: true,
  beamSpread: 50,
  beamOpacity: 60,
  beamBlur: 40,
};

export const LOGIN_BRANDING_LIMITS = {
  logoOpacity: { min: 0, max: 100 },
  logoBlur: { min: 0, max: 20 },
  cardOpacity: { min: 0, max: 100 },
  cardBlur: { min: 0, max: 40 },
  beamSpread: { min: 0, max: 100 },
  beamOpacity: { min: 0, max: 100 },
  beamBlur: { min: 0, max: 100 },
} as const;

export function logoBlurPx(value: number) {
  return value / 2;
}

export function parseLoginBranding(raw: unknown): { logoUrl: string | null; branding: LoginBranding } {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    logoUrl: typeof row.logo_url === 'string' && row.logo_url ? row.logo_url : null,
    branding: {
      logoOpacity: num(row.logo_opacity, DEFAULT_LOGIN_BRANDING.logoOpacity),
      logoBlur: num(row.logo_blur, DEFAULT_LOGIN_BRANDING.logoBlur),
      cardOpacity: num(row.card_opacity, DEFAULT_LOGIN_BRANDING.cardOpacity),
      cardBlur: num(row.card_blur, DEFAULT_LOGIN_BRANDING.cardBlur),
      beamEnabled: typeof row.beam_enabled === 'boolean' ? row.beam_enabled : DEFAULT_LOGIN_BRANDING.beamEnabled,
      beamSpread: num(row.beam_spread, DEFAULT_LOGIN_BRANDING.beamSpread),
      beamOpacity: num(row.beam_opacity, DEFAULT_LOGIN_BRANDING.beamOpacity),
      beamBlur: num(row.beam_blur, DEFAULT_LOGIN_BRANDING.beamBlur),
    },
  };
}
