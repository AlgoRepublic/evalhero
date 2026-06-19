/* eslint-disable @typescript-eslint/no-explicit-any */
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

const SingleChoiceEditModal = ({
  open,
  onClose,
  nodeAttrs,
  options: initialOptions,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  nodeAttrs: any;
  options: any[];
  onSave: (values: any) => void;
}) => {
  const [form] = Form.useForm();
  const [modal, contextHolder] = Modal.useModal();

  const get = (name: string) => form.getFieldValue(name);

  const variant = Form.useWatch('variant', form) || nodeAttrs.variant;
  // Handle string booleans from nodeAttrs
  const enablePassFailFormValue = Form.useWatch('enablePassFail', form);
  const enablePassFail = enablePassFailFormValue !== undefined 
    ? enablePassFailFormValue 
    : (typeof nodeAttrs.enablePassFail === 'string' ? nodeAttrs.enablePassFail === 'true' : !!nodeAttrs.enablePassFail);
  
  const enablePointsFormValue = Form.useWatch('enablePoints', form);
  const enablePoints = enablePointsFormValue !== undefined
    ? enablePointsFormValue
    : (typeof nodeAttrs.enablePoints === 'string' ? nodeAttrs.enablePoints === 'true' : !!nodeAttrs.enablePoints);
  
  const allowOther = Form.useWatch('allowOther', form) ?? (typeof nodeAttrs.allowOther === 'string' ? nodeAttrs.allowOther === 'true' : !!nodeAttrs.allowOther);
  const watchedOptions = Form.useWatch('options', form) || initialOptions;

  useEffect(() => {
    if (!open) return;
    
    // Ensure optionPoints is always an object, not an array
    let optionPoints: Record<string, any> = {};
    if (nodeAttrs.optionPoints) {
      if (Array.isArray(nodeAttrs.optionPoints)) {
        // If it's an array (corrupted data), convert it to an object
        // This shouldn't happen, but handle it gracefully
        console.warn('optionPoints is an array, converting to object');
        optionPoints = {};
      } else if (typeof nodeAttrs.optionPoints === 'object') {
        optionPoints = nodeAttrs.optionPoints;
      }
    }
    const optionLimits = (nodeAttrs.optionLimits && typeof nodeAttrs.optionLimits === 'object' && !Array.isArray(nodeAttrs.optionLimits)) 
      ? nodeAttrs.optionLimits 
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
    
    // initialOptions already contains the correct data from view.tsx (points from optionPoints, isCorrect from node attrs)
    // We just need to ensure proper types and fill in any missing values
    const mergedOptions =
      (initialOptions || []).map((opt) => {
        const optValue = opt.value || opt.label || '';
        // Use opt.value as key (not opt.label) to match how it's saved in handleSave
        const pointsData = optionPoints?.[optValue];
        
        // Points: prioritize from initialOptions, fall back to optionPoints
        // Handle all cases: number, string, undefined, null, empty string
        let finalPoints = 0;
        if (opt.points !== undefined && opt.points !== null && opt.points !== '') {
          finalPoints = toNum(opt.points);
        } else if (pointsData?.points !== undefined && pointsData.points !== null && pointsData.points !== '') {
          finalPoints = toNum(pointsData.points);
        }
        // If still 0, check if it was explicitly set to 0 in optionPoints (string "0")
        if (finalPoints === 0 && pointsData?.points === '0') {
          finalPoints = 0; // Already 0, but ensure it's set
        }
        
        // isCorrect: prioritize from initialOptions (node attrs), fall back to optionPoints
        // Handle all cases: boolean true/false, string "true"/"false", undefined, null
        let finalIsCorrect = false;
        if (opt.isCorrect !== undefined && opt.isCorrect !== null) {
          // Handle both boolean and string
          finalIsCorrect = typeof opt.isCorrect === 'boolean' 
            ? opt.isCorrect 
            : toBool(opt.isCorrect);
        } else if (pointsData?.isCorrect !== undefined && pointsData.isCorrect !== null) {
          // Fall back to optionPoints
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

    console.log('Initializing options:', mergedOptions); // ✅ debug only
    console.log('Initial options from view:', initialOptions); // ✅ debug only
    console.log('optionPoints from nodeAttrs:', optionPoints); // ✅ debug only

    // Exclude optionPoints and optionLimits from form values since we handle them separately
    const restNodeAttrs = { ...nodeAttrs };
    delete restNodeAttrs.optionPoints;
    delete restNodeAttrs.optionLimits;
    
    // Convert string booleans to actual booleans for enablePassFail and enablePoints
    const enablePassFailValue = typeof nodeAttrs.enablePassFail === 'string' 
      ? nodeAttrs.enablePassFail === 'true' 
      : !!nodeAttrs.enablePassFail;
    const enablePointsValue = typeof nodeAttrs.enablePoints === 'string'
      ? nodeAttrs.enablePoints === 'true'
      : !!nodeAttrs.enablePoints;
    
    console.log('enablePassFail value:', enablePassFailValue, 'from nodeAttrs:', nodeAttrs.enablePassFail); // ✅ debug only
    console.log('enablePoints value:', enablePointsValue, 'from nodeAttrs:', nodeAttrs.enablePoints); // ✅ debug only
    
    // Ensure options is always an array, even if empty
    // mergedOptions already has the correct values with proper types, but ensure they're all present
    const formOptions = (Array.isArray(mergedOptions) && mergedOptions.length > 0 
      ? mergedOptions 
      : []
    ).map((opt: any) => {
      // mergedOptions already has finalPoints and finalIsCorrect, but ensure types are correct
      const points = typeof opt.points === 'number' 
        ? opt.points 
        : (opt.points !== undefined && opt.points !== null && opt.points !== '' ? toNum(opt.points) : 0);
      const isCorrect = typeof opt.isCorrect === 'boolean'
        ? opt.isCorrect
        : (opt.isCorrect !== undefined && opt.isCorrect !== null && opt.isCorrect !== '' ? toBool(opt.isCorrect) : false);
      
      return {
        ...opt,
        points: points,
        isCorrect: isCorrect,
      };
    });
    
    console.log('Form options to set:', formOptions); // ✅ debug only
    
    form.setFieldsValue({
      ...restNodeAttrs,
      options: formOptions,
      enablePassFail: enablePassFailValue,
      enablePoints: enablePointsValue,
      allowOther: typeof nodeAttrs.allowOther === 'string' ? nodeAttrs.allowOther === 'true' : !!nodeAttrs.allowOther,
      failCritical: typeof nodeAttrs.failCritical === 'string' ? nodeAttrs.failCritical === 'true' : !!nodeAttrs.failCritical,
      yesPoints: toNum(optionPoints?.Yes?.points),
      noPoints: toNum(optionPoints?.No?.points),
      yesIsCorrect: toBool(optionPoints?.Yes?.isCorrect),
      noIsCorrect: toBool(optionPoints?.No?.isCorrect),
      otherPoints: toNum(optionPoints?.['__other__']?.points),
      otherIsCorrect: toBool(optionPoints?.['__other__']?.isCorrect),
    });
  }, [open, nodeAttrs, initialOptions, form]);


  const validateCorrectAnswers = (props: any) => {
    console.log('props', props);
    if (!enablePassFail) return Promise.resolve();

    let correctCount = 0;
    if (variant === 'yesno') {
      if (get('yesIsCorrect')) correctCount++;
      if (get('noIsCorrect')) correctCount++;
      if (allowOther && get('otherIsCorrect')) correctCount++;
    } else {
      watchedOptions.forEach((opt: { isCorrect?: boolean }) => {
        if (opt.isCorrect) correctCount++;
      });
      if (allowOther && get('otherIsCorrect')) correctCount++;
    }

    if (correctCount !== 1) {
      return Promise.reject(
        new Error('Exactly one option must be marked as correct')
      );
    }
    return Promise.resolve();
  };

  // Automatically ensure only one option is correct
  const handleCorrectChange = (
    index?: number,
    isOther?: boolean,
    isYes?: boolean,
    isNo?: boolean
  ) => {
    const currentOptions = form.getFieldValue('options') || [];
    const updates = [...currentOptions];

    // Case 1: variant === 'yesno'
    if (variant === 'yesno') {
      if (isYes) {
        form.setFieldsValue({
          yesIsCorrect: true,
          noIsCorrect: false,
          otherIsCorrect: false,
        });
      } else if (isNo) {
        form.setFieldsValue({
          yesIsCorrect: false,
          noIsCorrect: true,
          otherIsCorrect: false,
        });
      } else if (isOther) {
        form.setFieldsValue({
          yesIsCorrect: false,
          noIsCorrect: false,
          otherIsCorrect: true,
        });
      }
      return;
    }

    // Case 2: variant !== 'yesno'
    updates.forEach((opt, i) => {
      opt.isCorrect = i === index;
    });

    // Reset otherIsCorrect if one of the main options is marked correct
    if (typeof index === 'number') {
      form.setFieldsValue({
        options: updates,
        otherIsCorrect: false,
      });
    } else if (isOther) {
      form.setFieldsValue({
        options: updates.map((o) => ({ ...o, isCorrect: false })),
        otherIsCorrect: true,
      });
    }
  };

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
        className="single-option-form"
        layout="vertical"
        style={{ rowGap: 0 }}
        // initialValues={{
        //   ...nodeAttrs,
        //   options: initialOptions,
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

          // Handle top-level label change (generates name field)
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

          // Handle option label changes - auto-generate value if empty or matches old label
          if (changedValues.options && Array.isArray(changedValues.options)) {
            changedValues.options.forEach((optChange: any, index: number) => {
              if (optChange && 'label' in optChange) {
                const currentOptions = allValues.options || [];
                const currentOption = currentOptions[index];
                if (currentOption) {
                  const newLabel = optChange.label || '';
                  const currentValue = currentOption.value || '';
                  // If value is empty or matches the old label pattern, generate new value from label
                  if (!currentValue || currentValue === currentOption.label) {
                    const generatedValue = newLabel.trim() || `Option ${index + 1}`;
                    form.setFieldsValue({
                      options: currentOptions.map((opt: any, i: number) =>
                        i === index ? { ...opt, value: generatedValue } : opt
                      ),
                    });
                  }
                }
              }
            });
          }
        }}
        onFinishFailed={({ errorFields }) => {
          console.warn('Form validation failed:', errorFields);
          // Optional: show first error message visibly
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
                <Option value="radio">Radio</Option>
                <Option value="dropdown">Dropdown</Option>
                <Option value="buttons">Buttons</Option>
                <Option value="yesno">Yes / No</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            {['radio', 'buttons', 'yesno'].includes(variant) && (
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

        {/* {enablePassFail && ( */}
        <Form.Item name="failCritical" valuePropName="checked">
          <Checkbox disabled={!enablePassFail}>Fail Critical</Checkbox>
        </Form.Item>
        {/* )} */}

        {enablePassFail && (
          <Form.Item
            name="correctAnswerValidation"
            rules={[{ validator: validateCorrectAnswers }]}
            style={{ display: 'none' }}
          >
            <Input type="hidden" />
          </Form.Item>
        )}

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
                        <Checkbox
                          onChange={(e) =>
                            e.target.checked &&
                            handleCorrectChange(undefined, false, true, false)
                          }
                        >
                          Correct
                        </Checkbox>
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
                        <Checkbox
                          onChange={(e) =>
                            e.target.checked &&
                            handleCorrectChange(undefined, false, false, true)
                          }
                        >
                          Correct
                        </Checkbox>
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
                            <InputNumber placeholder="Points" min={0} />
                          </Form.Item>
                        )}
                        {enablePassFail && (
                          <Form.Item
                            {...field}
                            name={[field.name, 'isCorrect']}
                            valuePropName="checked"
                          >
                            <Checkbox
                              onChange={(e) =>
                                e.target.checked &&
                                handleCorrectChange(field.name)
                              }
                            >
                              Correct
                            </Checkbox>
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
                      onClick={() => {
                        const currentOptions = form.getFieldValue('options') || [];
                        const newIndex = currentOptions.length;
                        add({
                          label: '',
                          value: `Option ${newIndex + 1}`,
                          imageUrl: '',
                          points: 0,
                          isCorrect: false,
                        });
                      }}
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
                  <Checkbox
                    onChange={(e) =>
                      e.target.checked && handleCorrectChange(undefined, true)
                    }
                  >
                    Correct
                  </Checkbox>
                </Form.Item>
              )}
              <span>{get('otherPlaceholder') || 'Other'}</span>
            </Space>
          </Form.Item>
        )}

        {/* <Form.Item name="defaultValue" label="Default value">
          <Select
            allowClear
            placeholder="Must match an option value (optional)"
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
          tooltip="Pre-populate this field from URL query parameter. Can be index (0,1,2), label name, or comma-separated. Example: ?checkbox=0,label2,4"
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

export default SingleChoiceEditModal;
