/**
 * Supported file formats for course page documents (see SUPPORTED_FILE_FORMATS.md).
 * Used for accept attribute and client-side validation.
 */

export const COURSE_PAGE_DOCUMENT_MIME_TYPES = [
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
  'video/3gpp',
  'video/3gpp2',
  // Audio
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

/** Accept string for file input (extensions + MIME). */
export const COURSE_PAGE_DOCUMENT_ACCEPT =
  'video/*,audio/*,image/*,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.odt,.ods,.odp';

/** Default max file size in MB for client-side hint (server enforces quota). */
export const COURSE_PAGE_DOCUMENT_MAX_SIZE_MB = 500;

export function isAllowedCoursePageDocumentMimeType(mimeType: string): boolean {
  return (COURSE_PAGE_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function validateCoursePageDocumentFile(
  file: File,
  maxSizeMB: number = COURSE_PAGE_DOCUMENT_MAX_SIZE_MB
): { valid: true } | { valid: false; error: string } {
  if (!isAllowedCoursePageDocumentMimeType(file.type)) {
    return { valid: false, error: `Unsupported file type: ${file.type}. Upload a video, audio, PDF, document, or image.` };
  }
  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB > maxSizeMB) {
    return { valid: false, error: `File too large: ${fileSizeMB.toFixed(2)} MB (max: ${maxSizeMB} MB).` };
  }
  return { valid: true };
}

/** Icon key by MIME for list/view. */
export function getCoursePageDocumentIcon(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('word') || mimeType === 'application/rtf') return 'document';
  return 'file';
}
