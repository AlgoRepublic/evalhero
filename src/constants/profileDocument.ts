/**
 * Accepted file types for profile documents (per PROFILE_DOCUMENTS_API.md).
 * PDF and image formats: JPEG, PNG, GIF, WebP, HEIC/HEIF, BMP, TIFF, SVG.
 * Use both extensions and MIME types so file picker shows correct files on all platforms.
 */
export const PROFILE_DOCUMENT_ACCEPT =
  '.pdf,.jpg,.jpeg,.jpe,.jfif,.png,.gif,.webp,.heic,.heif,.bmp,.tif,.tiff,.svg,application/pdf,image/jpeg,image/png,image/gif,image/webp,image/heic,image/bmp,image/tiff,image/svg+xml';

export const PROFILE_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  certificate: 'Certificate',
  license: 'License',
  id: 'ID',
  passport: 'Passport',
  visa: 'Visa',
  insurance: 'Insurance',
  other: 'Other',
};
