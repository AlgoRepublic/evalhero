import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface Country {
  name: string;
  dialCode: string;
  isoCode: string;
  emoji: string | null;
  flag: string;
}

export interface PhoneValidationResult {
  isValid: boolean;
  international: string | null;
  national: string | null;
  countryCode: CountryCode | null;
}

/**
 * Validate and format phone number against country dial code
 */
export function validatePhoneNumber(
  selectedCountry: Country,
  phoneNumber: string,
): PhoneValidationResult {
  if (!selectedCountry?.dialCode || !phoneNumber) {
    return {
      isValid: false,
      international: null,
      national: null,
      countryCode: null,
    };
  }

  const fullNumber = `${selectedCountry.dialCode}${phoneNumber}`;

  try {
    const parsed = parsePhoneNumberFromString(fullNumber);

    if (parsed && parsed.isValid()) {
      return {
        isValid: true,
        international: parsed.formatInternational(), // e.g. +355 21 388 7997
        national: parsed.formatNational(), // e.g. 021 388 7997
        countryCode: parsed.country ?? null, // e.g. AL
      };
    }

    return {
      isValid: false,
      international: null,
      national: null,
      countryCode: null,
    };
  } catch (error) {
    return {
      isValid: false,
      international: null,
      national: null,
      countryCode: null,
    };
  }
}