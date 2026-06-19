import React, { useState } from 'react';
import {
  Card,
  Select,
  InputNumber,
  Button,
  Space,
  Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  SpecialNodeRules,
  ConditionRef,
  ConditionTree,
  ConditionOperator,
} from '../../../types/course';

const { Text } = Typography;

interface ProgressionLogicEditorProps {
  value?: SpecialNodeRules[];
  onChange?: (rules: SpecialNodeRules[]) => void;
}

const ProgressionLogicEditor: React.FC<ProgressionLogicEditorProps> = ({
  value = [],
  onChange,
}) => {
  const [rules, setRules] = useState<SpecialNodeRules[]>(value);

  const updateRules = (newRules: SpecialNodeRules[]) => {
    setRules(newRules);
    onChange?.(newRules);
  };

  const addRule = () => {
    const newRule: SpecialNodeRules = {
      type: 'AdvanceGate',
      conditions: {
        operator: 'AND',
        conditions: [],
      },
      outcome: 'unlockNext',
    };
    updateRules([...rules, newRule]);
  };

  const removeRule = (index: number) => {
    updateRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, rule: SpecialNodeRules) => {
    const newRules = [...rules];
    newRules[index] = rule;
    updateRules(newRules);
  };

  const renderConditionEditor = (
    condition: ConditionRef | ConditionTree,
    onChange: (cond: ConditionRef | ConditionTree) => void
  ) => {
    if ('operator' in condition) {
      // It's a ConditionTree
      return (
        <Card size="small" style={{ marginTop: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              value={condition.operator}
              onChange={(op) =>
                onChange({ ...condition, operator: op as ConditionOperator })
              }
              style={{ width: 100 }}
            >
              <Select.Option value="AND">AND</Select.Option>
              <Select.Option value="OR">OR</Select.Option>
            </Select>
            {condition.conditions.map((cond, idx) => (
              <div key={idx}>
                {renderConditionEditor(cond, (newCond) => {
                  const newConditions = [...condition.conditions];
                  newConditions[idx] = newCond;
                  onChange({ ...condition, conditions: newConditions });
                })}
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    const newConditions = condition.conditions.filter(
                      (_, i) => i !== idx
                    );
                    onChange({ ...condition, conditions: newConditions });
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                const newCond: ConditionRef = {
                  type: 'moduleCompleted',
                  moduleId: '',
                };
                onChange({
                  ...condition,
                  conditions: [...condition.conditions, newCond],
                });
              }}
            >
              Add Condition
            </Button>
          </Space>
        </Card>
      );
    } else {
      // It's a ConditionRef
      return (
        <Card size="small" style={{ marginTop: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              value={condition.type}
              onChange={(type) => {
                const base: any = { type };
                if (type === 'moduleCompleted') {
                  base.moduleId = '';
                } else if (type === 'inlineFormPassed') {
                  base.formId = '';
                  base.minScore = undefined;
                } else if (type === 'approvalGranted') {
                  base.byRole = [];
                  base.byUser = [];
                } else if (type === 'timeSpent') {
                  base.moduleId = '';
                  base.minutes = 0;
                } else if (type === 'dateWindow') {
                  base.start = undefined;
                  base.end = undefined;
                }
                onChange(base);
              }}
              style={{ width: '100%' }}
            >
              <Select.Option value="moduleCompleted">
                Module Completed
              </Select.Option>
              <Select.Option value="inlineFormPassed">
                Inline Form Passed
              </Select.Option>
              <Select.Option value="approvalGranted">
                Approval Granted
              </Select.Option>
              <Select.Option value="timeSpent">Time Spent</Select.Option>
              <Select.Option value="dateWindow">Date Window</Select.Option>
            </Select>

            {condition.type === 'moduleCompleted' && (
              <InputNumber
                placeholder="Module ID"
                value={(condition as any).moduleId}
                onChange={(val) =>
                  onChange({ ...condition, moduleId: val as string })
                }
                style={{ width: '100%' }}
              />
            )}

            {condition.type === 'inlineFormPassed' && (
              <>
                <InputNumber
                  placeholder="Form ID"
                  value={(condition as any).formId}
                  onChange={(val) =>
                    onChange({ ...condition, formId: val as string })
                  }
                  style={{ width: '100%' }}
                />
                <InputNumber
                  placeholder="Min Score (optional)"
                  value={(condition as any).minScore}
                  onChange={(val) =>
                    onChange({ ...condition, minScore: val as number })
                  }
                  style={{ width: '100%' }}
                />
              </>
            )}

            {condition.type === 'timeSpent' && (
              <>
                <InputNumber
                  placeholder="Module ID"
                  value={(condition as any).moduleId}
                  onChange={(val) =>
                    onChange({ ...condition, moduleId: val as string })
                  }
                  style={{ width: '100%' }}
                />
                <InputNumber
                  placeholder="Minutes"
                  value={(condition as any).minutes}
                  onChange={(val) =>
                    onChange({ ...condition, minutes: val as number })
                  }
                  style={{ width: '100%' }}
                />
              </>
            )}
          </Space>
        </Card>
      );
    }
  };

  return (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text strong>Progression Rules</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={addRule}>
            Add Rule
          </Button>
        </div>

        {rules.map((rule, index) => (
          <Card key={index} size="small" style={{ marginTop: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Select
                  value={rule.type}
                  onChange={(type) =>
                    updateRule(index, { ...rule, type: type as any })
                  }
                  style={{ width: 150 }}
                >
                  <Select.Option value="AdvanceGate">Advance Gate</Select.Option>
                  <Select.Option value="ModuleCompleteGate">
                    Module Complete Gate
                  </Select.Option>
                </Select>
                <Select
                  value={rule.outcome}
                  onChange={(outcome) =>
                    updateRule(index, { ...rule, outcome: outcome as any })
                  }
                  style={{ width: 150 }}
                >
                  <Select.Option value="unlockNext">Unlock Next</Select.Option>
                  <Select.Option value="markComplete">
                    Mark Complete
                  </Select.Option>
                  <Select.Option value="requireRetake">
                    Require Retake
                  </Select.Option>
                </Select>
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeRule(index)}
                >
                  Remove
                </Button>
              </Space>

              <Text type="secondary">Conditions:</Text>
              {renderConditionEditor(rule.conditions, (newCond) =>
                updateRule(index, { ...rule, conditions: newCond })
              )}
            </Space>
          </Card>
        ))}
      </Space>
    </Card>
  );
};

export default ProgressionLogicEditor;
