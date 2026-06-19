import { Col, Form, Input, InputNumber, Modal, Row, Checkbox, Select, Space, Button } from 'antd';
// import TagSelector from '../../components/TagSelector';

const { Option } = Select;

const NumberEditModal = ({
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
        onFinish={onSave}
      >
        {/* <Form.Item name="label" label="Label">
          <Input />
        </Form.Item> */}

        <Form.Item name="placeholder" label="Placeholder">
          <Input />
        </Form.Item>

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
              <InputNumber min={0} style={{ width: '100%' }} placeholder="Default 1" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="unit" label="Unit label (optional)">
          <Input placeholder="e.g. mmHg, min" />
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

        <Form.Item name="calculable" valuePropName="checked" label="Calculable">
          <Checkbox>Enable for calculation (force number for values)</Checkbox>
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

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="numberFormat" label="Number Format">
              <Select>
                <Option value="none">None (1000.00)</Option>
                <Option value="comma">Comma (1,000.00)</Option>
                <Option value="dot">Dot (1.000,00)</Option>
                <Option value="space">Space (1 000,00)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="rounding" label="Rounding (decimal places)">
              <InputNumber min={0} max={10} placeholder="e.g. 2" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="queryParam"
          label="Query Parameter (optional)"
          tooltip="Pre-populate this field from URL query parameter. Enter the query parameter key (e.g., 'number' for ?number=123)"
        >
          <Input placeholder="e.g. number, count, amount" />
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

export default NumberEditModal;
