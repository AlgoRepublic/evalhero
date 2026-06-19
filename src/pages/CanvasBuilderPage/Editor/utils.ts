/* eslint-disable @typescript-eslint/no-explicit-any */
import { Editor, mergeAttributes, Node, NodeViewProps, RawCommands } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Parser } from 'expr-eval';
import { v4 as uuidv4 } from 'uuid';

// List of custom node types
const CUSTOM_NODE_TYPES = new Set([
  'shortText',
  'longText',
  'richText',
  'numberField',
  'dateField',
  'dateTimeField',
  'singleChoice',
  'multipleChoice',
  'ratingField',
  'sliderField',
  'addressField',
  'lookupField',
  'fileField',
  'signatureField',
  'computedField',
  'ranking',
  'repeater_item',
]);

// Helper: check if we're inside a custom node
export const isInsideCustomNode = (editor: Editor): boolean => {
  if (!editor || !editor.state) return false;
  const { selection } = editor.state;
  let depth = selection.$anchor.depth;
  while (depth > 0) {
    const node = selection.$anchor.node(depth);
    if (node && CUSTOM_NODE_TYPES.has(node.type.name)) {
      return true;
    }
    depth--;
  }
  return false;
};

// Allowed functions for conditions
const SAFE_FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  inArray: (...args: unknown[]) => {
    const [v, arr] = args;
    return Array.isArray(arr) && (arr as any).includes(v);
  },
  contains: (...args: unknown[]) => {
    const [str, substr] = args;
    return String(str ?? '').includes(String(substr ?? ''));
  },
  exists: (...args: unknown[]) => {
    const [v] = args;
    return v !== undefined && v !== null && v !== '';
  },
  sum: (...args: unknown[]) => args.reduce((a: number, b: unknown) => a + Number((b as any) || 0), 0),
};

export function evaluateCondition(expr: string, vars: Record<string, any>) {
  if (!expr || String(expr).trim() === '') return true;
  try {
    const parser = new Parser({
      operators: { logical: true, comparison: true, add: true, subtract: true, multiply: true, divide: true, power: true }
    });
    const parsed = parser.parse(expr);
    // merge vars and helpers and cast to any to satisfy expr-eval's Value typing for functions
    const scope = { ...vars, ...SAFE_FUNCTIONS } as unknown as any;
    return Boolean(parsed.evaluate(scope));
  } catch (err) {
    console.warn('Condition parse error', err);
    return false;
  }
}

export function setEditorEditingHandler(editor: any, setEditingNodeFn: (payload: any) => void) {
  if (!editor) return;
  // store on editor so NodeViews can call via getSetEditingNodeFromEditor
  (editor as any).__setEditingNode = setEditingNodeFn;
}

// export function getSetEditingNodeFromEditor(editor: any) {
//   if (!editor) return null;
//   return (editor as any).__setEditingNode ?? null;
// }

// Walk editor JSON to build a map { fieldId: value }
export function collectFieldValues(editor: any) {
  if (!editor || !editor.getJSON) return {};
  const json = editor.getJSON();
  const map: Record<string, any> = {};
  const walk = (node: any) => {
    if (!node) return;
    if (node.attrs && node.attrs.fieldId) {
      const fid = String(node.attrs.fieldId);
      map[fid] = node.attrs.value ?? node.attrs.default ?? null;
    }
    if (node.content && Array.isArray(node.content)) node.content.forEach(walk);
  };
  (json.content || []).forEach(walk);
  return map;
}



export function getSetEditingNodeFromEditor(editor?: Editor | null) {
  // return (editor as Editor)?.options?.onSelectionUpdate;
  return (editor as any)?.options?.onSetEditingNode;
}

export type FormNodeOptions = {
  setEditingNode?: (payload: {
    attrs: Record<string, unknown>;
    type: string;
    updateAttributes: (attrs: Record<string, unknown>) => void;
    deleteNode: () => void;
  }) => void;
};

export const wrapperStyle: React.CSSProperties = {
  borderRadius: 6,
  padding: 10,
  marginBottom: 8,
  position: 'relative',
  //   background: '#fff',
  //   border: '1px solid #e8e8e8',
};


