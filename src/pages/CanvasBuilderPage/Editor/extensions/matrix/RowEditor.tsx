/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import Sortable from 'sortablejs';
import { Button, Input, Space, Tooltip, theme } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  MenuOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useMediaQuery } from 'react-responsive';
import { v4 as uuidv4 } from 'uuid';
import TagSelector from '../../components/TagSelector';

const genId = () => uuidv4();

export default function RowEditor({
  value = [],
  onChange,
}: {
  value?: any[];
  onChange: (rows: any[]) => void;
}) {
  const { token } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const [rows, setRows] = useState<any[]>(() =>
    Array.isArray(value) ? value : []
  );
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRows(Array.isArray(value) ? value : []);
  }, [value]);

  useEffect(() => {
    if (!listRef.current) return;
    const sortable = Sortable.create(listRef.current, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: (evt) => {
        const next = Array.from(rows);
        if (evt.oldIndex === undefined || evt.newIndex === undefined) {
          console.log('-onEnd-', evt);
          return;
        }
        const [moved] = next.splice(evt.oldIndex, 1);
        next.splice(evt.newIndex, 0, moved);
        setRows(next);
        onChange(next);
      },
    });
    return () => sortable.destroy();
  }, [rows, onChange]);

  const addRow = (label = 'Row') => {
    const r = { id: genId(), label, tooltip: '', tags: [] };
    const next = [...rows, r];
    setRows(next);
    onChange(next);
  };

  const duplicate = (idx: number) => {
    const copy = { ...rows[idx], id: genId(), tags: Array.isArray(rows[idx].tags) ? [...rows[idx].tags] : [] };
    const next = [...rows.slice(0, idx + 1), copy, ...rows.slice(idx + 1)];
    setRows(next);
    onChange(next);
  };

  const update = (idx: number, patch: any) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setRows(next);
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    onChange(next);
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button icon={<PlusOutlined />} onClick={() => addRow('New row')}>
          Add Row
        </Button>
      </div>

      <div ref={listRef}>
        {rows.map((r, idx) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: isMobile ? 'stretch' : 'flex-start',
              padding: isMobile ? 6 : 8,
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                className="drag-handle"
                style={{ cursor: 'grab', padding: '0 8px', alignSelf: 'center' }}
              >
                <MenuOutlined />
              </span>
              <Input
                value={r.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="Row label"
                style={{ width: isMobile ? '100%' : 200, minWidth: isMobile ? 0 : 200, flex: isMobile ? '1 1 auto' : undefined }}
              />
              <Input
                value={r.tooltip || ''}
                onChange={(e) => update(idx, { tooltip: e.target.value })}
                placeholder="Tooltip (optional)"
                style={{ width: isMobile ? '100%' : 200, minWidth: isMobile ? 0 : 200, flex: isMobile ? '1 1 auto' : undefined }}
              />
              {r.tooltip && (
                <Tooltip title={r.tooltip}>
                  <InfoCircleOutlined style={{ color: token.colorTextTertiary, fontSize: 14, flexShrink: 0 }} />
                </Tooltip>
              )}
            </div>
            <div style={{ minWidth: isMobile ? 0 : 200, flex: isMobile ? '1 1 100%' : '1 1 200px' }}>
              <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>Tags (per question)</div>
              <TagSelector
                value={Array.isArray(r.tags) ? r.tags : []}
                onChange={(tags) => update(idx, { tags: tags || [] })}
                placeholder="Select tags"
              />
            </div>
            <Space style={{ alignSelf: isMobile ? 'flex-end' : 'center' }}>
              <Button icon={<CopyOutlined />} onClick={() => duplicate(idx)} />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => remove(idx)}
              />
            </Space>
          </div>
        ))}
      </div>
    </div>
  );
}
