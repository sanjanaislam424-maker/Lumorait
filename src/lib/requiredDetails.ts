import type { Profile } from '@/lib/supabase';

export type RequiredDetailsForm = {
  full_name: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  show_phone: boolean;
  show_email: boolean;
  share_contact_info: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hasMissingRequiredDetails(profile: Profile): boolean {
  return (
    !profile.full_name?.trim() ||
    !profile.contact_phone?.trim() ||
    !profile.contact_email?.trim() ||
    !profile.address?.trim()
  );
}

export function formFromProfile(profile: Profile): RequiredDetailsForm {
  const phoneFromLogin = profile.phone && !profile.phone.includes('@') ? profile.phone : '';
  const emailFromLogin = profile.phone && profile.phone.includes('@') ? profile.phone : '';
  return {
    full_name: profile.full_name ?? '',
    contact_phone: profile.contact_phone ?? phoneFromLogin,
    contact_email: profile.contact_email ?? emailFromLogin,
    address: profile.address ?? '',
    show_phone: profile.show_phone,
    show_email: profile.show_email,
    share_contact_info: profile.share_contact_info,
  };
}

export function validateRequiredDetails(form: RequiredDetailsForm): string | null {
  if (form.full_name.trim().length < 2) return 'Enter your full name.';
  if (form.contact_phone.replace(/\D/g, '').length < 10) return 'Enter a valid mobile number.';
  if (!EMAIL_PATTERN.test(form.contact_email.trim())) return 'Enter a valid email address.';
  if (form.address.trim().length < 5) return 'Enter your address.';
  return null;
}