export function createFormNode(config: {
  name: string;
  defaultAttrs: Record<string, unknown>;
  Component: React.FC<NodeViewProps>;
  commandName: string;
}) {
  return Node.create<FormNodeOptions>({
    name: config.name,
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
      // Always include id attribute for UniqueID extension
      const attrs: Record<string, any> = {
        id: { default: null }, // Unique ID managed by UniqueID extension
      };
      
      // Add all default attributes from config
      Object.entries(config.defaultAttrs).forEach(([key, value]) => {
        attrs[key] = { default: value };
      });
      
      return attrs;
    },

    parseHTML() {
      return [{ tag: `div[data-type='${config.name}']` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, { 'data-type': config.name }),
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(config.Component);
    },

    addCommands() {
      return {
        [config.commandName]:
          (attrs?: Record<string, unknown>) =>
          ({ commands }: { commands: RawCommands }) =>
            commands.insertContent({
              type: this.name,
              attrs: { ...config.defaultAttrs, ...attrs },
            }),
      } as Partial<RawCommands>;
    },
  });
}


// Generate UUID v4 for IDs
export const genId = () => uuidv4();


// helper: trim transparent edges from an image dataURL and return a new dataURL
export async function trimDataURL(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0);

      // read pixel data
      const imgData = ctx.getImageData(0, 0, w, h).data;
      let top = h, left = w, right = 0, bottom = 0;
      let found = false;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const alpha = imgData[idx + 3];
          if (alpha > 0) { // non-transparent pixel
            found = true;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }

      if (!found) {
        // nothing drawn; return original
        return resolve(dataUrl);
      }

      const trimW = right - left + 1;
      const trimH = bottom - top + 1;
      const out = document.createElement('canvas');
      out.width = trimW;
      out.height = trimH;
      const outCtx = out.getContext('2d')!;
      outCtx.drawImage(canvas, left, top, trimW, trimH, 0, 0, trimW, trimH);
      try {
        const outData = out.toDataURL('image/png');
        resolve(outData);
      } catch (e) {
        // fallback to original if toDataURL fails
        resolve(dataUrl);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}



// src/utils/hiddenFields.ts
// Helper utilities to manage HiddenField nodes inside a Tiptap editor instance.
/**
 * findHiddenNodes(editor) -> returns array of { pos, node, attrs }
 * - pos is the resolved position of the node in the doc (start position)
 */
export function findHiddenNodes(editor: Editor) {
  const nodes: { pos: number; node: any }[] = [];
  const doc = editor.state.doc;
  doc.descendants((node, pos) => {
    if (node.type.name === 'hiddenField') {
      nodes.push({ pos, node });
    }
    return true;
  });
  return nodes;
}

/**
 * getHiddenFields(editor) -> { [key]: value } (reads all hiddenField nodes)
 */
export function getHiddenFields(editor: Editor): Record<string, any> {
  const found = findHiddenNodes(editor);
  const out: Record<string, any> = {};
  found.forEach(({ node }) => {
    const k = node.attrs?.key;
    if (k) out[k] = node.attrs.value;
  });
  return out;
}

/**
 * setHiddenField(editor, key, value, options)
 * - If a hidden node with the same key exists, it updates its attrs; else inserts a new hiddenField at the end of the doc.
 * - options: { label?, exportOnly?: boolean, immutable?: boolean }
 */
export function setHiddenField(editor: Editor, key: string, value: any, options: { label?: string; exportOnly?: boolean; immutable?: boolean } = {}) {
  if (!editor || !key) return false;
  const nodes = findHiddenNodes(editor);
  const existing = nodes.find((n) => n.node.attrs?.key === key);

  const attrs = {
    key,
    value,
    label: options.label ?? key,
    exportOnly: options.exportOnly !== undefined ? !!options.exportOnly : true,
    immutable: options.immutable !== undefined ? !!options.immutable : true,
  };

  if (existing) {
    // update the node at position existing.pos
    const tr = editor.state.tr.setNodeMarkup(existing.pos, undefined, { ...existing.node.attrs, ...attrs });
    editor.view.dispatch(tr);
    return true;
  }

  // Insert invisible node at the end of the document (after last child)
  const tr = editor.state.tr;
  const nodeType = editor.schema.nodes['hiddenField'];
  if (!nodeType) return false;
  const node = nodeType.create(attrs);
  tr.insert(editor.state.doc.content.size, node);
  editor.view.dispatch(tr);
  return true;
}

