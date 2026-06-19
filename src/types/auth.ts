export type OtpDeliveryChannel = 'email' | 'sms';

export type OtpDeliveryPreference = OtpDeliveryChannel | 'both';

export interface OtpDeliveryTargets {
  email: string | null;
  phone: string | null;
}
