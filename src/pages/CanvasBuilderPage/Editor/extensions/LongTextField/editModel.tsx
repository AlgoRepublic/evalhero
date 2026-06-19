import {
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Button,
} from 'antd';
// import TagSelector from '../../components/TagSelector';

const { Option } = Select;

const LongTextEditModal = ({
  open,
  onClose,
  nodeAttrs,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  nodeAttrs: {
    label?: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    regex?: string;
    mask?: string;
    required?: boolean;
    approvalRequired?: boolean;
    requiredKeywords?: string;
    requiredKeywordsMode?: 'all' | 'any';
  };
  onSave: (values: {
    label?: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    regex?: string;
    mask?: string;
    required?: boolean;
    approvalRequired?: boolean;
    requiredKeywords?: string;
    requiredKeywordsMode?: 'all' | 'any';
  }) => void;
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
        onValuesChange={(changedValues) => {
          if ('label' in changedValues) {
            const label = changedValues.label || '';
            const generatedName = label
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_') // Replace spaces/special chars with _
              .replace(/^_+|_+$/g, '') // Remove leading/trailing _
              .replace(/_+/g, '_'); // Collapse multiple _

            form.setFieldsValue({ name: generatedName || null });
          }
        }}
      >
        {/* <Form.Item name="label" label="Label">
          <Input />
        </Form.Item> */}

        <Form.Item name="placeholder" label="Placeholder">
          <Input />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="minLength"
              label="Min Length"
              rules={[
                {
                  validator(_, value) {
                    if (value == null || value >= 0) return Promise.resolve();
                    return Promise.reject(new Error('Must be ≥ 0'));
                  },
                },
              ]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="maxLength"
              label="Max Length"
              dependencies={['minLength']}
              rules={[
                {
                  validator(_, value) {
                    const min = form.getFieldValue('minLength');
                    if (value == null || value >= min) return Promise.resolve();
                    return Promise.reject(new Error('Max < Min'));
                  },
                },
              ]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="regex"
          label="Regex Pattern"
          tooltip="e.g. ^[A-Za-z ]+$"
          rules={[
            {
              validator(_, value) {
                if (!value) return Promise.resolve();
                try {
                  new RegExp(value);
                  return Promise.resolve();
                } catch {
                  return Promise.reject(new Error('Invalid regex'));
                }
              },
            },
          ]}
        >
          <Input placeholder="Regex (optional)" />
        </Form.Item>

        <Form.Item
          name="mask"
          label="Input Mask"
          tooltip="E.g. 'uppercase' or 'digitsOnly'"
        >
          <Input placeholder="Mask pattern" />
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

        <Form.Item name="requiredKeywords" label="Required Keywords (CSV)">
          <Input placeholder="e.g. safety,incident" />
        </Form.Item>

        <Form.Item name="requiredKeywordsMode" label="Keywords Mode">
          <Select>
            <Option value="all">All (every keyword required)</Option>
            <Option value="any">Any (at least one required)</Option>
          </Select>
        </Form.Item>

        {/* <Form.Item name="enableRichText" valuePropName="checked" label="Rich Text">
          <Checkbox>Enable rich text editor (vs plain text)</Checkbox>
        </Form.Item> */}

        <Form.Item
          name="queryParam"
          label="Query Parameter (optional)"
          tooltip="Pre-populate this field from URL query parameter. Enter the query parameter key (e.g., 'name' for ?name=value)"
        >
          <Input placeholder="e.g. name, email, phone" />
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

export default LongTextEditModal;