/**
 * removeHiddenField(editor, key)
 * - Remove hiddenField nodes with that key
 */
export function removeHiddenField(editor: Editor, key: string) {
  if (!editor || !key) return false;
  const nodes = findHiddenNodes(editor);
  const tr = editor.state.tr;
  let removed = false;
  // iterate in reverse order to keep positions valid
  nodes.slice().reverse().forEach(({ pos, node }) => {
    if (node.attrs?.key === key) {
      tr.delete(pos, pos + node.nodeSize);
      removed = true;
    }
  });
  if (removed) {
    editor.view.dispatch(tr);
  }
  return removed;
}

/**
 * ensureHiddenFields(editor, metadata)
 * - Ensure all fields in metadata (object) exist in the doc and match provided values.
 * - This is idempotent and good to call at editor init to populate required fields.
 */
export function ensureHiddenFields(editor: Editor, metadata: Record<string, any>) {
  if (!editor) return;
  const existing = getHiddenFields(editor);
  Object.keys(metadata).forEach((k) => {
    const v = metadata[k];
    if (existing[k] === undefined || existing[k] !== v) {
      setHiddenField(editor, k, v, { label: k, exportOnly: true, immutable: true });
    }
  });
}


export function buildSubmissionPayload(editor: Editor) {
  const doc = editor.getJSON();
  const hidden = getHiddenFields(editor); // { orgId: '...', evaluatorId: '...' }
  // Build responses from doc (your existing logic)
  const responses = doc; // or process to a schema you want
  return {
    metadata: hidden,
    doc: responses,
    submittedAt: new Date().toISOString(),
  };
}

export const evaluateVisibility = (rules: any[] = [], formState: any, matchType: 'all' | 'any' = 'all'): boolean => {
  if (!rules.length) return true;

  const match = (rule: any): boolean => {
    // Support both flat formState (fieldName -> value) and nested formState.attrs (used by node views)
    const currentValue = formState?.attrs?.[rule.field] ?? formState?.[rule.field];
    const ruleValue = rule.value;
    const isEmpty = ruleValue === null || ruleValue === undefined || ruleValue === '';
    
    switch (rule.condition || rule.operator) {
      case 'is':
        if (isEmpty) return currentValue === null || currentValue === undefined || currentValue === '';
        return currentValue === ruleValue;
      case 'is_not':
        if (isEmpty) return currentValue !== null && currentValue !== undefined && currentValue !== '';
        return currentValue !== ruleValue;
      case 'contains':
        if (isEmpty) return false;
        return String(currentValue || '').includes(String(ruleValue));
      case 'does_not_contain':
        if (isEmpty) return true;
        return !String(currentValue || '').includes(String(ruleValue));
      case 'starts_with':
        if (isEmpty) return false;
        return String(currentValue || '').startsWith(String(ruleValue));
      case 'ends_with':
        if (isEmpty) return false;
        return String(currentValue || '').endsWith(String(ruleValue));
      case 'matches':
      case 'regex':
        if (isEmpty) return false;
        try {
          return new RegExp(String(ruleValue)).test(String(currentValue || ''));
        } catch {
          return false;
        }
      default:
        return false;
    }
  };

  const results = rules.map(match);
  if (matchType === 'any') return results.some(Boolean);
  return results.every(Boolean);
};

/**
 * Get query parameter value from URL
 * @param paramName - The query parameter name
 * @returns The query parameter value or null
 */
export function getQueryParam(paramName: string): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(paramName);
}

/**
 * Get all query parameters as an object
 * @returns Object with query parameter keys and values
 */
export function getAllQueryParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Extract label text from node content (paragraph/heading)
 * Works with ProseMirror nodes (from NodeViewProps)
 * @param node - The ProseMirror node to extract label from
 * @param _editor - Optional editor instance (kept for future use)
 * @returns The extracted label text or undefined
 */
