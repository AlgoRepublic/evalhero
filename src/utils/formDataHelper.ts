
export function toFormData(
  data: unknown,
  parentKey = ''
): FormData {
  const formData = new FormData();

  function appendFormData(value: unknown, key: string) {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        // Handle empty arrays by appending with array notation and empty value
        // This ensures the field is present in FormData even when array is empty
        // Backends using multer/formidable will parse this as an empty array
        formData.append(`${key}[]`, '');
      } else {
        value.forEach((v, i) => {
          appendFormData(v, `${key}[${i}]`);
        });
      }
    } else if (value instanceof File) {
      formData.append(key, value);
    } else if (value instanceof Date) {
      formData.append(key, value.toISOString());
    } else if (typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
        const newKey = key ? `${key}[${childKey}]` : childKey;
        appendFormData(childValue, newKey);
      });
    } else {
      formData.append(key, String(value));
    }
  }

  appendFormData(data, parentKey);

  return formData;
}
