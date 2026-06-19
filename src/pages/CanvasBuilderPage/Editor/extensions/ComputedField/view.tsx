import React, { useEffect, useRef, useState } from 'react';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  Card,
  Typography,
  Tooltip,
  Space,
  Button,
  theme,
  Flex,
} from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Parser } from 'expr-eval';
import type { Value } from 'expr-eval';
import ComputedEditModal from './editModel';

const { Text } = Typography;

/* Helper functions (same as earlier safe implementation) */

function collectFieldValuesFromDoc(
  editor: { getJSON?: () => unknown } | null | undefined
): Record<string, unknown> {
  const json = editor?.getJSON ? editor.getJSON() : null;
  if (!json) return {};
  const map: Record<string, unknown> = {};

  type DocNode = {
    attrs?: {
      fieldId?: string | number;
      value?: unknown;
      content?: unknown;
      contentHtml?: unknown;
    };
    content?: DocNode[] | null;
  };

  const walk = (node: DocNode | null | undefined) => {
    if (!node) return;
    if (node.attrs && node.attrs.fieldId) {
      const fid = String(node.attrs.fieldId);
      let val =
        node.attrs.value ??
        node.attrs.content ??
        node.attrs.contentHtml ??
        null;
      if (typeof val === 'string') {
        const n = Number(val);
        if (!Number.isNaN(n)) val = n;
      }
      map[fid] = val;
    }
    if (node.content && Array.isArray(node.content)) node.content.forEach(walk);
  };
  const root = json as { content?: DocNode[] | null } | null;
  if (root && Array.isArray(root.content)) root.content.forEach(walk);
  return map;
}

function createParserWithHelpers() {
  const parser = new Parser({
    operators: {
      add: true,
      subtract: true,
      multiply: true,
      divide: true,
      power: true,
      factorial: false,
      logical: false,
      comparison: true,
      concatenate: false,
    },
  });
  return parser;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // cover NaN
  if (
    typeof a === 'number' &&
    typeof b === 'number' &&
    Number.isNaN(a) &&
    Number.isNaN(b)
  )
    return true;
  return false;
}

