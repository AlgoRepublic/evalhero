import { Checkbox, DatePicker, Form, Input, Modal, Select, InputNumber, Space, Button, TimePicker } from 'antd';
import dayjs from 'dayjs';
// import TagSelector from '../../components/TagSelector';

const { Option } = Select;

interface DateTimeFieldAttrs {
  label?: string;
  placeholder?: string;
  min?: Date | string | null;
  max?: Date | string | null;
  notInFuture?: boolean;
  notInPast?: boolean;
  timeFormat?: '24' | '12' | string;
  showSeconds?: boolean;
  timezone?: string;
  timeLimits?: {
    start?: string | null;
    end?: string | null;
  } | null;
  [key: string]: unknown;
}

const DateTimeEditModal = ({
  open,
  onClose,
  nodeAttrs,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  nodeAttrs: DateTimeFieldAttrs;
  onSave: (values: DateTimeFieldAttrs) => void;
}) => {
  const [form] = Form.useForm();

  return (
    <Modal
      open={open}
      title="Edit DateTime Field"
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      maskClosable={false}
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={{
          ...nodeAttrs,
          // Convert time limits strings to dayjs objects for TimePicker
          timeLimits: nodeAttrs.timeLimits && (nodeAttrs.timeLimits.start || nodeAttrs.timeLimits.end)
            ? {
                start: nodeAttrs.timeLimits.start
                  ? dayjs(nodeAttrs.timeLimits.start, 'HH:mm')
                  : null,
                end: nodeAttrs.timeLimits.end
                  ? dayjs(nodeAttrs.timeLimits.end, 'HH:mm')
                  : null,
              }
            : null,
        }}
        onFinish={(values) => {
          // Convert time limits dayjs objects back to HH:mm strings
          const processedValues = { ...values };
          if (processedValues.timeLimits) {
            processedValues.timeLimits = {
              start: processedValues.timeLimits.start
                ? dayjs(processedValues.timeLimits.start).format('HH:mm')
                : null,
              end: processedValues.timeLimits.end
                ? dayjs(processedValues.timeLimits.end).format('HH:mm')
                : null,
            };
            // Remove if both are null
            if (!processedValues.timeLimits.start && !processedValues.timeLimits.end) {
              processedValues.timeLimits = null;
            }
          }
          onSave(processedValues);
        }}
      >
        <Form.Item name="placeholder" label="Placeholder">
          <Input size="small" />
        </Form.Item>

        <Space.Compact style={{ width: '100%', display: 'flex', gap: 8 }}>
          <Form.Item name="min" label="Min" style={{ flex: 1, marginBottom: 0 }}>
            <DatePicker showTime size="small" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="max" label="Max" style={{ flex: 1, marginBottom: 0 }}>
            <DatePicker showTime size="small" style={{ width: '100%' }} />
          </Form.Item>
        </Space.Compact>

        <Space.Compact style={{ width: '100%', display: 'flex', gap: 8, marginBottom: 8 }}>
          <Form.Item name="timeFormat" label="Format" style={{ flex: 1, marginBottom: 0 }}>
            <Select size="small">
              <Select.Option value="24">24-hour</Select.Option>
              <Select.Option value="12">12-hour</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="timeIncrement" label="Increment (min)" style={{ flex: 1, marginBottom: 0 }}>
            <InputNumber 
              min={1} 
              max={60} 
              placeholder="15" 
              size="small"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Space.Compact>

        <Form.Item name="timezone" label="Timezone" style={{ marginBottom: 8 }}>
          <Input size="small" placeholder="e.g. America/New_York" />
        </Form.Item>

        <Space.Compact style={{ width: '100%', display: 'flex', gap: 8, marginBottom: 8 }}>
          <Form.Item name={['timeLimits', 'start']} label="Time Start" style={{ flex: 1, marginBottom: 0 }}>
            <TimePicker 
              format="HH:mm" 
              size="small"
              style={{ width: '100%' }}
              placeholder="09:00"
            />
          </Form.Item>
          <Form.Item name={['timeLimits', 'end']} label="Time End" style={{ flex: 1, marginBottom: 0 }}>
            <TimePicker 
              format="HH:mm" 
              size="small"
              style={{ width: '100%' }}
              placeholder="17:00"
            />
          </Form.Item>
        </Space.Compact>
        {form.getFieldValue('timeLimits')?.start || form.getFieldValue('timeLimits')?.end ? (
          <Button 
            type="link" 
            size="small"
            danger 
            onClick={() => form.setFieldsValue({ timeLimits: null })}
            style={{ padding: 0, height: 'auto', marginBottom: 8 }}
          >
            Clear time limits
          </Button>
        ) : null}

        <Space direction="vertical" size={4} style={{ marginBottom: 8 }}>
          <Form.Item name="showSeconds" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Show seconds</Checkbox>
          </Form.Item>
          <Form.Item name="notInFuture" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Not in future</Checkbox>
          </Form.Item>
          <Form.Item name="notInPast" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Not in past</Checkbox>
          </Form.Item>
          <Form.Item name="required" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Required</Checkbox>
          </Form.Item>
          <Form.Item
            name="approvalRequired"
            valuePropName="checked"
            style={{ marginBottom: 8 }}
            label=""
          >
            <Checkbox>Approval required</Checkbox>
          </Form.Item>
        </Space>

        <Form.Item name="queryParam" label="Query Param" style={{ marginBottom: 8 }}>
          <Input size="small" placeholder="e.g. datetime" />
        </Form.Item>


        <Form.Item label="Visibility" style={{ marginBottom: 8 }}>
          <Space.Compact style={{ width: '100%', marginBottom: 6 }}>
            <span style={{ fontSize: 12, lineHeight: '24px', paddingRight: 4 }}>Show if</span>
            <Form.Item name={['visibility', 'match']} noStyle initialValue="all" style={{ marginBottom: 0 }}>
              <Select size="small" style={{ width: 80 }}>
                <Option value="all">All</Option>
                <Option value="any">Any</Option>
              </Select>
            </Form.Item>
            <span style={{ fontSize: 12, lineHeight: '24px', paddingLeft: 4 }}>match:</span>
          </Space.Compact>
          <Form.List name={['visibility', 'rules']}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <div key={field.key} style={{ marginBottom: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Form.Item
                      {...field}
                      name={[field.name, 'field']}
                      rules={[{ required: true }]}
                      style={{ marginBottom: 0, flex: 1 }}
                    >
                      <Input size="small" placeholder="Field" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'operator']}
                      rules={[{ required: true }]}
                      initialValue="is"
                      style={{ marginBottom: 0, width: 100 }}
                    >
                      <Select size="small">
                        <Option value="is">is</Option>
                        <Option value="is_not">≠</Option>
                        <Option value="contains">contains</Option>
                        <Option value="does_not_contain">!contains</Option>
                        <Option value="starts_with">starts</Option>
                        <Option value="ends_with">ends</Option>
                        <Option value="regex">regex</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'value']} style={{ marginBottom: 0, flex: 1 }}>
                      <Input size="small" placeholder="Value" />
                    </Form.Item>
                    <Button type="text" size="small" danger onClick={() => remove(field.name)} style={{ padding: '0 4px' }}>
                      ×
                    </Button>
                  </div>
                ))}
                <Button
                  type="dashed"
                  size="small"
                  onClick={() => add({ field: '', operator: 'is', value: '' })}
                  block
                  style={{ marginTop: 4 }}
                >
                  + Add Rule
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

export default DateTimeEditModal;
