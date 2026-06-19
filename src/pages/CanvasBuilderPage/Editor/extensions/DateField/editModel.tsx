import { Checkbox, DatePicker, Form, Input, Modal, Select, Space, Button } from 'antd';
import { useState } from 'react';
import dayjs from 'dayjs';
// import TagSelector from '../../components/TagSelector';

const { Option } = Select;

const DateEditModal = ({
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
  const [disabledDates, setDisabledDates] = useState<Array<string | { start: string; end: string }>>(
    nodeAttrs.disabledDates || []
  );

  return (
    <Modal
      open={open}
      title="Edit Date Field"
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
          disabledDates: nodeAttrs.disabledDates || [],
        }}
        onFinish={(values) => {
          // Ensure disabledDates is included in the save
          const processedValues = {
            ...values,
            disabledDates: disabledDates.length > 0 ? disabledDates : [],
          };
          onSave(processedValues);
        }}
      >
        <Form.Item name="placeholder" label="Placeholder">
          <Input size="small" />
        </Form.Item>

        <Space.Compact style={{ width: '100%', display: 'flex', gap: 8 }}>
          <Form.Item name="min" label="Min" style={{ flex: 1, marginBottom: 0 }}>
            <DatePicker size="small" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="max" label="Max" style={{ flex: 1, marginBottom: 0 }}>
            <DatePicker size="small" style={{ width: '100%' }} />
          </Form.Item>
        </Space.Compact>

        <Form.Item name="defaultDate" label="Default" style={{ marginBottom: 8 }}>
          <Select size="small">
            <Option value="none">None</Option>
            <Option value="today">Today</Option>
            <Option value="future">Tomorrow</Option>
          </Select>
        </Form.Item>

        <Form.Item name="dateFormat" label="Format" style={{ marginBottom: 8 }}>
          <Select size="small">
            <Option value="MM-DD-YYYY">MM-DD-YYYY</Option>
            <Option value="YYYY-MM-DD">YYYY-MM-DD</Option>
            <Option value="Y-MM-DD">Y-MM-DD</Option>
            <Option value="DD-MM-YYYY">DD-MM-YYYY</Option>
            <Option value="MM/DD/YYYY">MM/DD/YYYY</Option>
            <Option value="DD/MM/YYYY">DD/MM/YYYY</Option>
            <Option value="YYYY/MM/DD">YYYY/MM/DD</Option>
          </Select>
        </Form.Item>

        <Space direction="vertical" size={4} style={{ marginBottom: 8 }}>
          <Form.Item name="notInFuture" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Not in future</Checkbox>
          </Form.Item>
          <Form.Item name="notInPast" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Not in past</Checkbox>
          </Form.Item>
          <Form.Item name="required" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Required</Checkbox>
          </Form.Item>
          <Form.Item name="approvalRequired" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Approval required</Checkbox>
          </Form.Item>
        </Space>

        <Form.Item label="Disabled Dates" style={{ marginBottom: 8 }}>
          {disabledDates.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              {disabledDates.map((disabled, index) => (
                <div key={index} style={{ marginBottom: 4, padding: 4, border: '1px solid #d9d9d9', borderRadius: 2, backgroundColor: '#fafafa', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    {typeof disabled === 'string' 
                      ? dayjs(disabled).format('YYYY-MM-DD')
                      : `${dayjs(disabled.start).format('YYYY-MM-DD')} to ${dayjs(disabled.end).format('YYYY-MM-DD')}`
                    }
                  </span>
                  <Button 
                    type="text"
                    size="small" 
                    danger 
                    onClick={() => {
                      const newDisabled = [...disabledDates];
                      newDisabled.splice(index, 1);
                      setDisabledDates(newDisabled);
                      form.setFieldsValue({ disabledDates: newDisabled });
                    }}
                    style={{ padding: 0, height: 'auto', fontSize: 12 }}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Space.Compact style={{ width: '100%' }}>
            <DatePicker
              size="small"
              placeholder="Add date"
              onChange={(date) => {
                if (date) {
                  const newDisabled = [...disabledDates, date.startOf('day').toISOString()];
                  setDisabledDates(newDisabled);
                  form.setFieldsValue({ disabledDates: newDisabled });
                }
              }}
              style={{ flex: 1 }}
            />
            <DatePicker.RangePicker
              size="small"
              placeholder={['Start', 'End']}
              onChange={(range) => {
                if (range && range[0] && range[1]) {
                  const newDisabled = [...disabledDates, {
                    start: range[0].startOf('day').toISOString(),
                    end: range[1].startOf('day').toISOString(),
                  }];
                  setDisabledDates(newDisabled);
                  form.setFieldsValue({ disabledDates: newDisabled });
                }
              }}
              style={{ flex: 1 }}
            />
          </Space.Compact>
        </Form.Item>

        <Form.Item name="queryParam" label="Query Param" style={{ marginBottom: 8 }}>
          <Input size="small" placeholder="e.g. date" />
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

export default DateEditModal;
