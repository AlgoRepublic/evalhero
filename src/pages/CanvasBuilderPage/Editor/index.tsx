/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import DragHandle from '@tiptap/extension-drag-handle-react';
import { Form, theme } from 'antd';
import { useEffect, useState } from 'react';
import 'prosemirror-view/style/prosemirror.css';
import { extensions } from './extensions';
import { MenuBar } from './MenuBar';
import './tittap.css';
// import EditModal from './components/Modal';
import dayjs from 'dayjs';
// import { genId } from './utils';
// import { Parser } from 'expr-eval';
import './index.css';
// import EditorToolbar from './EditorToolbar';
export type EditingNodePayload = {
  editor: Editor;
  attrs: Record<string, unknown>;
  type: string;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteNode: () => void;
};

const TiptapEditor = () => {
  const [editingNode, setEditingNode] = useState<EditingNodePayload | null>(
    null
  );
  const [form] = Form.useForm();
  const { token } = theme.useToken();

  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        spellcheck: 'false',
        class: 'form-editor',
      },
    },
    content: '',
    onCreate: ({ editor }) => {
      // attach a callback on the editor options that NodeViews can read
      (editor as any).options = {
        ...(editor as any).options,
        onSetEditingNode: (payload: EditingNodePayload) => {
          console.log('payload', payload);
          setEditingNode(payload);
        },
      };
    },
    // editorProps: { attributes: { class: 'form-editor', spellCheck: 'false' } },
  });

  editor.on('create', () => {
    console.log('create');

    // Prefer to get orgId/evaluatorId from a server-authenticated API
    // const metadata = {
    //   orgId: 'org_123', // fill from server or current user session
    //   evaluatorId: 'user_456',
    //   formVersion: 'v1.2.3',
    //   deviceInfo: navigator.userAgent, // optional; be mindful of PII
    //   appVersion: '1.0.0',
    // };
    // ensureHiddenFields(editor, metadata);
  });

  editor.on('update', () => {
    console.log('update');

    // const desired = {
    //   // orgId: serverOrgId,
    //   // evaluatorId: serverEvaluatorId,
    //   formVersion: 'v1.2.3',
    // };
    // ensureHiddenFields(editor, desired);
  });

  useEffect(() => {
    if (editingNode) {
      // shallow copy of attrs to avoid mutating node.attrs
      const initial: Record<string, any> = { ...(editingNode.attrs || {}) };

      // --- Options: support string[] OR {id,label}[] -> comma separated labels
      if (initial.options !== undefined) {
        if (Array.isArray(initial.options)) {
          if (
            initial.options.length > 0 &&
            typeof initial.options[0] === 'object' &&
            'label' in initial.options[0]
          ) {
            initial.options = initial.options
              .map((o: any) => String(o.label ?? o.id ?? ''))
              .join(', ');
          } else {
            initial.options = initial.options
              .map((o: any) => String(o))
              .join(', ');
          }
        } else if (typeof initial.options === 'string') {
          // leave as-is (already comma-separated)
        } else {
          initial.options = '';
        }
      }

      // --- Marks: object -> JSON string
      if (initial.marks && typeof initial.marks === 'object') {
        try {
          initial.marks = JSON.stringify(initial.marks);
        } catch {
          initial.marks = String(initial.marks);
        }
      }

      // --- Required keywords and anchorLabels -> comma separated strings
      if (initial.requiredKeywords && Array.isArray(initial.requiredKeywords)) {
        initial.requiredKeywords = initial.requiredKeywords.join(', ');
      }
      if (initial.anchorLabels && Array.isArray(initial.anchorLabels)) {
        initial.anchorLabels = initial.anchorLabels.join(', ');
      }

      // --- Slider: if value is an array -> set valueFrom / valueTo for the form
      if (editingNode.type === 'sliderField') {
        const v = initial.value;
        if (Array.isArray(v) && v.length >= 2) {
          initial.valueFrom = v[0];
          initial.valueTo = v[1];
          // remove original value so the form shows valueFrom/valueTo controls
          delete initial.value;
        } else {
          // leave single value as initial.value (if present)
        }
      }

      // --- Numeric conversions: min/max/step/scale/value -> numbers (if present)
      const numericKeys = ['min', 'max', 'step', 'scale', 'value'];
      numericKeys.forEach((k) => {
        if (
          initial[k] !== undefined &&
          initial[k] !== null &&
          initial[k] !== ''
        ) {
          // If it's already a number, keep; if string, convert to Number; if boolean/other keep as-is
          const n = Number(initial[k]);
          if (!Number.isNaN(n)) {
            initial[k] = n;
          }
        }
      });

      // --- Dates: convert ISO strings to dayjs objects for DatePicker fields
      if (
        editingNode.type === 'dateField' ||
        editingNode.type === 'dateTimeField'
      ) {
        ['min', 'max', 'value'].forEach((k) => {
          const val = initial[k];
          if (val) {
            // try to parse via dayjs; if invalid keep undefined
            const d = dayjs(val);
            initial[k] = d.isValid() ? d : undefined;
          } else {
            initial[k] = undefined;
          }
        });
      }

      // const type = editingNode.type;
      // const attrs = editingNode.attrs ?? {};
      // if (type === 'section') {
      //   form.setFieldsValue({
      //     label: attrs.label,
      //     showIf: attrs.showIf,
      //     collapsible: attrs.collapsible,
      //     collapsed: attrs.collapsed,
      //     gated: attrs.gated,
      //   });
      // } else if (type === 'repeater') {
      //   form.setFieldsValue({
      //     label: attrs.label,
      //     min: attrs.min,
      //     max: attrs.max,
      //   });
      // } else if (type === 'staticContent') {
      //   form.setFieldsValue({
      //     type: attrs.type,
      //     icon: attrs.icon,
      //     title: attrs.title,
      //     body: attrs.body,
      //   });
      // }

      // --- Booleans: AntD checkboxes expect booleans; keep as-is or cast
      // (most attrs such as allowOther, optionCommentsAllowed, required, showTicks, rangeMode, allowHalf)
      // ensure undefined -> false for checkboxes if you want
      const booleanKeys = [
        'allowOther',
        'optionCommentsAllowed',
        'required',
        'rangeMode',
        'showTicks',
        'allowHalf',
        'notInFuture',
        'notInPast',
        'approvalRequired',
      ];
      booleanKeys.forEach((k) => {
        if (initial[k] === undefined) {
          // leave undefined (form will not set), or you can force false:
          // initial[k] = false;
        } else {
          initial[k] = !!initial[k];
        }
      });

      // Finally set the form values
      form.setFieldsValue(initial);
    } else {
      form.resetFields();
    }
  }, [editingNode, form]);

  // const saveNode = useCallback(async () => {
  //   if (!editingNode) return;

  //   try {
  //     const values = await form.validateFields();

  //     // Normalize options: comma separated -> array of strings
  //     if (values.options && typeof values.options === 'string') {
  //       values.options = values.options
  //         .split(',')
  //         .map((s: string) => s.trim())
  //         .filter(Boolean);
  //     }

  //     // Ensure options exists as empty array if originally present but cleared
  //     if (editingNode.attrs?.options !== undefined && !values.options) {
  //       values.options = [];
  //     }

  //     // Normalize requiredKeywords: comma separated -> array
  //     if (
  //       values.requiredKeywords &&
  //       typeof values.requiredKeywords === 'string'
  //     ) {
  //       values.requiredKeywords = values.requiredKeywords
  //         .split(',')
  //         .map((s: string) => s.trim())
  //         .filter(Boolean);
  //     } else if (!values.requiredKeywords) {
  //       values.requiredKeywords = [];
  //     }
  //     // ensure mode default
  //     if (values.requiredKeywordsMode !== 'any')
  //       values.requiredKeywordsMode = 'all';

  //     // Normalize numeric fields (NumberNode, SliderNode, RatingNode)
  //     const toNumber = (v: any) =>
  //       v === '' || v === undefined || v === null ? undefined : Number(v);

  //     if (values.min !== undefined) values.min = toNumber(values.min);
  //     if (values.max !== undefined) values.max = toNumber(values.max);
  //     if (values.step !== undefined) values.step = toNumber(values.step);
  //     if (values.scale !== undefined) values.scale = toNumber(values.scale);
  //     if (values.value !== undefined && values.value !== '')
  //       values.value = toNumber(values.value);

  //     // For slider range defaults: if rangeMode, normalize valueFrom/valueTo into value: [from,to]
  //     if (values.rangeMode) {
  //       const from = toNumber(values.valueFrom);
  //       const to = toNumber(values.valueTo);
  //       if (from !== undefined && to !== undefined) {
  //         // enforce ordering: from <= to
  //         values.value = from <= to ? [from, to] : [to, from];
  //       } else {
  //         // if missing, do not set value (leave undefined)
  //         values.value = undefined;
  //       }
  //       // remove temporary fields so we don't write them into attrs
  //       delete values.valueFrom;
  //       delete values.valueTo;
  //     } else {
  //       // ensure single numeric default for slider if provided as string/number
  //       if (values.value === undefined || values.value === '') {
  //         // leave as undefined
  //       } else {
  //         values.value = toNumber(values.value);
  //       }
  //     }

  //     // Parse marks for slider: try JSON, else parse "k:label,k:label" format
  //     if (values.marks && typeof values.marks === 'string') {
  //       let marksParsed: Record<number | string, string> | undefined;
  //       const raw = values.marks.trim();
  //       try {
  //         // try JSON
  //         marksParsed = JSON.parse(raw);
  //       } catch {
  //         // parse comma separated k:label entries
  //         marksParsed = {};
  //         raw.split(',').forEach((pair: { split: (arg0: string) => [any, ...any[]]; }) => {
  //           const [k, ...rest] = pair.split(':');
  //           if (!k) return;
  //           const label = rest.join(':').trim();
  //           const key = k.trim();
  //           if (key) marksParsed[Number(key)] = label || key;
  //         });
  //       }
  //       values.marks = marksParsed;
  //     }

  //     // anchorLabels -> array
  //     if (values.anchorLabels && typeof values.anchorLabels === 'string') {
  //       values.anchorLabels = values.anchorLabels
  //         .split(',')
  //         .map((s: string) => s.trim())
  //         .filter(Boolean);
  //     }

  //     // options/order relations for ranking: ensure order length matches options length
  //     if (editingNode.type === 'ranking') {
  //       if (values.options && Array.isArray(values.options)) {
  //         // if order not provided or length mismatches, reset to options order
  //         if (
  //           !editingNode.attrs?.order ||
  //           (Array.isArray(editingNode.attrs.order) &&
  //             editingNode.attrs.order.length !== values.options.length)
  //         ) {
  //           values.order = values.options.slice();
  //         } else {
  //           // keep existing order attr unless user edited an order field
  //           // (we don't expose order via modal by default)
  //         }
  //       }
  //     }

  //     // Normalize boolean switches: AntD already returns booleans for checkboxes

  //     // Regex/mask empty -> null
  //     if (values.regex === '') values.regex = null;
  //     if (values.mask === '') values.mask = null;

  //     // handle min/max for date/dateTime (AntD DatePicker returns dayjs object)
  //     if (
  //       values.min &&
  //       typeof values.min === 'object' &&
  //       values.min.toISOString
  //     ) {
  //       values.min = values.min.toISOString();
  //     } else if (!values.min) {
  //       values.min = null;
  //     }

  //     if (
  //       values.max &&
  //       typeof values.max === 'object' &&
  //       values.max.toISOString
  //     ) {
  //       values.max = values.max.toISOString();
  //     } else if (!values.max) {
  //       values.max = null;
  //     }

  //     // For single value default in date/dateTime (if you expose it)
  //     if (
  //       values.value &&
  //       typeof values.value === 'object' &&
  //       values.value.toISOString
  //     ) {
  //       values.value = values.value.toISOString();
  //     }

  //     // Ensure booleans are booleans (AntD already provides)
  //     values.notInFuture = !!values.notInFuture;
  //     values.notInPast = !!values.notInPast;

  //     // timeFormat validation
  //     if (values.timeFormat !== '12' && values.timeFormat !== '24') {
  //       values.timeFormat = '24';
  //     }

  //     // inside saveNode when editingNode.type === 'matrixField'
  //     if (editingNode.type === 'matrixField') {
  //       if (values.columnsJson) {
  //         let cols;
  //         try {
  //           cols = JSON.parse(values.columnsJson);
  //           if (!Array.isArray(cols)) throw new Error();
  //         } catch {
  //           message.error('Invalid columns JSON');
  //           return;
  //         }
  //         // normalize columns
  //         const normalizedCols = cols.map((c: any, i: number) => {
  //           const id = c.id || genId();
  //           const label = c.label || `Col ${i + 1}`;
  //           const type = c.type || 'text';
  //           const options =
  //             c.options && typeof c.options === 'string'
  //               ? c.options
  //                   .split(',')
  //                   .map((s: string) => s.trim())
  //                   .filter(Boolean)
  //               : c.options;
  //           return {
  //             id,
  //             label,
  //             type,
  //             options,
  //             maxSelections: c.maxSelections,
  //             computedExpr: c.computedExpr,
  //           };
  //         });
  //         values.columns = normalizedCols;
  //         delete values.columnsJson;
  //       }

  //       if (values.rowsJson) {
  //         let rowsRaw;
  //         try {
  //           rowsRaw = JSON.parse(values.rowsJson);
  //           if (!Array.isArray(rowsRaw)) throw new Error();
  //         } catch {
  //           // try newline separated
  //           rowsRaw = values.rowsJson
  //             .split('\n')
  //             .map((l: string) => l.trim())
  //             .filter(Boolean)
  //             .map((label: string) => ({ id: genId(), label }));
  //         }
  //         const normalizedRows = rowsRaw.map((r: any, i: number) => ({
  //           id: r.id || genId(),
  //           label: r.label || String(r) || `Row ${i + 1}`,
  //         }));
  //         values.rows = normalizedRows;
  //         delete values.rowsJson;
  //       }

  //       // cells initial optional
  //       if (values.cellsJson) {
  //         try {
  //           const parsed = JSON.parse(values.cellsJson);
  //           values.cells = parsed;
  //         } catch {
  //           message.error('Invalid cells JSON');
  //           return;
  //         }
  //         delete values.cellsJson;
  //       }

  //       // initialize cells object if not present
  //       if (!values.cells) values.cells = editingNode.attrs.cells || {};
  //       // ensure each row has a map
  //       (values.rows || []).forEach((r: any) => {
  //         if (!values.cells[r.id])
  //           values.cells[r.id] =
  //             (editingNode.attrs.cells && editingNode?.attrs?.cells?.[r.id]) ||
  //             {};
  //       });
  //     }

  //     if (editingNode.type === 'fileField') {
  //       // File normalization
  //       if (values.allowedTypes && typeof values.allowedTypes === 'string') {
  //         values.allowedTypes = values.allowedTypes
  //           .split(',')
  //           .map((s: string) => s.trim())
  //           .filter(Boolean);
  //       }
  //       if (values.maxSizeMB !== undefined) {
  //         values.maxSizeBytes = Number(values.maxSizeMB) * 1024 * 1024;
  //         delete values.maxSizeMB;
  //       }
  //     }

  //     if (editingNode.type === 'signatureField') {
  //       // Signature normalization
  //       if (values.mode !== 'type' && values.mode !== 'draw')
  //         values.mode = 'draw';
  //     }

  //     if (editingNode.type === 'computedField') {
  //       if (values.expression) {
  //         try {
  //           const parser = new Parser();
  //           parser.parse(values.expression);
  //         } catch (err) {
  //           message.error('Invalid expression: ' + err?.message);
  //           return; // abort saving
  //         }
  //       }
  //     }

  //     if (editingNode.type === 'lookupField') {
  //       const lookupEndpoint =
  //         values.lookupEndpoint ?? editingNode.attrs.lookupEndpoint ?? '';
  //       // validate URL
  //       if (lookupEndpoint) {
  //         try {
  //           new URL(lookupEndpoint, window.location.origin);
  //         } catch {
  //           message.error('Invalid lookup endpoint URL');
  //           return;
  //         }
  //       }
  //       const selectedFetchParam =
  //         values.selectedFetchParam ??
  //         editingNode.attrs.selectedFetchParam ??
  //         'id';
  //       const mode = values.mode ?? editingNode.attrs.mode ?? 'single';
  //       const minChars = Number(
  //         values.minChars ?? editingNode.attrs.minChars ?? 2
  //       );
  //       const pageSize = Number(
  //         values.pageSize ?? editingNode.attrs.pageSize ?? 20
  //       );
  //       const placeholder =
  //         values.placeholder ?? editingNode.attrs.placeholder ?? 'Search…';
  //       const labelField =
  //         values.labelField ?? editingNode.attrs.labelField ?? null;
  //       const metaField =
  //         values.metaField ?? editingNode.attrs.metaField ?? null;

  //       const attrsToUpdate = {
  //         lookupEndpoint,
  //         selectedFetchParam,
  //         mode,
  //         minChars,
  //         pageSize,
  //         placeholder,
  //         labelField,
  //         metaField,
  //       };

  //       editingNode.updateAttributes(attrsToUpdate);
  //       setEditingNode(null);
  //       // message.success('Lookup updated');
  //     }

  //     // normalize per type
  //     const t = editingNode.type;
  //     if (t === 'section') {
  //       const patch = {
  //         label: values.label ?? editingNode.attrs.label,
  //         showIf: values.showIf ?? '',
  //         collapsible: !!values.collapsible,
  //         collapsed: !!values.collapsed,
  //         gated: !!values.gated,
  //       };
  //       editingNode.updateAttributes(patch);
  //       setEditingNode(null);
  //       return;
  //     }

  //     if (t === 'repeater') {
  //       const patch: any = {
  //         label: values.label ?? editingNode.attrs.label,
  //         min: Number(values.min || 0),
  //         max: values.max === undefined ? null : Number(values.max),
  //       };
  //       editingNode.updateAttributes(patch);
  //       setEditingNode(null);
  //       return;
  //     }

  //     if (t === 'staticContent') {
  //       const patch: any = {
  //         type: values.type ?? editingNode.attrs.type,
  //         icon: values.icon ?? editingNode.attrs.icon,
  //         title: values.title ?? editingNode.attrs.title,
  //         body: values.body ?? editingNode.attrs.body,
  //       };
  //       editingNode.updateAttributes(patch);
  //       // setEditingNode(null);
  //       // return;
  //     }

  //     // Final clean: remove undefined keys (optional)
  //     const cleaned: Record<string, unknown> = {};
  //     Object.keys(values).forEach((k) => {
  //       const v = (values as any)[k];
  //       if (v !== undefined) cleaned[k] = v;
  //     });

  //     // inside your saveNode after values = await form.validateFields()

  //     if (editingNode.type === 'addressField') {
  //       const cleaned: Record<string, unknown> = {};

  //       if (values.label !== undefined) cleaned.label = values.label;
  //       if (values.mapEnabled !== undefined)
  //         cleaned.mapEnabled = !!values.mapEnabled;

  //       // structured fields (if present)
  //       if (values.street !== undefined) cleaned.street = values.street || '';
  //       if (values.city !== undefined) cleaned.city = values.city || '';
  //       if (values.state !== undefined) cleaned.state = values.state || '';
  //       if (values.postalCode !== undefined)
  //         cleaned.postalCode = values.postalCode || '';
  //       if (values.country !== undefined)
  //         cleaned.country = values.country || '';

  //       // lat/lng: accept empty -> null, else Number
  //       const latRaw =
  //         values.lat !== undefined ? values.lat : editingNode.attrs.lat;
  //       const lngRaw =
  //         values.lng !== undefined ? values.lng : editingNode.attrs.lng;
  //       cleaned.lat =
  //         latRaw === '' || latRaw === null || latRaw === undefined
  //           ? null
  //           : Number(latRaw);
  //       cleaned.lng =
  //         lngRaw === '' || lngRaw === null || lngRaw === undefined
  //           ? null
  //           : Number(lngRaw);

  //       // formatted: if provided use it, else build from parts
  //       if (
  //         values.formatted !== undefined &&
  //         values.formatted !== null &&
  //         values.formatted !== ''
  //       ) {
  //         cleaned.formatted = values.formatted;
  //       } else {
  //         cleaned.formatted = [
  //           cleaned.street,
  //           cleaned.city,
  //           cleaned.state,
  //           cleaned.postalCode,
  //           cleaned.country,
  //         ]
  //           .filter(Boolean)
  //           .join(', ');
  //       }

  //       // editingNode.updateAttributes(cleaned);
  //       // setEditingNode(null);u
  //       // message.success('Address updated');
  //       // return;
  //     }

  //     if (editingNode.type === 'lookupField') {
  //       if (values.lookupEndpoint) {
  //         // basic validation
  //         try {
  //           new URL(values.lookupEndpoint, window.location.origin);
  //           cleaned.lookupEndpoint = values.lookupEndpoint;
  //         } catch {
  //           message.error('Invalid lookup endpoint URL');
  //           return;
  //         }
  //       }
  //       cleaned.mode = values.mode || 'single';
  //       cleaned.minChars = Number(values.minChars) || 2;
  //       cleaned.pageSize = Number(values.pageSize) || 20;
  //       cleaned.placeholder = values.placeholder || 'Search…';
  //     }

  //     // Update node attributes (partial update)
  //     editingNode.updateAttributes(cleaned);

  //     // close modal and feedback
  //     setEditingNode(null);
  //     message.success('Field updated');
  //   } catch (err) {
  //     // validation failed; AntD will show errors
  //   }
  // }, [editingNode, form]);

  if (!editor) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
      }}
    >
      <MenuBar editor={editor} />
      <EditorContent editor={editor} style={{ border: '1px solid grey' }} />
      {/* <EditorToolbar editor={editor} /> */}
      <DragHandle editor={editor}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke={token.colorTextSecondary}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 9h16.5m-16.5 6.75h16.5"
          />
        </svg>
      </DragHandle>
      {/* <EditModal
        editingNode={editingNode}
        setEditingNode={setEditingNode}
        saveNode={saveNode}
        form={form}
      /> */}
    </div>
  );
};

export default TiptapEditor;