export function extractNodeLabel(node: any): string | undefined {
  if (!node) {
    return undefined;
  }

  // For ProseMirror nodes, get text from the first child
  // The label is typically in the first paragraph/heading child
  try {
    // Check if node has content (ProseMirror Fragment)
    if (node.content && typeof node.content.size === 'number' && node.content.size > 0) {
      const firstChild = node.content.firstChild;
      if (firstChild) {
        // Get text content from the first child
        const text = firstChild.textContent?.trim();
        if (text) {
          return text;
        }
        // If first child doesn't have direct text, check its content
        if (firstChild.content && typeof firstChild.content.size === 'number' && firstChild.content.size > 0) {
          const nestedFirst = firstChild.content.firstChild;
          if (nestedFirst && nestedFirst.textContent) {
            const nestedText = nestedFirst.textContent.trim();
            if (nestedText) {
              return nestedText;
            }
          }
        }
      }
    }
    
    // Fallback: use node.textContent and take first line
    if (node.textContent) {
      const text = node.textContent.trim();
      if (text) {
        // Take first line or first 100 chars
        const firstLine = text.split('\n')[0].trim();
        return firstLine || text.substring(0, 100).trim();
      }
    }
  } catch (error) {
    // If accessing ProseMirror structure fails, try textContent fallback
    if (node.textContent) {
      const text = node.textContent.trim();
      if (text) {
        return text.split('\n')[0].trim() || undefined;
      }
    }
  }

  return undefined;
}

/**
 * Ensure all nodes in the JSON content have IDs preserved
 * This function recursively walks through the JSON and ensures IDs are maintained
 * @param content - The JSONContent to process
 * @returns The JSONContent with IDs preserved
 */
export function ensureNodeIds(content: any): any {
  if (!content) return content;
  
  // If it's an array, process each item
  if (Array.isArray(content)) {
    return content.map(item => ensureNodeIds(item));
  }
  
  // If it's an object, process it
  if (typeof content === 'object' && content !== null) {
    const result: any = { ...content };
    
    // Recursively process content array if it exists
    if (Array.isArray(result.content)) {
      result.content = result.content.map((item: any) => ensureNodeIds(item));
    }
    
    // Preserve existing ID if present
    // The UniqueID extension will handle generating IDs for nodes without them
    // but we want to preserve existing IDs
    if (result.attrs && result.attrs.id) {
      // ID already exists, preserve it
      return result;
    }
    
    return result;
  }
  
  return content;
}

/**
 * Parse schema attributes - converts string booleans/numbers to proper types
 * This is needed because FormData converts everything to strings
 * @param node - The node to parse
 * @returns The parsed node with correct data types
 */
