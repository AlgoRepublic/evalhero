import { Checkbox, Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import countries from '../../../../../data/countries.json';
import { Country } from './utils';
// import TagSelector from '../../components/TagSelector';

const { Option } = Select;

const ShortTextEditModal = ({
  open,
  onClose,
  nodeAttrs,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  nodeAttrs: {
    variant?: 'text' | 'email' | 'phone' | 'name';
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
    namePrefix?: boolean;
    nameSuffix?: boolean;
    middleName?: boolean;
    phoneCountryIsoCode?: string;
    enableGrouping?: boolean;
    nodeGroups?: Array<{ id: string; name: string; subjectIds: string[] }>;
    tags?: string[];
  };
  onSave: (values: {
    variant?: 'text' | 'email' | 'phone' | 'name';
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
    namePrefix?: boolean;
    nameSuffix?: boolean;
    middleName?: boolean;
    phoneCountryIsoCode?: string;
    enableGrouping?: boolean;
    nodeGroups?: Array<{ id: string; name: string; subjectIds: string[] }>;
    tags?: string[];
  }) => void;
}) => {
  const [form] = Form.useForm();
  const variant = Form.useWatch('variant', form) || nodeAttrs.variant || 'text';
  const isRestrictedVariant = ['email', 'phone', 'name'].includes(variant);

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
        initialValues={{
          ...nodeAttrs,
        }}
        onFinish={(values) => {
          onSave({
            ...values,
          });
        }}
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

          if (changedValues.variant) {
            const variant = changedValues.variant;
            let regex = null;
            let mask = null;
            let placeholder = 'Enter text...';
            let minLength = null;
            let maxLength = null;
            let namePrefix = false;
            let nameSuffix = false;
            let middleName = false;
            const phoneCountryIsoCode = '';

            switch (variant) {
              case 'email':
                regex = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
                placeholder = 'email@example.com';
                break;
              case 'phone':
                mask = null;
                placeholder = '+12025550123';
                minLength = 7;
                maxLength = 15;
                break;
              case 'name':
                regex = '^[A-Za-z\\s]+$';
                placeholder = 'John Doe';
                // minLength = 2;
                maxLength = 100;
                namePrefix = false;
                nameSuffix = false;
                middleName = false;
                break;
              default:
                break;
            }

            form.setFieldsValue({
              regex,
              mask,
              placeholder,
              minLength,
              maxLength,
              requiredKeywords: '',
              requiredKeywordsMode: 'all',
              namePrefix,
              nameSuffix,
              middleName,
              phoneCountryIsoCode,
            });
          }
        }}
      >
        <Form.Item name="variant" label="Variant">
          <Select style={{ minWidth: 120 }}>
            <Option value="text">Text</Option>
            <Option value="email">Email</Option>
            <Option value="phone">Phone</Option>
            <Option value="name">Name</Option>
          </Select>
        </Form.Item>

        {/* <Form.Item name="label" label="Label">
          <Input />
        </Form.Item> */}

        {/* <Form.Item
          name="name"
          label="Field Name (auto-generated)"
          tooltip="Used in data export. Auto-filled from label."
        >
          <Input disabled />
        </Form.Item> */}

        <Form.Item name="placeholder" label="Placeholder">
          <Input />
        </Form.Item>

        {variant === 'name' && (
          <>
            <Form.Item
              name="namePrefix"
              valuePropName="checked"
              label="Include Prefix"
            >
              <Checkbox>Allow prefix (Mr., Mrs., etc.)</Checkbox>
            </Form.Item>
            <Form.Item
              name="middleName"
              valuePropName="checked"
              label="Include Middle Name"
            >
              <Checkbox>Allow middle name</Checkbox>
            </Form.Item>
            <Form.Item
              name="nameSuffix"
              valuePropName="checked"
              label="Include Suffix"
            >
              <Checkbox>Allow suffix (Jr., Sr., etc.)</Checkbox>
            </Form.Item>
          </>
        )}

        {variant === 'phone' && (
          <Form.Item name="phoneCountryIsoCode" label="Default Country">
            <Select
              showSearch
              allowClear
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string)
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {countries.map((country: Country) => (
                <Option key={country.isoCode} value={country.isoCode}>
                  {`${country.emoji} ${country.name} (${country.dialCode})`}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

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
              hidden={isRestrictedVariant}
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
                    if (value == null || value >= (min || 0))
                      return Promise.resolve();
                    return Promise.reject(new Error('Max < Min'));
                  },
                },
              ]}
              hidden={isRestrictedVariant}
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
          hidden={isRestrictedVariant}
        >
          <Input placeholder="Regex (optional)" />
        </Form.Item>

        <Form.Item
          name="mask"
          label="Input Mask"
          tooltip="E.g. 'uppercase' or 'digitsOnly'"
          hidden={isRestrictedVariant}
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

        <Form.Item
          name="requiredKeywords"
          label="Required Keywords (CSV)"
          hidden={isRestrictedVariant}
        >
          <Input placeholder="e.g. safety,incident" />
        </Form.Item>

        <Form.Item
          name="requiredKeywordsMode"
          label="Keywords Mode"
          hidden={isRestrictedVariant}
        >
          <Select>
            <Option value="all">All (every keyword required)</Option>
            <Option value="any">Any (at least one required)</Option>
          </Select>
        </Form.Item>

        {/* <Form.Item name="tags" label="Tags">
          <TagSelector placeholder="Select tags for this field" />
        </Form.Item> */}

        {/* <Form.Item
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
        </Form.Item> */}
      </Form>
    </Modal>
  );
};

export default ShortTextEditModal;
