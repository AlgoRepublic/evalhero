import { message } from 'antd';
import dayjs from 'dayjs';
import { Parser } from 'expr-eval';


export const normalizeFormValues = (attrs: Record<string, any>, type: string): Record<string, any> => {
  const initial: Record<string, any> = { ...attrs };

  try {
    // Handle options array/object to comma-separated string
    if (initial.options !== undefined) {
      if (Array.isArray(initial.options)) {
        initial.options = initial.options
          .map((o: any) => (typeof o === 'object' ? o.label || o.id || '' : String(o)))
          .filter(Boolean)
          .join(', ');
      } else if (typeof initial.options === 'string') {
        // Keep as-is
      } else {
        initial.options = '';
      }
    }

    // Handle marks object to JSON string
    if (initial.marks && typeof initial.marks === 'object') {
      try {
        initial.marks = JSON.stringify(initial.marks);
      } catch {
        initial.marks = String(initial.marks);
      }
    }

    // Handle array fields to comma-separated strings
    ['requiredKeywords', 'anchorLabels'].forEach(key => {
      if (Array.isArray(initial[key])) {
        initial[key] = initial[key].join(', ');
      }
    });

    // Handle slider range
    if (type === 'sliderField' && Array.isArray(initial.value) && initial.value.length >= 2) {
      initial.valueFrom = initial.value[0];
      initial.valueTo = initial.value[1];
      delete initial.value;
    }

    // Convert string numbers to actual numbers
    const numericKeys = ['min', 'max', 'step', 'scale', 'value', 'valueFrom', 'valueTo'];
    numericKeys.forEach(key => {
      if (initial[key] !== undefined && initial[key] !== null && initial[key] !== '') {
        const num = Number(initial[key]);
        if (!isNaN(num)) {
          initial[key] = num;
        }
      }
    });

    // Handle date fields
    if (type === 'dateField' || type === 'dateTimeField') {
      ['min', 'max', 'value'].forEach(key => {
        if (initial[key]) {
          const date = dayjs(initial[key]);
          initial[key] = date.isValid() ? date : undefined;
        }
      });
    }

    // Ensure booleans
    const booleanKeys = [
      'allowOther', 'optionCommentsAllowed', 'required', 'rangeMode',
      'showTicks', 'allowHalf', 'notInFuture', 'notInPast', 'collapsible',
      'collapsed', 'gated', 'mapEnabled', 'approvalRequired'
    ];
    booleanKeys.forEach(key => {
      if (initial[key] !== undefined) {
        initial[key] = !!initial[key];
      }
    });
  } catch (error) {
    console.error('Error normalizing form values:', error);
    message.error('Failed to load field configuration');
  }

  return initial;
};

export const normalizeNodeAttributes = (values: any, type: string): Record<string, any> => {
  const cleaned: Record<string, any> = { ...values };

  try {
    // Handle options string to array
    if (cleaned.options && typeof cleaned.options === 'string') {
      cleaned.options = cleaned.options
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    // Handle required keywords
    if (cleaned.requiredKeywords && typeof cleaned.requiredKeywords === 'string') {
      cleaned.requiredKeywords = cleaned.requiredKeywords
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    // Handle anchor labels
    if (cleaned.anchorLabels && typeof cleaned.anchorLabels === 'string') {
      cleaned.anchorLabels = cleaned.anchorLabels
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    // Convert numbers
    const toNumber = (v: any) => {
      if (v === '' || v === null || v === undefined) return undefined;
      const num = Number(v);
      return isNaN(num) ? v : num;
    };

    ['min', 'max', 'step', 'scale', 'value'].forEach(key => {
      if (cleaned[key] !== undefined) {
        cleaned[key] = toNumber(cleaned[key]);
      }
    });

    // Handle slider range mode
    if (cleaned.rangeMode && type === 'sliderField') {
      const from = toNumber(cleaned.valueFrom);
      const to = toNumber(cleaned.valueTo);
      if (from !== undefined && to !== undefined) {
        cleaned.value = from <= to ? [from, to] : [to, from];
      }
      delete cleaned.valueFrom;
      delete cleaned.valueTo;
    } else if (type === 'sliderField' && cleaned.value !== undefined) {
      cleaned.value = toNumber(cleaned.value);
    }

    // Handle marks
    if (cleaned.marks && typeof cleaned.marks === 'string') {
      try {
        cleaned.marks = JSON.parse(cleaned.marks);
      } catch {
        const marks: Record<number, string> = {};
        cleaned.marks.trim().split(',').forEach((pair: string) => {
          const [k, ...rest] = pair.split(':');
          if (k) {
            const label = rest.join(':').trim();
            const key = Number(k.trim());
            if (!isNaN(key)) {
              marks[key] = label || String(key);
            }
          }
        });
        cleaned.marks = marks;
      }
    }

    // Handle date fields
    if (type === 'dateField' || type === 'dateTimeField') {
      ['min', 'max', 'value'].forEach(key => {
        if (cleaned[key] && cleaned[key].toISOString) {
          cleaned[key] = cleaned[key].toISOString();
        } else if (!cleaned[key]) {
          cleaned[key] = null;
        }
      });
    }

    // Clean empty strings for certain fields
    if (cleaned.regex === '') cleaned.regex = null;
    if (cleaned.mask === '') cleaned.mask = null;

    // Validate expressions
    if (type === 'computedField' && cleaned.expression) {
      try {
        new Parser().parse(cleaned.expression);
      } catch (error) {
        message.error(`Invalid expression: ${(error as Error).message}`);
        throw error;
      }
    }

    // Validate URLs
    if (type === 'lookupField' && cleaned.lookupEndpoint) {
      try {
        new URL(cleaned.lookupEndpoint, window.location.origin);
      } catch {
        message.error('Invalid lookup endpoint URL');
        throw new Error('Invalid URL');
      }
    }
  } catch (error) {
    console.error('Error normalizing node attributes:', error);
    throw error;
  }

  return cleaned;
};