/* Node view component with Edit/Delete + Modal to update attrs */
const ComputedComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  const {
    label,
    // expression = '',
    precision = null,
    visible = true,
    prefix = '',
    suffix = '',
    numberFormat = 'none',
    rounding = null,
  } = node.attrs;
  const [computed, setComputed] = useState<unknown>(node.attrs.value ?? null);
  const [error, setError] = useState<string | null>(node.attrs.error ?? null);
  
  // Format computed value with prefix/suffix and number formatting
  const formatComputedValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—';
    
    let formatted = String(val);
    
    // Apply number formatting if it's a number
    if (typeof val === 'number' && !Number.isNaN(val)) {
      const num = val;
      
      // Apply rounding if set
      if (rounding !== null && rounding !== undefined) {
        const r = Number(rounding);
        if (!Number.isNaN(r)) {
          formatted = num.toFixed(r);
        }
      }
      
      // Apply separators
      if (numberFormat !== 'none') {
        const parts = formatted.split('.');
        const integerPart = parts[0];
        const decimalPart = parts[1];
        
        let formattedInteger = integerPart;
        if (numberFormat === 'comma') {
          formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        } else if (numberFormat === 'dot') {
          formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        } else if (numberFormat === 'space') {
          formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        }
        
        formatted = decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
      }
    }
    
    return `${prefix}${formatted}${suffix}`;
  };

  // modal/form state
  const [showModal, setShowModal] = useState(false);
  // const [form] = Form.useForm();

  // refs to avoid loops
  const lastComputedRef = useRef<unknown>(node.attrs.value ?? null);
  const lastErrorRef = useRef<string | null>(node.attrs.error ?? null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // sync local UI state if attrs changed externally
    lastComputedRef.current = node.attrs.value ?? null;
    lastErrorRef.current = node.attrs.error ?? null;
    setComputed(node.attrs.value ?? null);
    setError(node.attrs.error ?? null);
  }, [node.attrs.value, node.attrs.error]);

  useEffect(() => {
    if (!editor) return;

    const computeOnce = () => {
      try {
        const values = collectFieldValuesFromDoc(editor);
        const exprText = node.attrs.expression ?? '';
        if (!exprText || String(exprText).trim() === '') {
          if (
              !isEqual(lastComputedRef.current, null) ||
              lastErrorRef.current !== null
            ) {
              lastComputedRef.current = null;
              lastErrorRef.current = null;
              setComputed(null);
              setError(null);
              try {
                updateAttributes({ value: null, error: null });
              } catch (e) {
                /* ignore */
              }
            }
            return;
        }

        const parser = createParserWithHelpers();
        const parsed = parser.parse(exprText);

        // type Numeric = string | number | boolean | null | undefined;
        // cast functions to a broad any-compatible signature to match expr-eval's runtime Value function shape
        const functions: Record<string, (...args: unknown[]) => unknown> = {
          sum: (...args: unknown[]) =>
            args.reduce<number>((acc, v) => acc + Number(v ?? 0), 0),
          avg: (...args: unknown[]) =>
            args.length
              ? args.reduce<number>((acc, v) => acc + Number(v ?? 0), 0) /
                args.length
              : 0,
          round: (v: unknown, p: unknown = 0) => {
            const n = Number(v ?? 0);
            const factor = Math.pow(10, Number(p ?? 0));
            return Math.round(n * factor) / factor;
          },
          min: (...args: unknown[]) =>
            Math.min(...args.map((x) => Number(x ?? 0))),
          max: (...args: unknown[]) =>
            Math.max(...args.map((x) => Number(x ?? 0))),
        };
        const ctx = { ...values, ...functions } as Record<string, unknown>;
        // evaluate accepts a runtime scope; cast to the library Value type to satisfy TypeScript
        const raw = parsed.evaluate(ctx as unknown as Value);
        let out = raw;
        // Use rounding if set, otherwise use precision
        const prec = rounding !== null && rounding !== undefined ? rounding : precision;
        if (prec !== null && prec !== undefined) {
          const p = Number(prec);
          if (!Number.isNaN(p))
            out =
              Math.round((Number(raw) || 0) * Math.pow(10, p)) /
              Math.pow(10, p);
        }

        if (
          !isEqual(lastComputedRef.current, out) ||
          lastErrorRef.current !== null
        ) {
          lastComputedRef.current = out;
          lastErrorRef.current = null;
          setComputed(out);
          setError(null);
          try {
            updateAttributes({ value: out, error: null });
          } catch (e) {
            /* ignore */
          }
        }
      } catch (err: unknown) {
        const msg =
          typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string'
            ? String((err as { message: unknown }).message)
            : 'Computation error';
        if (
          lastErrorRef.current !== msg ||
          !isEqual(lastComputedRef.current, null)
        ) {
          lastComputedRef.current = null;
          lastErrorRef.current = msg;
          setComputed(null);
          setError(msg);
          try {
            updateAttributes({ value: null, error: msg });
          } catch (e) {
            /* ignore */
          }
        }
      }
    };

    const schedule = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => computeOnce(), 120) as ReturnType<
        typeof setTimeout
      >;
    };

    // initial compute
    schedule();

    const onUpdate = () => schedule();
    editor.on && editor.on('update', onUpdate);

    return () => {
      editor.off && editor.off('update', onUpdate);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, node.attrs.expression, node.attrs.precision]);

  /* Modal handlers */
  // const openEditModal = () => {
  //   form.setFieldsValue({
  //     label: node.attrs.label ?? 'Computed',
  //     expression: node.attrs.expression ?? '',
  //     precision: node.attrs.precision ?? null,
  //     visible: node.attrs.visible ?? true,
  //   });
  //   setShowModal(true);
  // };

  //   const handleSave = async () => {
  //     try {
  //       const values = await form.validateFields();
  //       // validate expression syntax
  //       if (values.expression && String(values.expression).trim().length > 0) {
  //         try {
  //           const parser = new Parser();
  //           parser.parse(values.expression);
  //         } catch (err: any) {
  //           message.error(
  //             'Invalid expression: ' +
  //               (err && err.message ? err.message : 'parse error')
  //           );
  //           return;
  //         }
  //       }

  //       // Atomic attrs update
  //       const attrsPatch: any = {
  //         label: values.label,
  //         expression: values.expression,
  //         precision: values.precision === '' ? null : values.precision,
  //         visible: !!values.visible,
  //       };

  //       updateAttributes(attrsPatch);
  //       setShowModal(false);
  //       message.success('Computed field updated');
  //     } catch (err) {
  //       console.warn('Save validation failed', err);
  //       // AntD handles showing field errors
  //     }
  //   };

  // const confirmDelete = () => {
  //   try {
  //     deleteNode && deleteNode();
  //   } catch (e) {
  //     console.error('Delete failed', e);
  //   }
  // };

  if (!visible)
    return <NodeViewWrapper style={{ display: 'none' }} />;

  return (
    <NodeViewWrapper style={{ width: '100%', margin: '8px 0' }}>
      <ComputedEditModal
        open={showModal}
        onClose={() => setShowModal(false)}
        nodeAttrs={node.attrs}
        onSave={(values) => {
          updateAttributes(values);
          setShowModal(false);
        }}
      />
      <Card
        size="small"
        style={{
          margin: '8px 0',
          borderColor: error ? token.colorError : token.colorBorder,
          borderRadius: token.borderRadiusLG,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <Flex justify="space-between" style={{ marginLeft: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>
              {label ?? 'Computed'}
            </div>
            <div style={{ marginTop: 6 }}>
              {error ? (
                <Tooltip title={error}>
                  <Text type="danger">—</Text>
                </Tooltip>
              ) : (
                <Text strong>
                  {formatComputedValue(computed)}
                </Text>
              )}
            </div>
          </div>
          <Space size={4} style={{ alignSelf: 'flex-start', marginLeft: 8 }}>
            <Tooltip title="Edit field settings">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => setShowModal(true)}
              />
            </Tooltip>
            <Tooltip title="Delete field">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={deleteNode}
              />
            </Tooltip>
          </Space>
        </Flex>
      </Card>
    </NodeViewWrapper>
  );
};

export default ComputedComponent;
