/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  Select,
  Button,
  Space,
  Spin,
  Empty,
  Typography,
  Flex,
  Card,
  Tooltip,
  theme,
} from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
// import { getSetEditingNodeFromEditor } from '../../utils';
import LookupEditModal from './editModel';

const { Option } = Select;
const { Text } = Typography;

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

const safeParseItems = (json: any) => {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  return [];
};

const LookupComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  const [error] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // const setEditingNode = getSetEditingNodeFromEditor(editor);
  const initial = node.attrs || {};

  // const [modalVisible, setModalVisible] = useState(false);
  const [localAttrs, setLocalAttrs] = useState({
    label: initial.label ?? 'Lookup',
    lookupEndpoint: initial.lookupEndpoint ?? '',
    selectedFetchParam: initial.selectedFetchParam ?? 'id', // optional
    minChars: initial.minChars ?? 2,
    pageSize: initial.pageSize ?? 20,
    mode: initial.mode ?? 'single',
    placeholder: initial.placeholder ?? 'Search…',
    labelField: initial.labelField ?? null,
    metaField: initial.metaField ?? null,
  });

  useEffect(() => {
    setLocalAttrs({
      label: node.attrs.label ?? 'Lookup',
      lookupEndpoint: node.attrs.lookupEndpoint ?? '',
      selectedFetchParam: node.attrs.selectedFetchParam ?? 'id',
      minChars: node.attrs.minChars ?? 2,
      pageSize: node.attrs.pageSize ?? 20,
      mode: node.attrs.mode ?? 'single',
      placeholder: node.attrs.placeholder ?? 'Search…',
      labelField: node.attrs.labelField ?? null,
      metaField: node.attrs.metaField ?? null,
    });
  }, [node.attrs]);

  // options shown in dropdown
  const [options, setOptions] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const cacheRef = useRef<Record<string, any[]>>({});

  // resolve initial selection display: if node.attrs.value is id(s) or object(s)
  useEffect(() => {
    const val = node.attrs.value;
    // if value already object(s) containing label, ensure options include them so they display
    if (!val) return;
    const ensure = async () => {
      if (Array.isArray(val)) {
        const missing = val.filter((v: any) => !(v && v.id && v.label));
        if (
          missing.length &&
          localAttrs.lookupEndpoint &&
          localAttrs.selectedFetchParam
        ) {
          await fetchByIds(missing.map((m) => m.id));
        } else {
          // ensure options include these objects
          setOptions((prev) => {
            const next = [...prev];
            val.forEach((v: any) => {
              if (v && v.id && !next.find((x) => x.id === v.id)) next.push(v);
            });
            return next;
          });
        }
      } else if (
        val &&
        val.id &&
        !val.label &&
        localAttrs.lookupEndpoint &&
        localAttrs.selectedFetchParam
      ) {
        await fetchByIds([val.id]);
      } else if (val && val.id && val.label) {
        setOptions((prev) =>
          prev.find((x) => x.id === val.id) ? prev : [...prev, val]
        );
      }
    };
    ensure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    node.attrs.value,
    localAttrs.lookupEndpoint,
    localAttrs.selectedFetchParam,
  ]);

  // fetch helper for search
  const fetchOptions = async (q: string) => {
    if (!localAttrs.lookupEndpoint || q.length < Number(localAttrs.minChars)) {
      setOptions([]);
      return;
    }
    if (cacheRef.current[q]) {
      setOptions(cacheRef.current[q]);
      return;
    }
    setFetching(true);
    try {
      const url = new URL(localAttrs.lookupEndpoint, window.location.origin);
      url.searchParams.set('q', q);
      url.searchParams.set('limit', String(localAttrs.pageSize));
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        setOptions([]);
        return;
      }
      const json = await res.json();
      const items = safeParseItems(json).map((i: any) => ({
        id: i.id,
        label: i[localAttrs.labelField || 'label'] ?? i.label ?? String(i.id),
        meta: i[localAttrs.metaField || 'meta'] ?? i.meta ?? null,
        raw: i,
      }));
      cacheRef.current[q] = items;
      setOptions(items);
    } catch (err) {
      console.error('Lookup fetch error', err);
      setOptions([]);
    } finally {
      setFetching(false);
    }
  };

  const debouncedFetch = useMemo(
    () => debounce((q: string) => fetchOptions(q), 300),
    [localAttrs.lookupEndpoint, localAttrs.minChars, localAttrs.pageSize]
  );

  // fetch by ids to resolve labels (server must support ?id= or ?ids=)
  const fetchByIds = async (ids: string[]) => {
    if (!localAttrs.lookupEndpoint || !ids?.length) return;
    setFetching(true);
    try {
      // try ids param (comma separated) first
      const url = new URL(localAttrs.lookupEndpoint, window.location.origin);
      // server should support ids=1,2,3 or id=single
      url.searchParams.set('ids', ids.join(','));
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        setFetching(false);
        return;
      }
      const json = await res.json();
      const items = safeParseItems(json).map((i: any) => ({
        id: i.id,
        label: i[localAttrs.labelField || 'label'] ?? i.label ?? String(i.id),
        meta: i[localAttrs.metaField || 'meta'] ?? i.meta ?? null,
        raw: i,
      }));
      // include in options
      setOptions((prev) => {
        const next = [...prev];
        items.forEach((it: { id: any }) => {
          if (!next.find((x) => x.id === it.id)) next.push(it);
        });
        return next;
      });
    } catch (err) {
      console.error('lookup fetchByIds error', err);
    } finally {
      setFetching(false);
    }
  };

  // on change by user (selection)
  const onSelectChange = (val: string | string[] | undefined) => {
    if (localAttrs.mode === 'multiple') {
      const arr = Array.isArray(val) ? val : [];
      const sel = (arr as string[]).map((id: string) => {
        return options.find((o) => o.id === id) || { id, label: id };
      });
      updateAttributes({ ...node.attrs, value: sel });
    } else {
      const v = Array.isArray(val) ? val[0] : val;
      const str = v as string;
      const sel = options.find((o) => o.id === str) || { id: str, label: str };
      updateAttributes({ ...node.attrs, value: sel });
    }
  };

  // derive selected ids for Select.value prop
  type SelectedItem = { id: string };
  const selected = node.attrs.value as
    | SelectedItem
    | SelectedItem[]
    | undefined;
  const selectedIds =
    localAttrs.mode === 'multiple'
      ? Array.isArray(selected)
        ? selected.map((s: SelectedItem) => s.id)
        : []
      : selected
        ? (selected as SelectedItem).id
        : undefined;

  // prepare visible options for the dropdown: present options; show spinner when fetching
  const renderOptions = () => {
    if (fetching)
      return (
        <Option key="__loading" value="__loading" disabled>
          <Spin size="small" /> Searching…
        </Option>
      );
    if (!options.length) return null;
    return options.map((o) => (
      <Option key={o.id} value={o.id}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 260,
            }}
          >
            <Text ellipsis>{o.label}</Text>
          </div>
          <div style={{ color: '#888', marginLeft: 12 }}>{o.meta}</div>
        </div>
      </Option>
    ));
  };

  // Save config modal -> commit all attrs once (atomic)
  // const onSaveConfig = () => {
  //   // basic validation for endpoint: allow relative URLs
  //   if (localAttrs.lookupEndpoint) {
  //     try {
  //       new URL(localAttrs.lookupEndpoint, window.location.origin);
  //     } catch {
  //       // show modal error (basic)
  //       // You can integrate AntD message; keeping it inline
  //       // For simplicity, just refuse save
  //       // (replace with message.error('Invalid URL') if you imported message)
  //       return;
  //     }
  //   }
  //   const merged = {
  //     ...node.attrs,
  //     label: localAttrs.label,
  //     lookupEndpoint: localAttrs.lookupEndpoint,
  //     selectedFetchParam: localAttrs.selectedFetchParam,
  //     minChars: Number(localAttrs.minChars || 2),
  //     pageSize: Number(localAttrs.pageSize || 20),
  //     mode: localAttrs.mode,
  //     placeholder: localAttrs.placeholder,
  //     labelField: localAttrs.labelField,
  //     metaField: localAttrs.metaField,
  //   };
  //   updateAttributes(merged);
  //   setModalVisible(false);
  // };

  const mode = (editor as any)?.storage?.formBuilder?.mode ?? 'readonly';
  const submitted = (editor as any)?.storage?.formBuilder?.submitted === true;

  return (
    <NodeViewWrapper {...(mode === 'edit' ? { 'data-drag-handle': true } : {})} style={{ margin: '8px 0' }}>
      <LookupEditModal
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
          borderColor:
            (error || (mode === 'submit' && submitted && (node.attrs as any)?.required && !(node.attrs as any)?.value))
              ? token.colorError
              : token.colorBorder,
          borderRadius: token.borderRadiusLG,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <Flex justify="space-between" style={{ marginLeft: 8 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            <div contentEditable={mode === 'submit' ? false : undefined}>
              <NodeViewContent className="lookup-label" />
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

        <div style={{ marginTop: 8 }}>
          <Select
            showSearch
            placeholder={localAttrs.placeholder}
            style={{ width: '100%' }}
            mode={
              localAttrs.mode === 'multiple' ? ('multiple' as const) : undefined
            }
            onSearch={(q) => {
              if (!q || q.length < Number(localAttrs.minChars)) {
                setOptions([]);
                return;
              }
              debouncedFetch(q);
            }}
            onChange={onSelectChange}
            filterOption={false}
            notFoundContent={
              fetching ? (
                'Searching…'
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No results"
                />
              )
            }
            value={selectedIds}
            optionLabelProp="children"
          >
            {renderOptions()}
          </Select>
        </div>
      </Card>

      {/* <Modal
        title="Configure lookup"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={onSaveConfig}
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="Label">
            <Input
              value={localAttrs.label}
              onChange={(e) =>
                setLocalAttrs((s) => ({ ...s, label: e.target.value }))
              }
            />
          </Form.Item>

          <Form.Item label="Lookup endpoint (GET)">
            <Input
              value={localAttrs.lookupEndpoint}
              onChange={(e) =>
                setLocalAttrs((s) => ({ ...s, lookupEndpoint: e.target.value }))
              }
              placeholder="/api/search"
            />
            <Text
              type="secondary"
              style={{ display: 'block', marginTop: 6, fontSize: 12 }}
            >
              Server should accept q & limit (e.g.
              /api/search?q=smith&limit=20). To resolve specific IDs you can
              support ids=1,2 or id=... queries.
            </Text>
          </Form.Item>

          <Form.Item label="Selected fetch param (optional)">
            <Input
              value={localAttrs.selectedFetchParam ?? ''}
              onChange={(e) =>
                setLocalAttrs((s) => ({
                  ...s,
                  selectedFetchParam: e.target.value,
                }))
              }
              placeholder="e.g. ids or id"
            />
            <Text
              type="secondary"
              style={{ display: 'block', marginTop: 6, fontSize: 12 }}
            >
              Optional: param name to use when resolving selected item(s) by id
              (server must support it). Default: 'id'.
            </Text>
          </Form.Item>

          <Form.Item label="Mode">
            <Select
              value={localAttrs.mode}
              onChange={(v) => setLocalAttrs((s) => ({ ...s, mode: v }))}
            >
              <Option value="single">Single</Option>
              <Option value="multiple">Multiple</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Min chars">
            <InputNumber
              min={1}
              value={localAttrs.minChars}
              onChange={(v: any) =>
                setLocalAttrs((s) => ({ ...s, minChars: Number(v) }))
              }
            />
          </Form.Item>

          <Form.Item label="Page size">
            <InputNumber
              min={1}
              value={localAttrs.pageSize}
              onChange={(v: any) =>
                setLocalAttrs((s) => ({ ...s, pageSize: Number(v) }))
              }
            />
          </Form.Item>

          <Form.Item label="Placeholder">
            <Input
              value={localAttrs.placeholder}
              onChange={(e) =>
                setLocalAttrs((s) => ({ ...s, placeholder: e.target.value }))
              }
            />
          </Form.Item>

          <Form.Item label="Label field (optional)">
            <Input
              value={localAttrs.labelField ?? ''}
              onChange={(e) =>
                setLocalAttrs((s) => ({ ...s, labelField: e.target.value }))
              }
              placeholder="e.g. full_name"
            />
          </Form.Item>

          <Form.Item label="Meta field (optional)">
            <Input
              value={localAttrs.metaField ?? ''}
              onChange={(e) =>
                setLocalAttrs((s) => ({ ...s, metaField: e.target.value }))
              }
              placeholder="e.g. unit or email"
            />
          </Form.Item>
        </Form>
      </Modal> */}
    </NodeViewWrapper>
  );
};

export default LookupComponent;