export function parseSchemaAttributes(node: any): any {
  if (!node || typeof node !== 'object') return node;
  
  const parsed: any = { ...node };
  
  // List of boolean attributes across all node types (built-in and custom)
  const booleanAttributes = [
    // Common attributes
    'required',
    'approvalRequired',
    // ShortText/LongText attributes
    'namePrefix',
    'nameSuffix',
    'namePrefixRequired',
    'nameSuffixRequired',
    'middleName',
    'middleNameRequired',
    // Grouping attributes
    'enableGrouping',
    // RichText attributes
    'enableRichText',
    // Choice field attributes
    'allowOther',
    'optionCommentsAllowed',
    'isCorrect', // Used in singleChoiceOption and multipleChoiceOption nodes
    'randomize', // Used in singleChoice and multipleChoice nodes
    'enablePassFail', // Used in singleChoice and multipleChoice nodes
    'enablePoints', // Used in singleChoice and multipleChoice nodes
    'failCritical', // Used in singleChoice and multipleChoice nodes
    'enableCalculation', // Used in singleChoice and multipleChoice nodes
    // Slider/Rating attributes
    'showTicks',
    'rangeMode',
    'allowHalf',
    // Date/DateTime attributes
    'notInFuture',
    'notInPast',
    // Section/Repeater attributes
    'collapsible',
    'collapsed',
    'gated',
    'repeatable',
    // Address/Map attributes
    'mapEnabled',
  ];
  
  // List of numeric attributes
  const numericAttributes = [
    'min',
    'max',
    'step',
    'scale',
    'minLength',
    'maxLength',
    'approvalMinCount',
    'value',
    'valueFrom',
    'valueTo',
    'maxSizeBytes',
    'pageSize',
    'minChars',
    'precision',
    'rounding',
  ];
  
  // Parse attributes if they exist
  if (parsed.attrs && typeof parsed.attrs === 'object') {
    const attrs = parsed.attrs as Record<string, any>;
    const parsedAttrs: Record<string, any> = {};
    
    // Process all attributes
    Object.keys(attrs).forEach((key) => {
      const value = attrs[key];
      
      // Parse boolean attributes
      if (booleanAttributes.includes(key)) {
        if (value === 'true' || value === true) {
          parsedAttrs[key] = true;
        } else if (value === 'false' || value === false || value === null || value === undefined) {
          parsedAttrs[key] = false;
        } else {
          parsedAttrs[key] = value; // Keep as-is if not a boolean string
        }
      }
      // Parse numeric attributes
      else if (numericAttributes.includes(key)) {
        if (value === '' || value === null || value === undefined) {
          parsedAttrs[key] = null;
        } else if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
          parsedAttrs[key] = Number(value);
        } else {
          parsedAttrs[key] = value; // Keep as-is if not a numeric string
        }
      }
      // Special handling for nested objects like optionPoints and optionLimits
      else if (key === 'optionPoints' && value && typeof value === 'object' && !Array.isArray(value)) {
        // Deep parse optionPoints: convert nested points (string to number) and isCorrect (string to boolean)
        const parsedOptionPoints: Record<string, any> = {};
        Object.keys(value).forEach((optKey) => {
          const optValue = (value as Record<string, any>)[optKey];
          if (optValue && typeof optValue === 'object' && !Array.isArray(optValue)) {
            parsedOptionPoints[optKey] = {
              // Parse points: string to number
              points: typeof optValue.points === 'number' 
                ? optValue.points 
                : (optValue.points !== undefined && optValue.points !== null && optValue.points !== ''
                    ? (typeof optValue.points === 'string' && !isNaN(Number(optValue.points)) && optValue.points.trim() !== ''
                        ? Number(optValue.points)
                        : optValue.points)
                    : 0),
              // Parse isCorrect: string to boolean
              isCorrect: typeof optValue.isCorrect === 'boolean'
                ? optValue.isCorrect
                : (optValue.isCorrect === 'true' || optValue.isCorrect === true
                    ? true
                    : (optValue.isCorrect === 'false' || optValue.isCorrect === false || optValue.isCorrect === null || optValue.isCorrect === undefined
                        ? false
                        : optValue.isCorrect)),
            };
          } else {
            parsedOptionPoints[optKey] = optValue;
          }
        });
        parsedAttrs[key] = parsedOptionPoints;
      }
      // Special handling for optionLimits: ensure values are numbers
      else if (key === 'optionLimits' && value && typeof value === 'object' && !Array.isArray(value)) {
        const parsedOptionLimits: Record<string, number> = {};
        Object.keys(value).forEach((optKey) => {
          const limitValue = (value as Record<string, any>)[optKey];
          if (limitValue === '' || limitValue === null || limitValue === undefined) {
            parsedOptionLimits[optKey] = 0;
          } else if (typeof limitValue === 'string' && !isNaN(Number(limitValue)) && limitValue.trim() !== '') {
            parsedOptionLimits[optKey] = Number(limitValue);
          } else if (typeof limitValue === 'number') {
            parsedOptionLimits[optKey] = limitValue;
          } else {
            parsedOptionLimits[optKey] = limitValue; // Keep as-is if not parseable
          }
        });
        parsedAttrs[key] = parsedOptionLimits;
      }
      // Keep other attributes as-is
      else {
        parsedAttrs[key] = value;
      }
    });
    
    parsed.attrs = parsedAttrs;
  }
  
  // Recursively parse child nodes
  if (Array.isArray(parsed.content)) {
    parsed.content = parsed.content.map((child: any) => parseSchemaAttributes(child));
  }
  
  return parsed;
}

/**
 * Parse the entire schema document - converts string booleans/numbers to proper types
 * This should be called when loading schemas from API (which uses FormData)
 * @param doc - The document schema to parse
 * @returns The parsed document with correct data types
 */
export function parseSchemaDocument(doc: any): any {
  if (!doc) return doc;
  
  // Parse the root document
  const parsed: any = { ...doc };
  
  // Parse all content nodes recursively
  if (Array.isArray(parsed.content)) {
    parsed.content = parsed.content.map((node: any) => parseSchemaAttributes(node));
  }
  
  return parsed;
}
