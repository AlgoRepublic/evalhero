/* eslint-disable @typescript-eslint/no-explicit-any */
import { Attributes } from '@tiptap/core';
import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  InputNumber,
  Row,
  Col,
} from 'antd';
import { useEffect } from 'react';
import TagSelector from '../../components/TagSelector';

const { Option } = Select;

type MCOption = {
  label: string;
  value?: string;
  imageUrl?: string | null;
  points?: number;
  isCorrect?: boolean;
};

type OptionPoints = Record<string, { points?: number; isCorrect?: boolean }>;

type MultipleChoiceFormValues = {
  label?: string;
  name?: string | null;
  variant?: 'checkbox' | 'dropdown' | 'buttons' | 'yesno' | string;
  layout?: 'horizontal' | 'vertical' | string;
  randomize?: boolean;
  enablePassFail?: boolean;
  enablePoints?: boolean;
  failCritical?: boolean;
  yesPoints?: number;
  noPoints?: number;
  yesIsCorrect?: boolean;
  noIsCorrect?: boolean;
  otherPoints?: number;
  otherIsCorrect?: boolean;
  options?: MCOption[];
  allowOther?: boolean;
  otherPlaceholder?: string;
  optionPoints?: OptionPoints;
  [key: string]: unknown;
};

interface MultipleChoiceEditModalProps {
  open: boolean;
  onClose: () => void;
  nodeAttrs: Attributes;
  options: MCOption[];
  onSave: (values: MultipleChoiceFormValues) => void;
}

