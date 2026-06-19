import {
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
} from 'antd';
// import TagSelector from '../../components/TagSelector';

const { Option } = Select;

const RatingEditModal = ({
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

  // Convert anchorLabels array to comma-separated string for input
  const initialValues = {
    ...nodeAttrs,
    anchorLabels: Array.isArray(nodeAttrs.anchorLabels)
      ? nodeAttrs.anchorLabels.join(', ')
      : nodeAttrs.anchorLabels || '',
  };

  const handleFinish = (values: any) => {
    // Convert anchorLabels string back to array
    const processedValues = {
      ...values,
      anchorLabels:
        values.anchorLabels && typeof values.anchorLabels === 'string'
          ? values.anchorLabels
              .split(',')
              .map((label: string) => label.trim())
              .filter((label: string) => label.length > 0)
          : Array.isArray(values.anchorLabels)
          ? values.anchorLabels
          : undefined,
    };
    onSave(processedValues);
  };

  return (
    <Modal
      open={open}
      title="Edit Rating Field"
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      maskClosable={false}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleFinish}
      >
        {/* <Form.Item name="label" label="Label">
          <Input />
        </Form.Item> */}

        <Form.Item name="variant" label="Variant">
          <Select>
            <Option value="stars">Stars</Option>
            <Option value="anchors">Anchors (labels)</Option>
            <Option value="emoji">Emoji</Option>
          </Select>
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="scale"
              label="Scale (count)"
              rules={[
                { required: true, message: 'Scale is required' },
                { type: 'number', min: 1, max: 20, message: 'Scale must be between 1 and 20' },
              ]}
            >
              <InputNumber min={1} max={20} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="allowHalf" valuePropName="checked">
              <Checkbox>Allow half-values (stars)</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="anchorLabels"
          label="Anchor labels (comma separated)"
          tooltip={`If using anchors variant, provide exactly ${form.getFieldValue('scale') || nodeAttrs.scale || 5} labels separated by commas (e.g., "Poor, Fair, Good, Very Good, Excellent")`}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || value.trim() === '') {
                  return Promise.resolve();
                }
                const scale = getFieldValue('scale') || nodeAttrs.scale || 5;
                const labels = value.split(',').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
                if (labels.length !== scale) {
                  return Promise.reject(
                    new Error(`Please provide exactly ${scale} labels (one for each rating value)`)
                  );
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <Input placeholder="e.g., Poor, Fair, Good, Very Good, Excellent" />
        </Form.Item>

        <Form.Item name="required" valuePropName="checked">
          <Checkbox>Required</Checkbox>
        </Form.Item>

        <Form.Item
          name="approvalRequired"
          valuePropName="checked"
          label=""
        >
          <Checkbox>Approval required before this value is accepted</Checkbox>
        </Form.Item>

        <Form.Item name="showSuffix" valuePropName="checked" label="Show Suffix">
          <Checkbox>Show suffix (e.g., 0/5)</Checkbox>
        </Form.Item>

        <Form.Item
          name="value"
          label="Default value"
          tooltip="Optional default rating value (1 to scale)"
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (value === null || value === undefined || value === '') {
                  return Promise.resolve();
                }
                const scale = getFieldValue('scale') || nodeAttrs.scale || 5;
                const numValue = typeof value === 'number' ? value : parseFloat(value);
                if (isNaN(numValue) || numValue < 1 || numValue > scale) {
                  return Promise.reject(
                    new Error(`Default value must be between 1 and ${scale}`)
                  );
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            max={form.getFieldValue('scale') || nodeAttrs.scale || 5}
            step={form.getFieldValue('allowHalf') ? 0.5 : 1}
            placeholder="Leave empty for no default"
          />
        </Form.Item>

        <Form.Item
          name="queryParam"
          label="Query Parameter (optional)"
          tooltip="Pre-populate this field from URL query parameter. Enter the query parameter key (e.g., 'rating' for ?rating=5)"
        >
          <Input placeholder="e.g. rating, score" />
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

export default RatingEditModal;
