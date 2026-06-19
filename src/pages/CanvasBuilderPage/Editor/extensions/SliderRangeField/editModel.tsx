import { useEffect, useState } from 'react';
import { Checkbox, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Button, message, Switch, Typography } from 'antd';
// import TagSelector from '../../components/TagSelector';

const { Option } = Select;
const { Text } = Typography;

const SliderRangeEditModal = ({
  open,
  onClose,
  nodeAttrs,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  nodeAttrs: any;
  onSave: (values: any) => void;
}) => {
  const [form] = Form.useForm();
  const rangeMode = Form.useWatch('rangeMode', form);
  const min = Form.useWatch('min', form) ?? 0;
  const max = Form.useWatch('max', form) ?? 10;
  const [marksMode, setMarksMode] = useState<'simple' | 'advanced'>('simple');

  useEffect(() => {
    const initialValues = { ...nodeAttrs };
    if (Array.isArray(nodeAttrs?.value)) {
      initialValues.valueFrom = nodeAttrs.value[0];
      initialValues.valueTo = nodeAttrs.value[1];
      delete initialValues.value;
    } else {
      initialValues.value = nodeAttrs?.value ?? undefined;
    }
    
    // Handle marks initialization
    if (nodeAttrs?.marks) {
      if (typeof nodeAttrs.marks === 'string') {
        // String input - use advanced mode
        initialValues.marks = nodeAttrs.marks;
        initialValues.marksList = undefined;
        setMarksMode('advanced');
      } else if (Array.isArray(nodeAttrs.marks)) {
        // Convert array to structured list
        initialValues.marksList = nodeAttrs.marks
          .filter((item: any) => item != null) // Filter out null/undefined items
          .map((item: any) => ({
            value: item?.value ?? item,
            label: item?.label ?? item?.value ?? item ?? '',
          }));
        initialValues.marks = undefined;
        setMarksMode('simple');
      } else if (typeof nodeAttrs.marks === 'object' && nodeAttrs.marks !== null) {
        // Convert object to structured list
        const marksList = Object.entries(nodeAttrs.marks)
          .filter(([val]) => val != null) // Filter out null keys
          .map(([val, label]) => ({
            value: Number(val),
            label: String(label ?? val ?? ''),
          }));
        if (marksList.length > 0) {
          initialValues.marksList = marksList;
          initialValues.marks = undefined;
          setMarksMode('simple');
        } else {
          initialValues.marks = JSON.stringify(nodeAttrs.marks);
          initialValues.marksList = undefined;
          setMarksMode('advanced');
        }
      }
    } else {
      initialValues.marksList = undefined;
      initialValues.marks = undefined;
    }
    
    form.setFieldsValue(initialValues);
  }, [nodeAttrs, form]);

  const parseMarksInput = (input?: string) => {
    if (!input || !input.trim()) {
      return undefined;
    }
    const trimmed = input.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      // fall through to comma parsing
    }
    const marks: Record<number, string> = {};
    if (typeof trimmed === 'string' && trimmed.length > 0) {
      trimmed
        .split(',')
        .map((part) => String(part).trim())
        .filter(Boolean)
        .forEach((part) => {
          const parts = String(part).split(':');
          if (parts.length === 0) return;
          const rawValue = parts[0];
          const rawLabel = parts.slice(1).join(':') || rawValue;
          if (rawValue === undefined || rawValue === '') {
            return;
          }
          const valueNumber = Number(rawValue.trim());
          if (!Number.isNaN(valueNumber) && isFinite(valueNumber)) {
            marks[valueNumber] = String(rawLabel).trim() || String(rawValue).trim();
          }
        });
    }
    return Object.keys(marks).length ? marks : undefined;
  };

  const handleFinish = (values: any) => {
    const nextValues = { ...values };

    const min = typeof nextValues.min === 'number' ? nextValues.min : Number(nextValues.min);
    const max = typeof nextValues.max === 'number' ? nextValues.max : Number(nextValues.max);
    const step = typeof nextValues.step === 'number' ? nextValues.step : Number(nextValues.step);

    if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(step)) {
      message.error('Please provide valid numeric values for min, max and step.');
      return;
    }

    if (min >= max) {
      message.error('Max must be greater than min.');
      return;
    }

    if (step <= 0) {
      message.error('Step must be greater than zero.');
      return;
    }

    nextValues.min = min;
    nextValues.max = max;
    nextValues.step = step;

    if (nextValues.rangeMode) {
      const from =
        typeof nextValues.valueFrom === 'number'
          ? nextValues.valueFrom
          : Number(nextValues.valueFrom);
      const to =
        typeof nextValues.valueTo === 'number' ? nextValues.valueTo : Number(nextValues.valueTo);

      if (Number.isNaN(from) || Number.isNaN(to)) {
        message.error('Please provide valid default range values.');
        return;
      }

      const sortedRange = [from, to].sort((a, b) => a - b) as [number, number];
      const clampedRange: [number, number] = [
        Math.min(Math.max(sortedRange[0], min), max),
        Math.min(Math.max(sortedRange[1], min), max),
      ];
      nextValues.value = clampedRange;
    } else if (nextValues.value !== undefined && nextValues.value !== null) {
      const valueNumber =
        typeof nextValues.value === 'number' ? nextValues.value : Number(nextValues.value);
      if (Number.isNaN(valueNumber)) {
        message.error('Please provide a valid default value.');
        return;
      }
      nextValues.value = Math.min(Math.max(valueNumber, min), max);
    } else {
      nextValues.value = undefined;
    }

    // Handle marks - convert from simple or advanced mode
    if (marksMode === 'simple' && nextValues.marksList && Array.isArray(nextValues.marksList)) {
      // Convert structured list to object format
      const marksObj: Record<number, string> = {};
      nextValues.marksList
        .filter((item: any) => item != null) // Filter out null/undefined items
        .forEach((item: { value: number; label: string }) => {
          if (item.value !== undefined && item.value !== null && item.label) {
            marksObj[Number(item.value)] = String(item.label);
          }
        });
      nextValues.marks = Object.keys(marksObj).length > 0 ? marksObj : undefined;
    } else {
      // Advanced mode - parse text input
      const parsedMarks = parseMarksInput(nextValues.marks);
      nextValues.marks = parsedMarks;
    }

    delete nextValues.valueFrom;
    delete nextValues.valueTo;
    delete nextValues.marksList;

    onSave(nextValues);
  };

  return (
    <Modal
      open={open}
      title="Edit Field"
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={nodeAttrs}
        onFinish={handleFinish}
      >
        {/* <Form.Item name="label" label="Label">
          <Input />
        </Form.Item> */}

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="min" label="Min">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="max" label="Max">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="step" label="Step">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="rangeMode" valuePropName="checked">
          <Checkbox>Range mode (select min & max)</Checkbox>
        </Form.Item>

        {/* Default value(s) conditional */}
        {!rangeMode && (
          <Form.Item name="value" label="Default value">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        )}
        {rangeMode && (
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="valueFrom" label="Default from">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="valueTo" label="Default to">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Form.Item label="Tick Labels (Marks)">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Add custom labels at specific values on the slider
              </Text>
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>Simple</Text>
                <Switch
                  checked={marksMode === 'advanced'}
                  onChange={(checked) => {
                    setMarksMode(checked ? 'advanced' : 'simple');
                    // Clear the other field when switching modes
                    if (checked) {
                      form.setFieldValue('marksList', undefined);
                    } else {
                      form.setFieldValue('marks', undefined);
                    }
                  }}
                  size="small"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>Advanced</Text>
              </Space>
            </div>
            
            {marksMode === 'simple' ? (
              <Form.List name="marksList">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => (
                      <Space key={field.key} align="baseline" style={{ width: '100%', marginBottom: 8 }}>
                        <Form.Item
                          {...field}
                          name={[field.name, 'value']}
                          rules={[{ required: true, message: 'Value required' }]}
                          style={{ marginBottom: 0, flex: 1 }}
                        >
                          <InputNumber
                            placeholder="Value"
                            style={{ width: '100%' }}
                            min={min}
                            max={max}
                          />
                        </Form.Item>
                        <Text type="secondary">:</Text>
                        <Form.Item
                          {...field}
                          name={[field.name, 'label']}
                          rules={[{ required: true, message: 'Label required' }]}
                          style={{ marginBottom: 0, flex: 2 }}
                        >
                          <Input placeholder="Label (e.g., Low, Medium, High)" />
                        </Form.Item>
                        <Button
                          danger
                          type="text"
                          onClick={() => remove(field.name)}
                          style={{ flexShrink: 0 }}
                        >
                          Remove
                        </Button>
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ value: undefined, label: '' })}
                      block
                      style={{ marginTop: 8 }}
                    >
                      + Add Label
                    </Button>
                    {fields.length === 0 && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                        Example: Value 0 with label "Low", Value 5 with label "Medium", Value 10 with label "High"
                      </Text>
                    )}
                  </>
                )}
              </Form.List>
            ) : (
              <Form.Item
                name="marks"
                style={{ marginBottom: 0 }}
                help={
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Format: <code>0:Low,5:Mid,10:High</code> or JSON: <code>{`{"0":"Low","5":"Mid"}`}</code>
                    </Text>
                  </div>
                }
              >
                <Input.TextArea
                  rows={3}
                  placeholder='0:Low,5:Mid,10:High or {"0":"Low","5":"Mid","10":"High"}'
                />
              </Form.Item>
            )}
          </Space>
        </Form.Item>

        <Form.Item name="showTicks" valuePropName="checked">
          <Checkbox>Show ticks</Checkbox>
        </Form.Item>

        <Form.Item name="required" valuePropName="checked" label="Required">
          <Checkbox>Field is required</Checkbox>
        </Form.Item>

        <Form.Item
          name="approvalRequired"
          valuePropName="checked"
          label=""
        >
          <Checkbox>Approval required before this value is accepted</Checkbox>
        </Form.Item>

        <Form.Item name="displayValue" label="Display Selected Value">
          <Select>
            <Option value="tooltip">Tooltip (default)</Option>
            <Option value="above">Above slider</Option>
            <Option value="below">Below slider</Option>
            <Option value="none">None</Option>
          </Select>
        </Form.Item>

        <Form.Item name="displayStepValues" label="Display Step Values">
          <Select>
            <Option value="none">None</Option>
            <Option value="minmax">Min/Max only (default)</Option>
            <Option value="all">All step values</Option>
          </Select>
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="prefix" label="Prefix">
              <Input placeholder="e.g. $" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="suffix" label="Suffix">
              <Input placeholder="e.g. %" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="queryParam"
          label="Query Parameter (optional)"
          tooltip="Pre-populate this field from URL query parameter. For range mode, use comma-separated values (e.g., 'slider' for ?slider=5,10)"
        >
          <Input placeholder="e.g. slider, range" />
        </Form.Item>

        <Form.Item label="Field Visibility">
          <div style={{ marginBottom: 8 }}>
            Show/Hide this field if{' '}
            <Form.Item name={['visibility', 'match']} noStyle initialValue="all">
              <Select style={{ width: 100, marginLeft: 8, marginRight: 8 }}>
                <Option value="all">All</Option>
                <Option value="any">Any</Option>
              </Select>
            </Form.Item>
            of the following rules match:
          </div>
          <Form.List name={['visibility', 'rules']}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ marginBottom: 8, display: 'flex' }}>
                    <div>if</div>
                    <Form.Item
                      {...field}
                      name={[field.name, 'field']}
                      rules={[{ required: true, message: 'Field name required' }]}
                    >
                      <Input placeholder="Form Field (name)" style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'operator']}
                      rules={[{ required: true, message: 'Operator required' }]}
                      initialValue="is"
                    >
                      <Select style={{ width: 150 }}>
                        <Option value="is">is</Option>
                        <Option value="is_not">is not</Option>
                        <Option value="contains">Contains</Option>
                        <Option value="does_not_contain">Does not Contain</Option>
                        <Option value="starts_with">starts with</Option>
                        <Option value="ends_with">ends with</Option>
                        <Option value="regex">regex</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'value']}>
                      <Input placeholder="Value (empty for null/empty check)" style={{ width: 200 }} />
                    </Form.Item>
                    <Button danger onClick={() => remove(field.name)}>
                      Remove
                    </Button>
                  </Space>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ field: '', operator: 'is', value: '' })}
                  block
                >
                  Add Rule
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        {/* <Form.Item name="tags" label="Tags">
          <TagSelector placeholder="Select tags for this field" />
        </Form.Item> */}
      </Form>
    </Modal>
  );
};

export default SliderRangeEditModal;
