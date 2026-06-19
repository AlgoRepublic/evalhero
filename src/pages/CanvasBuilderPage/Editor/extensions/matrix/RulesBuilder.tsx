import { Button, Select, Space, Card, Typography, theme } from 'antd';
import { PlusOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';

const { Option } = Select;
const { Text } = Typography;

/**
 * Matrix rules are for Critical Fail management only.
 * Each rule: When [row] + [column] selection is Fail (wrong answer) → that row is marked Critical Fail.
 * Pass/Fail is derived from column options (Correct/Pass); no value selection needed.
 */
function RulesBuilder({
  columns = [],
  rows = [],
  value = [],
  onChange,
}: any) {
  const { token } = theme.useToken();

  const updateRule = (idx: number, patch: any) => {
    const next = (value || []).map((r: any, i: number) =>
      i === idx ? { ...r, ...patch } : r
    );
    onChange(next);
  };

  const remove = (idx: number) =>
    onChange((value || []).filter((_: any, i: number) => i !== idx));

  // Only choice/multiple columns with Pass/Fail scoring enabled can be used in critical fail rules.
  const passFailColumns = columns.filter(
    (c: any) => (c.type === 'choice' || c.type === 'multiple') && c.enablePassFail
  );

  const addRule = () => {
    const id = uuidv4();
    onChange([
      ...(value || []),
      {
        id,
        when: { rowId: '', colId: passFailColumns[0]?.id || '' },
        then: { action: 'critical_fail' },
      },
    ]);
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={addRule}
          disabled={passFailColumns.length === 0}
        >
          Add Critical Fail Rule
        </Button>
        <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
          When the selected answer is wrong (Fail) for the chosen row and column, that row is marked Critical Fail. Pass/Fail comes from option settings.
        </Text>
      </div>
      {passFailColumns.length === 0 && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          Enable Pass/Fail scoring on a single or multiple choice column to add critical fail rules.
        </Text>
      )}
      {(value || []).map((r: any, idx: number) => (
        <Card
          key={r.id || idx}
          size="small"
          style={{ marginBottom: 8, borderColor: token.colorErrorBorder }}
          extra={
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => remove(idx)}
            />
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text strong>When</Text>
              <Select
                value={r.when?.rowId ?? ''}
                onChange={(v) => updateRule(idx, { when: { ...r.when, rowId: v || '' } })}
                style={{ width: 220 }}
                placeholder="Any row"
                allowClear
              >
                <Option value="">Any row</Option>
                {(rows || []).map((row: any) => (
                  <Option key={row.id} value={row.id}>
                    {row.label || row.id}
                  </Option>
                ))}
              </Select>
              <Text type="secondary">+</Text>
              <Select
                value={r.when?.colId}
                onChange={(v) => updateRule(idx, { when: { ...r.when, colId: v } })}
                style={{ width: 200 }}
                placeholder="Select column (Pass/Fail enabled)"
              >
                {passFailColumns.map((c: any) => (
                  <Option key={c.id} value={c.id}>
                    {c.label} ({c.type})
                  </Option>
                ))}
              </Select>
              <Text type="secondary">is Fail</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <WarningOutlined style={{ color: token.colorError }} />
              <Text type="danger">→ Row marked Critical Fail (template fails)</Text>
            </div>
          </Space>
        </Card>
      ))}
      {(!value || value.length === 0) && (
        <div style={{ padding: 16, textAlign: 'center', color: token.colorTextTertiary, border: `1px dashed ${token.colorBorder}`, borderRadius: 4 }}>
          No Critical Fail rules. Click &quot;Add Critical Fail Rule&quot; to define when a row should fail the template.
        </div>
      )}
    </div>
  );
}

export default RulesBuilder;