const MultipleChoiceEditModal = ({
  open,
  onClose,
  nodeAttrs,
  options: initialOptions,
  onSave,
}: MultipleChoiceEditModalProps) => {
  const [form] = Form.useForm();
  const [modal, contextHolder] = Modal.useModal();

  const get = (name: string) => form.getFieldValue(name);

  const variant = Form.useWatch('variant', form) || nodeAttrs.variant;
  const enablePassFail = Form.useWatch('enablePassFail', form) || false;
  const enablePoints = Form.useWatch('enablePoints', form) || false;
  const allowOther = Form.useWatch('allowOther', form) || nodeAttrs.allowOther;
  // const watchedOptions = Form.useWatch('options', form) || initialOptions;

  useEffect(() => {
    if (!open) return;

    type OptionPoint = { points?: number; isCorrect?: boolean };
    type OptionPoints = Record<string, OptionPoint>;

    // Ensure optionPoints is always an object, not an array
    let optionPoints: OptionPoints = {};
    if (nodeAttrs.optionPoints) {
      if (Array.isArray(nodeAttrs.optionPoints)) {
        console.warn('optionPoints is an array, converting to object');
        optionPoints = {};
      } else if (typeof nodeAttrs.optionPoints === 'object') {
        optionPoints = (nodeAttrs.optionPoints as OptionPoints);
      }
    }
    const optionLimits = (nodeAttrs.optionLimits && typeof nodeAttrs.optionLimits === 'object' && !Array.isArray(nodeAttrs.optionLimits)) 
      ? (nodeAttrs.optionLimits as Record<string, number>)
      : {};

    // Helper to convert string booleans/numbers to proper types
    const toBool = (val: any): boolean => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val === 'true';
      return !!val;
    };
    const toNum = (val: any): number => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    // Merge optionPoints and optionLimits into options
    // Use opt.value as key (not opt.label) to match how it's saved in handleSave
    const mergedOptions =
      (initialOptions || []).map((opt: any) => {
        const optValue = opt.value || opt.label || '';
        const pointsData = optionPoints?.[optValue];
        
        // Points: prioritize from initialOptions, fall back to optionPoints
        let finalPoints = 0;
        if (opt.points !== undefined && opt.points !== null) {
          finalPoints = toNum(opt.points);
        } else if (pointsData?.points !== undefined && pointsData.points !== null) {
          finalPoints = toNum(pointsData.points);
        }
        
        // isCorrect: prioritize from initialOptions (node attrs), fall back to optionPoints
        let finalIsCorrect = false;
        if (opt.isCorrect !== undefined && opt.isCorrect !== null) {
          finalIsCorrect = typeof opt.isCorrect === 'boolean' 
            ? opt.isCorrect 
            : toBool(opt.isCorrect);
        } else if (pointsData?.isCorrect !== undefined && pointsData.isCorrect !== null) {
          finalIsCorrect = typeof pointsData.isCorrect === 'boolean'
            ? pointsData.isCorrect
            : toBool(pointsData.isCorrect);
        }
        
        return {
          label: opt.label || optValue || '',
          value: optValue,
          imageUrl: opt.imageUrl || null,
          points: finalPoints,
          isCorrect: finalIsCorrect,
          submissionLimit: opt.submissionLimit !== undefined && opt.submissionLimit !== null 
            ? opt.submissionLimit 
            : (optionLimits?.[optValue] || null),
        };
      });

    // Convert string booleans to actual booleans for enablePassFail and enablePoints
    const enablePassFailValue = typeof nodeAttrs.enablePassFail === 'string' 
      ? nodeAttrs.enablePassFail === 'true' 
      : !!nodeAttrs.enablePassFail;
    const enablePointsValue = typeof nodeAttrs.enablePoints === 'string'
      ? nodeAttrs.enablePoints === 'true'
      : !!nodeAttrs.enablePoints;

    form.setFieldsValue({
      ...nodeAttrs,
      options: mergedOptions,
      yesPoints: toNum(optionPoints?.['Yes']?.points),
      noPoints: toNum(optionPoints?.['No']?.points),
      yesIsCorrect: toBool(optionPoints?.['Yes']?.isCorrect),
      noIsCorrect: toBool(optionPoints?.['No']?.isCorrect),
      otherPoints: toNum(optionPoints?.['__other__']?.points),
      otherIsCorrect: toBool(optionPoints?.['__other__']?.isCorrect),
      enablePassFail: enablePassFailValue,
      enablePoints: enablePointsValue,
      allowOther: typeof nodeAttrs.allowOther === 'string' ? nodeAttrs.allowOther === 'true' : !!nodeAttrs.allowOther,
      failCritical: typeof nodeAttrs.failCritical === 'string' ? nodeAttrs.failCritical === 'true' : !!nodeAttrs.failCritical,
    });
  }, [open, initialOptions, nodeAttrs, form]);

  return (
    <>
    {contextHolder}
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
        className="multiple-option-form"
        layout="vertical"
        style={{ rowGap: 0 }}
        // initialValues={{
        //   ...nodeAttrs,
        //   // options: initialOptions,
        //   options: mergedOptions,
        //   yesPoints: nodeAttrs.optionPoints?.Yes?.points || 0,
        //   noPoints: nodeAttrs.optionPoints?.No?.points || 0,
        //   yesIsCorrect: nodeAttrs.optionPoints?.Yes?.isCorrect || false,
        //   noIsCorrect: nodeAttrs.optionPoints?.No?.isCorrect || false,
        //   otherPoints: nodeAttrs.optionPoints?.['__other__']?.points || 0,
        //   otherIsCorrect:
        //     nodeAttrs.optionPoints?.['__other__']?.isCorrect || false,
        //   enablePassFail: nodeAttrs.enablePassFail || false,
        //   enablePoints: nodeAttrs.enablePoints || false,
        // }}
        onFinish={onSave}
        onValuesChange={(changedValues, allValues) => {
          if (changedValues.enablePassFail || changedValues.enablePoints) {
            if (allValues.allowOther) {
              form.setFieldsValue({ allowOther: false });
            }
          }

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
        onFinishFailed={({ errorFields }) => {
          console.warn('Form validation failed:', errorFields);
          form.scrollToField(errorFields[0].name);
          modal.error({
            title: 'Validation Error',
            content:
              errorFields[0]?.errors?.[0] ||
              'Please fix the highlighted fields.',
          });
        }}
      >
        {/* <Form.Item name="label" label="Label">
          <Input />
        </Form.Item> */}

        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item name="variant" label="Variant">
              <Select style={{ minWidth: '120px' }}>
                <Option value="checkbox">Checkbox</Option>
                <Option value="dropdown">Dropdown</Option>
                <Option value="buttons">Buttons</Option>
                {/* <Option value="yesno">Yes / No</Option> */}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            {['checkbox', 'buttons', 'yesno'].includes(variant) && (
              <Form.Item name="layout" label="Layout">
                <Select style={{ minWidth: '120px' }}>
                  <Option value="horizontal">Horizontal</Option>
                  <Option value="vertical">Vertical</Option>
                </Select>
              </Form.Item>
            )}
          </Col>
        </Row>

        {variant !== 'yesno' && (
          <Form.Item name="randomize" valuePropName="checked">
            <Checkbox>Display options in random order</Checkbox>
          </Form.Item>
        )}

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

        <Form.Item name="enablePassFail" valuePropName="checked">
          <Checkbox>Enable Pass/Fail Scoring</Checkbox>
        </Form.Item>

        <Form.Item name="enablePoints" valuePropName="checked">
          <Checkbox>Enable Points Scoring</Checkbox>
        </Form.Item>

        <Form.Item name="failCritical" valuePropName="checked">
          <Checkbox disabled={!enablePassFail}>Fail Critical</Checkbox>
        </Form.Item>

        {variant === 'yesno' && (
          <>
            {(enablePassFail || enablePoints) && (
              <Form.Item label="Yes/No Options">
                <Space direction="vertical">
                  <Space align="baseline">
                    {enablePassFail && (
                      <Form.Item
                        name="yesIsCorrect"
                        valuePropName="checked"
                        noStyle
                      >
                        <Checkbox>Correct</Checkbox>
                      </Form.Item>
                    )}
                    {enablePoints && (
                      <Form.Item
                        name="yesPoints"
                        label="Points for Yes"
                        noStyle
                      >
                        <InputNumber placeholder="Points" />
                      </Form.Item>
                    )}
                    <span>Yes</span>
                  </Space>
                  <Space align="baseline">
                    {enablePassFail && (
                      <Form.Item
                        name="noIsCorrect"
                        valuePropName="checked"
                        noStyle
                      >
                        <Checkbox>Correct</Checkbox>
                      </Form.Item>
                    )}
                    {enablePoints && (
                      <Form.Item name="noPoints" label="Points for No" noStyle>
                        <InputNumber placeholder="Points" />
                      </Form.Item>
                    )}
                    <span>No</span>
                  </Space>
                </Space>
              </Form.Item>
            )}
          </>
        )}

        {variant !== 'yesno' && (
          <>
            <Form.Item label="Options">
              <Form.List
                name="options"
                key={`${enablePoints}-${enablePassFail}`}
              >
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => (
                      <Space key={field.key} align="baseline">
                        <Form.Item
                          {...field}
                          name={[field.name, 'label']}
                          rules={[{ required: true }]}
                        >
                          <Input placeholder="Label" />
                        </Form.Item>
                        {enablePoints && (
                          <Form.Item
                            {...field}
                            name={[field.name, 'points']}
                            // preserve={false}
                            rules={[{ required: true }]}
                          >
                            <InputNumber placeholder="Points" />
                          </Form.Item>
                        )}
                        {enablePassFail && (
                          <Form.Item
                            {...field}
                            name={[field.name, 'isCorrect']}
                            valuePropName="checked"
                          >
                            <Checkbox>Correct</Checkbox>
                          </Form.Item>
                        )}
                        {/* <Form.Item
                          {...field}
                          name={[field.name, 'submissionLimit']}
                          label="Limit"
                          tooltip="Limit submissions for this option (hide when reached)"
                        >
                          <InputNumber placeholder="Limit" min={0} style={{ width: 100 }} />
                        </Form.Item> */}
                        <Button danger onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() =>
                        add({
                          label: '',
                          value: '',
                          imageUrl: '',
                          points: 0,
                          isCorrect: false,
                        })
                      }
                      block
                    >
                      Add Option
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}

        {(enablePoints || enablePassFail) && allowOther && (
          <Form.Item label="Other Option">
            <Space align="baseline">
              {enablePoints && (
                <Form.Item name="otherPoints" label="Points for Other" noStyle>
                  <InputNumber placeholder="Points" />
                </Form.Item>
              )}
              {enablePassFail && (
                <Form.Item
                  name="otherIsCorrect"
                  valuePropName="checked"
                  noStyle
                >
                  <Checkbox>Correct</Checkbox>
                </Form.Item>
              )}
              <span>{get('otherPlaceholder') || 'Other'}</span>
            </Space>
          </Form.Item>
        )}

        {/* <Form.Item name="defaultValue" label="Default value">
          <Select
            mode="multiple"
            allowClear
            placeholder="Must match option values (optional)"
          >
            {(variant === 'yesno'
              ? [
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' },
                ]
              : watchedOptions
            ).map((opt: any, i: number) => (
              <Option key={i} value={opt.value || opt.label}>
                {opt.label}
              </Option>
            ))}
            {allowOther && (
              <Option value="__other__">
                {get('otherPlaceholder') || 'Other'}
              </Option>
            )}
          </Select>
        </Form.Item> */}

        <Form.Item name="allowOther" valuePropName="checked">
          <Checkbox disabled={enablePoints || enablePassFail}>
            Allow "Other"
          </Checkbox>
        </Form.Item>

        {get('allowOther') && (
          <Form.Item name="otherPlaceholder" label="Other placeholder">
            <Input />
          </Form.Item>
        )}

        {/* <Form.Item name="enableCalculation" valuePropName="checked" label="Calculation">
          <Checkbox>Enable for calculation (force number for values)</Checkbox>
        </Form.Item>

        <Form.Item
          name="queryParam"
          label="Query Parameter (optional)"
          tooltip="Pre-populate this field from URL query parameter. Can be comma-separated indices or labels. Example: ?checkbox=0,label2,4"
        >
          <Input placeholder="e.g. choice, option" />
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

        {/* <Form.Item label="Field Visibility">
          <div>Show this field if</div>
          <Form.Item name={['visibility', 'match']} noStyle>
            <Select style={{ width: 120 }}>
              <Option value="all">All</Option>
              <Option value="any">Any</Option>
            </Select>
          </Form.Item>
          <div>of the following rules match:</div>
          <Form.List name={['visibility', 'rules']}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline">
                    <div>if</div>
                    <Form.Item
                      {...field}
                      name={[field.name, 'field']}
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="Form Field (name)" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'operator']}
                      rules={[{ required: true }]}
                    >
                      <Select style={{ width: 150 }}>
                        <Option value="is">is</Option>
                        <Option value="is not">is not</Option>
                        <Option value="contains">contains</Option>
                        <Option value="does not contain">
                          does not contain
                        </Option>
                        <Option value="starts with">starts with</Option>
                        <Option value="ends with">ends with</Option>
                        <Option value="regex">regex</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'value']}>
                      <Input placeholder="Value (empty for null/empty check)" />
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

        <Form.Item name="tags" label="Tags">
          <TagSelector placeholder="Select tags for this field" />
        </Form.Item>
      </Form>
    </Modal>
    </>
  );
};

export default MultipleChoiceEditModal;
