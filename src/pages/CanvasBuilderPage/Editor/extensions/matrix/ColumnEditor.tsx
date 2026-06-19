/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import Sortable from 'sortablejs';
import { Button, Input, Select, InputNumber, Tooltip, Switch, Collapse, Row, Col, Space, Alert, Checkbox, theme, Typography } from 'antd';
import { DeleteOutlined, MenuOutlined, InfoCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { useMediaQuery } from 'react-responsive';
import { v4 as uuidv4 } from 'uuid';

const { Option } = Select;

type OptionPointEntry = { points?: number; isCorrect?: boolean };

const genId = () => uuidv4();

export default function ColumnEditor({
  value = [],
  onChange,
}: {
  value?: any[];
  onChange: (cols: any[]) => void;
}) {
  const { token } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const colSpan = isMobile ? 24 : 12;
  const colSpanThird = isMobile ? 24 : 8;
  const [cols, setCols] = useState<any[]>(() =>
    Array.isArray(value) ? value : []
  );
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setCols(Array.isArray(value) ? value : []), [value]);

  useEffect(() => {
    if (!listRef.current) return;
    const sortable = Sortable.create(listRef.current, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: (evt) => {
        const next = Array.from(cols);

        if (evt.oldIndex === undefined || evt.newIndex === undefined) {
          console.log('-onEnd-', evt);
          return;
        }

        const [moved] = next.splice(evt.oldIndex, 1);
        next.splice(evt.newIndex, 0, moved);
        setCols(next);
        onChange(next);
      },
    });
    return () => sortable.destroy();
  }, [cols, onChange]);

  const addColumn = (type = 'choice') => {
    const id = genId();
    const defaults: any = {
      id,
      label: 'New column',
      type,
      tooltip: '',
      required: false,
      min: null,
      max: null,
      step: 1,
      computedExpr: '',
      anchorLabels: [],
      scale: 5,
      maxSelections: null,
    };
    
    if (type === 'choice' || type === 'multiple') {
      defaults.options = ['Pass', 'Fail', 'N/A'];
      defaults.optionPoints = {};
      defaults.enablePassFail = false;
      defaults.enablePoints = false;
      defaults.variant = type === 'choice' ? 'radio' : 'checkbox';
      defaults.layout = 'horizontal';
    }
    
    // Set appropriate defaults for rating and anchors
    if (type === 'rating') {
      defaults.scale = 5; // Default to 5 stars
    }
    
    if (type === 'anchors') {
      defaults.scale = 5; // Default to 5 options
      defaults.anchorLabels = []; // Empty by default, user can add labels
    }
    
    setCols((s) => {
      const next = [...s, defaults];
      onChange(next);
      return next;
    });
  };

  const update = (idx: number, patch: any) => {
    setCols((s) => {
      const next = s.map((c, i) => (i === idx ? { ...c, ...patch } : c));
      onChange(next);
      return next;
    });
  };
  const remove = (idx: number) => {
    setCols((s) => {
      const next = s.filter((_, i) => i !== idx);
      onChange(next);
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <Button size="small" onClick={() => addColumn('choice')}>Choice</Button>
        <Button size="small" onClick={() => addColumn('multiple')}>Multiple</Button>
        <Button size="small" onClick={() => addColumn('number')}>Number</Button>
        <Button size="small" onClick={() => addColumn('text')}>Text</Button>
        <Button size="small" onClick={() => addColumn('longText')}>Long Text</Button>
        <Button size="small" onClick={() => addColumn('date')}>Date</Button>
        <Button size="small" onClick={() => addColumn('boolean')}>Boolean</Button>
        <Button size="small" onClick={() => addColumn('rating')}>Rating</Button>
        <Button size="small" onClick={() => addColumn('anchors')}>Anchors</Button>
        <Button size="small" onClick={() => addColumn('file')}>File</Button>
        <Button size="small" onClick={() => addColumn('signature')}>Signature</Button>
        {/* <Button size="small" onClick={() => addColumn('computed')}>Computed</Button> */}
      </div>

      <div ref={listRef}>
        {cols.map((c, idx) => (
          <Collapse
            key={c.id}
            style={{ marginBottom: 8 }}
            items={[
              {
                key: c.id,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <span
                      className="drag-handle"
                      style={{ cursor: 'grab', padding: '0 8px' }}
                    >
                      <MenuOutlined />
                    </span>
                    <span style={{ fontWeight: 500 }}>{c.label || 'Unnamed Column'}</span>
                    <span style={{ color: token.colorTextTertiary, fontSize: 12 }}>({c.type})</span>
                    {c.required && <span style={{ color: token.colorError }}>*</span>}
                    {c.tooltip && (
                      <Tooltip title={c.tooltip}>
                        <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
                      </Tooltip>
                    )}
                    <Button
                      danger
                      type="text"
                      size="middle"
                      icon={<DeleteOutlined />}
                      onClick={() => remove(idx)}
                      style={{ marginLeft: 'auto' }}
                    >
                    </Button>
                  </div>
                ),
                children: (
                  <div style={{ padding: isMobile ? '4px 0' : '8px 0' }}>
                    <Row gutter={[8, 8]}>
                      <Col xs={24} sm={12} span={colSpan}>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Label</div>
                          <Input
                            value={c.label}
                            onChange={(e) => update(idx, { label: e.target.value })}
                            placeholder="Column label"
                          />
                        </div>
                      </Col>
                      <Col xs={24} sm={12} span={colSpan}>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Type</div>
                          <Select
                            value={c.type}
                            onChange={(v) => update(idx, { type: v })}
                            style={{ width: '100%' }}
                          >
                            <Option value="choice">Single Choice</Option>
                            <Option value="multiple">Multiple Choice</Option>
                            <Option value="number">Number</Option>
                            <Option value="text">Short Text</Option>
                            <Option value="longText">Long Text</Option>
                            <Option value="date">Date</Option>
                            <Option value="boolean">Boolean</Option>
                            <Option value="rating">Rating</Option>
                            <Option value="anchors">Anchors</Option>
                            <Option value="file">File Upload</Option>
                            <Option value="signature">Signature</Option>
                            <Option value="computed">Computed</Option>
                          </Select>
                        </div>
                      </Col>
                      <Col span={24}>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Tooltip</div>
                          <Input
                            value={c.tooltip || ''}
                            onChange={(e) => update(idx, { tooltip: e.target.value })}
                            placeholder="Tooltip text (optional)"
                          />
                        </div>
                      </Col>
                      <Col xs={24} sm={12} span={colSpan}>
                        <div style={{ marginBottom: 8 }}>
                          <Switch
                            checked={c.required || false}
                            onChange={(checked) => update(idx, { required: checked })}
                          />
                          <span style={{ marginLeft: 8 }}>Required</span>
                        </div>
                      </Col>

                      {['choice', 'multiple'].includes(c.type) && (
                        <>
                          <Col xs={24} sm={12} span={colSpan}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Variant</div>
                              <Select
                                value={c.variant || (c.type === 'choice' ? 'radio' : 'checkbox')}
                                onChange={(v) => {
                                  const patch: any = { variant: v };
                                  if (v === 'yesno') {
                                    patch.options = ['Yes', 'No'];
                                    const op = { ...(c.optionPoints || {}) };
                                    if (op.Yes == null) op.Yes = { points: 0, isCorrect: false };
                                    if (op.No == null) op.No = { points: 0, isCorrect: false };
                                    patch.optionPoints = op;
                                  }
                                  update(idx, patch);
                                }}
                                style={{ width: '100%' }}
                              >
                                {c.type === 'choice' ? (
                                  <>
                                    <Option value="radio">Radio</Option>
                                    <Option value="dropdown">Dropdown</Option>
                                    <Option value="buttons">Buttons</Option>
                                    <Option value="yesno">Yes / No</Option>
                                  </>
                                ) : (
                                  <>
                                    <Option value="checkbox">Checkbox</Option>
                                    <Option value="dropdown">Dropdown</Option>
                                    <Option value="buttons">Buttons</Option>
                                  </>
                                )}
                              </Select>
                            </div>
                          </Col>
                          {(c.variant === 'radio' || c.variant === 'checkbox' || c.variant === 'buttons' || c.variant === 'yesno') && (
                            <Col xs={24} sm={12} span={colSpan}>
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Layout</div>
                                <Select
                                  value={c.layout || 'horizontal'}
                                  onChange={(v) => update(idx, { layout: v })}
                                  style={{ width: '100%' }}
                                >
                                  <Option value="horizontal">Horizontal</Option>
                                  <Option value="vertical">Vertical</Option>
                                </Select>
                              </div>
                            </Col>
                          )}
                          <Col span={24}>
                            <Space style={{ marginBottom: 8 }}>
                              <Switch
                                checked={!!c.enablePassFail}
                                onChange={(checked) => update(idx, { enablePassFail: checked })}
                              />
                              <span>Pass/Fail scoring</span>
                              <Switch
                                checked={!!c.enablePoints}
                                onChange={(checked) => update(idx, { enablePoints: checked })}
                              />
                              <span>Points scoring</span>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                Critical Fail is managed via Rules in the matrix editor.
                              </Typography.Text>
                            </Space>
                          </Col>
                          <Col span={24}>
                            <div style={{ marginBottom: 8 }}>
                              {c.variant === 'yesno' ? (
                                <>
                                  <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Yes / No</div>
                                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                                    Fixed options (same as Single Choice Yes/No variant).
                                  </Typography.Text>
                                  {(c.enablePassFail || c.enablePoints) && (
                                    <div style={{ marginTop: 8 }}>
                                      <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Yes/No Options</div>
                                      <Space direction="vertical" size={12}>
                                        <Space align="baseline">
                                          {c.enablePassFail && (
                                            <Checkbox
                                              checked={!!(c.optionPoints?.Yes?.isCorrect)}
                                              onChange={(e) => {
                                                const nextOp = { ...(c.optionPoints || {}) };
                                                nextOp.Yes = { ...nextOp.Yes, points: nextOp.Yes?.points ?? 0, isCorrect: e.target.checked };
                                                nextOp.No = { ...nextOp.No, points: nextOp.No?.points ?? 0, isCorrect: e.target.checked ? false : (!!nextOp.No?.isCorrect) };
                                                update(idx, { optionPoints: nextOp });
                                              }}
                                            >
                                              Correct
                                            </Checkbox>
                                          )}
                                          {c.enablePoints && (
                                            <>
                                              <span style={{ fontSize: 12 }}>Points for Yes</span>
                                              <InputNumber
                                                size="small"
                                                value={c.optionPoints?.Yes?.points ?? 0}
                                                onChange={(v) => {
                                                  const nextOp = { ...(c.optionPoints || {}) };
                                                  nextOp.Yes = { ...nextOp.Yes, points: v ?? 0, isCorrect: !!nextOp.Yes?.isCorrect };
                                                  update(idx, { optionPoints: nextOp });
                                                }}
                                                min={0}
                                                style={{ width: 72 }}
                                              />
                                            </>
                                          )}
                                          <span>Yes</span>
                                        </Space>
                                        <Space align="baseline">
                                          {c.enablePassFail && (
                                            <Checkbox
                                              checked={!!(c.optionPoints?.No?.isCorrect)}
                                              onChange={(e) => {
                                                const nextOp = { ...(c.optionPoints || {}) };
                                                nextOp.No = { ...nextOp.No, points: nextOp.No?.points ?? 0, isCorrect: e.target.checked };
                                                nextOp.Yes = { ...nextOp.Yes, points: nextOp.Yes?.points ?? 0, isCorrect: e.target.checked ? false : (!!nextOp.Yes?.isCorrect) };
                                                update(idx, { optionPoints: nextOp });
                                              }}
                                            >
                                              Correct
                                            </Checkbox>
                                          )}
                                          {c.enablePoints && (
                                            <>
                                              <span style={{ fontSize: 12 }}>Points for No</span>
                                              <InputNumber
                                                size="small"
                                                value={c.optionPoints?.No?.points ?? 0}
                                                onChange={(v) => {
                                                  const nextOp = { ...(c.optionPoints || {}) };
                                                  nextOp.No = { ...nextOp.No, points: v ?? 0, isCorrect: !!nextOp.No?.isCorrect };
                                                  update(idx, { optionPoints: nextOp });
                                                }}
                                                min={0}
                                                style={{ width: 72 }}
                                              />
                                            </>
                                          )}
                                          <span>No</span>
                                        </Space>
                                      </Space>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
                                Options
                                <Tooltip title="Add options for users to choose from. At least 2 options are required.">
                                  <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 11, color: token.colorTextTertiary }} />
                                </Tooltip>
                                <span style={{ marginLeft: 8, fontSize: 11, color: token.colorTextTertiary, fontWeight: 'normal' }}>
                                  ({(c.options || []).length} option{(c.options || []).length !== 1 ? 's' : ''})
                                </span>
                              </div>
                              
                              {/* Individual option inputs with points / correct / critical fail */}
                              <div style={{ marginBottom: 8 }}>
                                {(c.options || []).map((opt: string, optIdx: number) => {
                                  const optVal = opt || `Option ${optIdx + 1}`;
                                  const optionPoints: Record<string, OptionPointEntry> = c.optionPoints || {};
                                  const entry = optionPoints[optVal] || {};
                                  return (
                                    <div key={optIdx} style={{ marginBottom: 8, padding: 8, background: token.colorFillQuaternary, borderRadius: 6 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                        <div style={{ minWidth: 24, fontSize: 12, color: token.colorTextSecondary, fontWeight: 500 }}>{optIdx + 1}</div>
                                        <Input
                                          value={opt}
                                          onChange={(e) => {
                                            const currentOptions = [...(c.options || [])];
                                            const oldVal = currentOptions[optIdx];
                                            const newValue = e.target.value;
                                            currentOptions[optIdx] = newValue;
                                            const nextOp = { ...optionPoints };
                                            if (oldVal !== newValue) {
                                              if (oldVal && nextOp[oldVal]) {
                                                if (newValue) nextOp[newValue] = nextOp[oldVal];
                                                delete nextOp[oldVal];
                                              } else if (oldVal) delete nextOp[oldVal];
                                            }
                                            update(idx, { options: currentOptions, optionPoints: nextOp });
                                          }}
                                          placeholder={`Option ${optIdx + 1}`}
                                          style={{ flex: 1, minWidth: 120 }}
                                        />
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<CloseOutlined />}
                                          onClick={() => {
                                            const currentOptions = [...(c.options || [])];
                                            currentOptions.splice(optIdx, 1);
                                            const nextOp = { ...optionPoints };
                                            if (optVal) delete nextOp[optVal];
                                            update(idx, { options: currentOptions.filter(Boolean), optionPoints: nextOp });
                                          }}
                                          style={{ color: token.colorTextTertiary }}
                                          disabled={(c.options || []).length <= 2}
                                          title={(c.options || []).length <= 2 ? 'At least 2 options required' : 'Remove option'}
                                        />
                                      </div>
                                      {(c.enablePoints || c.enablePassFail) && (
                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginLeft: 32 }}>
                                          {c.enablePoints && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                              <span style={{ fontSize: 12 }}>Points:</span>
                                              <InputNumber
                                                size="small"
                                                value={entry.points ?? 0}
                                                onChange={(v) => {
                                                  const nextOp = { ...optionPoints };
                                                  nextOp[optVal] = { ...nextOp[optVal], points: v ?? 0 };
                                                  update(idx, { optionPoints: nextOp });
                                                }}
                                                min={c.type === 'multiple' ? undefined : 0}
                                                style={{ width: 72 }}
                                              />
                                            </div>
                                          )}
                                          {c.enablePassFail && c.type === 'choice' && (
                                            <Checkbox
                                              checked={!!entry.isCorrect}
                                              onChange={(e) => {
                                                const nextOp = { ...optionPoints };
                                                const newCorrect = e.target.checked;
                                                nextOp[optVal] = { ...nextOp[optVal], isCorrect: newCorrect };
                                                if (newCorrect) {
                                                  Object.keys(nextOp).forEach((k) => {
                                                    if (k !== optVal) nextOp[k] = { ...nextOp[k], isCorrect: false };
                                                  });
                                                }
                                                update(idx, { optionPoints: nextOp });
                                              }}
                                            >
                                              Correct (Pass)
                                            </Checkbox>
                                          )}
                                          {c.enablePassFail && c.type === 'multiple' && (
                                            <Checkbox
                                              checked={!!entry.isCorrect}
                                              onChange={(e) => {
                                                const nextOp = { ...optionPoints };
                                                nextOp[optVal] = { ...nextOp[optVal], isCorrect: e.target.checked };
                                                update(idx, { optionPoints: nextOp });
                                              }}
                                            >
                                              Correct (Pass)
                                            </Checkbox>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                
                                {/* Add new option button */}
                                <Button
                                  type="dashed"
                                  size="small"
                                  icon={<InfoCircleOutlined />}
                                  onClick={() => {
                                    const currentOptions = [...(c.options || [])];
                                    currentOptions.push('');
                                    update(idx, { options: currentOptions });
                                  }}
                                  style={{ width: '100%', marginTop: 4 }}
                                >
                                  Add Option
                                </Button>
                              </div>
                              
                              {/* Validation feedback */}
                              {(() => {
                                const optionCount = (c.options || []).filter(Boolean).length;
                                
                                if (optionCount === 0) {
                                  return (
                                    <Alert
                                      message="No options added"
                                      description="Add at least 2 options for users to choose from."
                                      type="error"
                                      showIcon
                                      style={{ fontSize: 12 }}
                                      closable={false}
                                    />
                                  );
                                }
                                
                                if (optionCount === 1) {
                                  return (
                                    <Alert
                                      message="Only 1 option"
                                      description="Add at least 1 more option. Users need multiple choices."
                                      type="warning"
                                      showIcon
                                      style={{ fontSize: 12 }}
                                      closable={false}
                                    />
                                  );
                                }
                                
                                if (optionCount >= 2) {
                                  return (
                                    <Alert
                                      message={`${optionCount} options configured`}
                                      description={`Users can select ${c.type === 'choice' ? 'one' : 'multiple'} option(s) from these ${optionCount} choices.`}
                                      type="success"
                                      showIcon
                                      style={{ fontSize: 12 }}
                                      closable={false}
                                    />
                                  );
                                }
                                
                                return null;
                              })()}
                              
                              {/* Quick templates */}
                              {(c.options || []).filter(Boolean).length === 0 && (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>Quick templates:</div>
                                  <Space size="small" wrap>
                                    <Button
                                      size="small"
                                      onClick={() => update(idx, { options: ['Yes', 'No'] })}
                                    >
                                      Yes/No
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => update(idx, { options: ['Agree', 'Neutral', 'Disagree'] })}
                                    >
                                      Agree/Neutral/Disagree
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => update(idx, { options: ['Excellent', 'Good', 'Fair', 'Poor'] })}
                                    >
                                      4-Point Scale
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => update(idx, { options: ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'] })}
                                    >
                                      5-Point Likert
                                    </Button>
                                  </Space>
                                </div>
                              )}
                                </>
                              )}
                            </div>
                          </Col>
                          {c.type === 'multiple' && (
                            <Col xs={24} sm={12} span={colSpan}>
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
                                  Max Selections
                                  <Tooltip title="Maximum number of options a user can select. Leave empty for unlimited.">
                                    <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 11, color: token.colorTextTertiary }} />
                                  </Tooltip>
                                </div>
                                <InputNumber
                                  value={c.maxSelections}
                                  onChange={(v) => update(idx, { maxSelections: v })}
                                  // min={1}
                                  max={(c.options || []).filter(Boolean).length || undefined}
                                  placeholder="Unlimited"
                                  style={{ width: '100%' }}
                                />
                                {c.maxSelections && (c.options || []).filter(Boolean).length > 0 && (
                                  <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 4 }}>
                                    Users can select up to {c.maxSelections} of {(c.options || []).filter(Boolean).length} options
                                  </div>
                                )}
                              </div>
                            </Col>
                          )}
                        </>
                      )}

                      {c.type === 'number' && (
                        <>
                          <Col xs={24} sm={8} span={colSpanThird}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Min</div>
                              <InputNumber
                                value={c.min}
                                onChange={(v) => update(idx, { min: v })}
                                style={{ width: '100%' }}
                                placeholder="No limit"
                              />
                            </div>
                          </Col>
                          <Col xs={24} sm={8} span={colSpanThird}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Max</div>
                              <InputNumber
                                value={c.max}
                                onChange={(v) => update(idx, { max: v })}
                                style={{ width: '100%' }}
                                placeholder="No limit"
                              />
                            </div>
                          </Col>
                          <Col xs={24} sm={8} span={colSpanThird}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Step</div>
                              <InputNumber
                                value={c.step || 1}
                                onChange={(v) => update(idx, { step: v })}
                                min={0.01}
                                style={{ width: '100%' }}
                              />
                            </div>
                          </Col>
                        </>
                      )}

                      {c.type === 'rating' && (
                        <>
                          <Col xs={24} sm={12} span={colSpan}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Scale (1-10)</div>
                              <InputNumber
                                value={c.scale || 5}
                                onChange={(v) => update(idx, { scale: v })}
                                min={1}
                                max={10}
                                style={{ width: '100%' }}
                              />
                            </div>
                          </Col>
                        </>
                      )}

                      {c.type === 'anchors' && (
                        <>
                          <Col xs={24} sm={12} span={colSpan}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
                                Scale
                                <Tooltip title="Number of options in the anchors column">
                                  <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 11, color: token.colorTextTertiary }} />
                                </Tooltip>
                              </div>
                              <InputNumber
                                value={c.scale || 5}
                                onChange={(v) => {
                                  const newScale = v || 5;
                                  const currentLabels = c.anchorLabels || [];
                                  // Trim labels array if scale is reduced
                                  const trimmedLabels = newScale < currentLabels.length 
                                    ? currentLabels.slice(0, newScale)
                                    : currentLabels;
                                  update(idx, { 
                                    scale: newScale,
                                    anchorLabels: trimmedLabels
                                  });
                                }}
                                min={2}
                                max={10}
                                style={{ width: '100%' }}
                              />
                            </div>
                          </Col>
                          <Col span={24}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
                                Anchor Labels
                                <Tooltip title="Add labels for each option. The number of labels should match the scale.">
                                  <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 11, color: token.colorTextTertiary }} />
                                </Tooltip>
                                <span style={{ marginLeft: 8, fontSize: 11, color: token.colorTextTertiary, fontWeight: 'normal' }}>
                                  ({c.anchorLabels?.length || 0} / {c.scale || 5})
                                </span>
                              </div>
                              
                              {/* Individual label inputs */}
                              <div style={{ marginBottom: 8 }}>
                                {Array.from({ length: c.scale || 5 }, (_, i) => {
                                  const labelValue = (c.anchorLabels || [])[i] || '';
                                  return (
                                    <div key={i} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ 
                                        minWidth: 24, 
                                        textAlign: 'center', 
                                        fontSize: 12, 
                                        color: token.colorTextSecondary,
                                        fontWeight: 500
                                      }}>
                                        {i + 1}
                                      </div>
                                      <Input
                                        value={labelValue}
                                        onChange={(e) => {
                                          const currentLabels = [...(c.anchorLabels || [])];
                                          const newValue = e.target.value;
                                          if (newValue.trim()) {
                                            currentLabels[i] = newValue.trim();
                                          } else {
                                            // Remove this label if empty
                                            currentLabels.splice(i, 1);
                                          }
                                          // Ensure array has correct length for scale
                                          const cleaned = currentLabels.filter(Boolean);
                                          update(idx, { anchorLabels: cleaned });
                                        }}
                                        placeholder={`Label ${i + 1} (optional)`}
                                        style={{ flex: 1 }}
                                      />
                                      {labelValue && (
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<CloseOutlined />}
                                          onClick={() => {
                                            const currentLabels = [...(c.anchorLabels || [])];
                                            currentLabels.splice(i, 1);
                                            update(idx, { anchorLabels: currentLabels.filter(Boolean) });
                                          }}
                                          style={{ color: token.colorTextTertiary }}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {/* Validation feedback */}
                              {(() => {
                                const labelCount = (c.anchorLabels || []).filter(Boolean).length;
                                const scale = c.scale || 5;
                                
                                if (labelCount === 0) {
                                  return (
                                    <Alert
                                      message="No labels added"
                                      description={`Add ${scale} labels to show custom text instead of numbers (1, 2, 3...). Labels are optional.`}
                                      type="info"
                                      showIcon
                                      style={{ fontSize: 12 }}
                                      closable={false}
                                    />
                                  );
                                }
                                
                                if (labelCount < scale) {
                                  return (
                                    <Alert
                                      message={`Only ${labelCount} label(s) provided`}
                                      description={`Scale is ${scale}. Add ${scale - labelCount} more label(s) to match the scale, or remaining options will show numbers.`}
                                      type="warning"
                                      showIcon
                                      style={{ fontSize: 12 }}
                                      closable={false}
                                    />
                                  );
                                }
                                
                                if (labelCount === scale) {
                                  return (
                                    <Alert
                                      message="Labels match scale"
                                      description={`All ${scale} options will display with custom labels.`}
                                      type="success"
                                      showIcon
                                      style={{ fontSize: 12 }}
                                      closable={false}
                                    />
                                  );
                                }
                                
                                if (labelCount > scale) {
                                  return (
                                    <Alert
                                      message={`Too many labels (${labelCount})`}
                                      description={`Scale is ${scale}. Only the first ${scale} labels will be used.`}
                                      type="warning"
                                      showIcon
                                      style={{ fontSize: 12 }}
                                      closable={false}
                                    />
                                  );
                                }
                                
                                return null;
                              })()}
                              
                              {/* Quick add buttons for common scales */}
                              {(c.anchorLabels || []).filter(Boolean).length === 0 && (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>Quick templates:</div>
                                  <Space size="small" wrap>
                                    <Button
                                      size="small"
                                      onClick={() => {
                                        const templates: Record<number, string[]> = {
                                          3: ['Poor', 'Fair', 'Good'],
                                          4: ['Poor', 'Fair', 'Good', 'Excellent'],
                                          5: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'],
                                          7: ['Very Poor', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent', 'Outstanding'],
                                        };
                                        const template = templates[c.scale || 5] || [];
                                        if (template.length > 0) {
                                          update(idx, { anchorLabels: template });
                                        }
                                      }}
                                      disabled={![3, 4, 5, 7].includes(c.scale || 5)}
                                    >
                                      Use Template
                                    </Button>
                                  </Space>
                                </div>
                              )}
                            </div>
                          </Col>
                        </>
                      )}

                      {c.type === 'computed' && (
                        <Col span={24}>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
                              Expression <Tooltip title="Use column IDs in expression (e.g. col_1 + col_2 * 2)">
                                <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
                              </Tooltip>
                            </div>
                            <Input
                              value={c.computedExpr || ''}
                              onChange={(e) => update(idx, { computedExpr: e.target.value })}
                              placeholder="col_1 + col_2"
                            />
                          </div>
                        </Col>
                      )}
                    </Row>
                  </div>
                ),
              },
            ]}
          />
        ))}
      </div>
    </div>
  );
}
