import {
  Button,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import { EditingNodePayload } from '..';

const { Text } = Typography;
const { TextArea } = Input;

const { Option } = Select;

const EditModal = ({
  editingNode,
  setEditingNode,
  saveNode,
  form,
}: {
  saveNode: () => void;
  editingNode: EditingNodePayload | null;
  setEditingNode: (node: EditingNodePayload | null) => void;
  form: ReturnType<typeof Form.useForm>[0];
}) => {
  const [modal, contextHolder] = Modal.useModal();
  console.log('editingNode', editingNode);

  const type = editingNode?.type || '';
  const get = (name: string) => form.getFieldValue(name);

  const isTextType = ['shortText', 'longText', 'richText'].includes(type);
  // const isChoiceType = ['singleChoice', 'multipleChoice'].includes(type);
  const isRanking = type === 'ranking';
  const isNumber = type === 'numberField';
  const isSlider = type === 'sliderField';
  const isRating = type === 'ratingField';
  const isDate = type === 'dateField';
  const isDateTime = type === 'dateTimeField';
  const isMatrix = type === 'matrixField';
  const isFile = type === 'fileField';
  const isSignature = type === 'signatureField';

  const onCaptureTemplate = async () => {
    // Only valid for repeater; capture selection from editor and set into the node attrs.template immediately
    if (!editingNode || editingNode.type !== 'repeater' || !editingNode?.editor)
      return;
    const ed = editingNode.editor;
    const { from, to } = ed.state.selection;
    if (from === to) {
      modal.info({
        title: 'Selection required',
        content: 'Select nodes in the editor to capture as template.',
      });
      return;
    }
    try {
      const slice = ed.state.doc.slice(from, to);
      const contentJson = slice.content.toJSON();
      // Immediately update the node attrs
      editingNode.updateAttributes({
        ...editingNode.attrs,
        template: contentJson,
      });
      modal.success({
        title: 'Template captured',
        content: 'Template saved to repeater.',
      });
      setEditingNode(null);
    } catch (err) {
      modal.error({ title: 'Error', content: 'Failed to capture template' });
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
      open={!!editingNode}
      title="Edit Field"
      onCancel={() => setEditingNode(null)}
      onOk={saveNode}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="label" label="Label" labelCol={{ span: 24 }}>
          <Input />
        </Form.Item>

        {/* Placeholder for inputs/textareas */}
        {editingNode?.attrs?.placeholder !== undefined && (
          <Form.Item name="placeholder" label="Placeholder">
            <Input />
          </Form.Item>
        )}

        {/* Options for choices / ranking */}
        {editingNode?.attrs?.options !== undefined && (
          <Form.Item
            name="options"
            label="Options (comma separated)"
            tooltip="Comma-separated list (order matters for ranking). For robust IDs use the option editor (todo)."
          >
            <Input />
          </Form.Item>
        )}

        {/* checked (for checkbox default) */}
        {editingNode?.attrs?.checked !== undefined && (
          <Form.Item name="checked" valuePropName="checked">
            <Checkbox>Checked</Checkbox>
          </Form.Item>
        )}

        {/* Choice specific */}
        {type === 'singleChoice' && (
          <>
            <Form.Item name="variant" label="Variant">
              <Select>
                <Option value="radio">Radio</Option>
                <Option value="dropdown">Dropdown</Option>
                <Option value="buttons">Buttons</Option>
                <Option value="yesno">Yes / No</Option>
              </Select>
            </Form.Item>

            <Form.Item name="defaultValue" label="Default value">
              <Input placeholder="Must match an option label (optional)" />
            </Form.Item>

            <Form.Item name="allowOther" valuePropName="checked">
              <Checkbox>Allow "Other"</Checkbox>
            </Form.Item>

            {get('allowOther') && (
              <Form.Item name="otherPlaceholder" label="Other placeholder">
                <Input />
              </Form.Item>
            )}
          </>
        )}

        {type === 'multipleChoice' && (
          <>
            <Form.Item name="allowOther" valuePropName="checked">
              <Checkbox>Allow "Other"</Checkbox>
            </Form.Item>

            {get('allowOther') && (
              <Form.Item name="otherPlaceholder" label="Other placeholder">
                <Input />
              </Form.Item>
            )}

            <Form.Item name="optionCommentsAllowed" valuePropName="checked">
              <Checkbox>Allow per-option comments (UI-only)</Checkbox>
            </Form.Item>
          </>
        )}

        {isRanking && (
          <>
            <Form.Item name="rankingDescription" label="Description (optional)">
              <Input />
            </Form.Item>
            <Form.Item>
              <Tooltip title="Ordering is done by dragging the items in-editor">
                <span style={{ color: '#888' }}>
                  To change the option labels, edit the Options field above.
                </span>
              </Tooltip>
            </Form.Item>
          </>
        )}

        {/* <Divider /> */}

        {/* Text validation & required keywords */}
        {isTextType && (
          <>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="minLength"
                  label="Minimum Length"
                  rules={[
                    {
                      validator(_, value) {
                        if (value === undefined || value === null)
                          return Promise.resolve();
                        if (value < 0)
                          return Promise.reject(new Error('Must be >= 0'));
                        return Promise.resolve();
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
                  label="Maximum Length"
                  dependencies={['minLength']}
                  rules={[
                    {
                      validator(_, value) {
                        if (value === undefined || value === null)
                          return Promise.resolve();
                        const min = form.getFieldValue('minLength');
                        if (min !== undefined && value < min) {
                          return Promise.reject(
                            new Error('Max must be >= min')
                          );
                        }
                        return Promise.resolve();
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
              tooltip="Provide a regex string (e.g. ^[A-Za-z ]+$)"
              rules={[
                {
                  validator(_, value) {
                    if (!value) return Promise.resolve();
                    try {
                      new RegExp(value);
                      return Promise.resolve();
                    } catch {
                      return Promise.reject(new Error('Invalid regex pattern'));
                    }
                  },
                },
              ]}
            >
              <Input placeholder="e.g. ^[A-Za-z ]+$" />
            </Form.Item>

            <Form.Item
              name="mask"
              label="Input Mask"
              tooltip="Optional mask (e.g. (999) 999-9999)"
            >
              <Input placeholder="Optional mask pattern or 'uppercase' 'digitsOnly'" />
            </Form.Item>

            <Form.Item
              name="requiredKeywords"
              label="Required Keywords (comma separated)"
              tooltip="Enter keywords that must appear in an answer"
            >
              <Input placeholder="e.g. safety,incident,protocol" />
            </Form.Item>

            <Form.Item
              name="requiredKeywordsMode"
              label="Keywords Mode"
              initialValue="all"
            >
              <Select style={{ width: 200 }}>
                <Option value="all">All (every keyword required)</Option>
                <Option value="any">Any (at least one required)</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {/* <Divider /> */}

        {/* Numeric & Scale fields */}
        {isNumber && (
          <>
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

            <Form.Item name="unit" label="Unit label (optional)">
              <Input placeholder="e.g. mmHg, min" />
            </Form.Item>

            <Form.Item name="required" valuePropName="checked">
              <Checkbox>Required</Checkbox>
            </Form.Item>

            <Form.Item name="value" label="Default value">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

        {isSlider && (
          <>
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
            {!get('rangeMode') && (
              <Form.Item name="value" label="Default value">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            )}
            {get('rangeMode') && (
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

            <Form.Item
              name="marks"
              label="Marks (comma separated or JSON)"
              tooltip='Example comma format: "0:Low,5:Mid,10:High" or JSON {"0":"Low","5":"Mid"}'
            >
              <Input />
            </Form.Item>

            <Form.Item name="showTicks" valuePropName="checked">
              <Checkbox>Show ticks</Checkbox>
            </Form.Item>
          </>
        )}

        {isRating && (
          <>
            <Form.Item name="variant" label="Variant">
              <Select>
                <Option value="stars">Stars</Option>
                <Option value="anchors">Anchors (labels)</Option>
              </Select>
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="scale" label="Scale (count)">
                  <InputNumber min={1} style={{ width: '100%' }} />
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
              tooltip="If using anchors, provide exactly {scale} labels"
            >
              <Input />
            </Form.Item>

            <Form.Item name="required" valuePropName="checked">
              <Checkbox>Required</Checkbox>
            </Form.Item>

            <Form.Item name="value" label="Default value">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

        {isDate && (
          <>
            {/* // when editingNode?.type === 'dateField' */}
            <Form.Item name="min" label="Min date">
              <DatePicker />
            </Form.Item>
            <Form.Item name="max" label="Max date">
              <DatePicker />
            </Form.Item>
            <Form.Item name="notInFuture" valuePropName="checked">
              <Checkbox>Not in future (disable dates after today)</Checkbox>
            </Form.Item>
            <Form.Item name="notInPast" valuePropName="checked">
              <Checkbox>Not in past (disable dates before today)</Checkbox>
            </Form.Item>
          </>
        )}
        {isDateTime && (
          <>
            <Form.Item name="min" label="Min date/time">
              <DatePicker showTime />
            </Form.Item>

            <Form.Item name="max" label="Max date/time">
              <DatePicker showTime />
            </Form.Item>

            <Form.Item name="notInFuture" valuePropName="checked">
              <Checkbox>Not in future</Checkbox>
            </Form.Item>

            <Form.Item name="notInPast" valuePropName="checked">
              <Checkbox>Not in past</Checkbox>
            </Form.Item>

            <Form.Item name="timeFormat" label="Time format">
              <Select>
                <Select.Option value="24">24-hour</Select.Option>
                <Select.Option value="12">12-hour (AM/PM)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="showSeconds" valuePropName="checked">
              <Checkbox>Show seconds</Checkbox>
            </Form.Item>

            <Form.Item name="timezone" label="Timezone (IANA, optional)">
              <Input placeholder="e.g. America/New_York" />
            </Form.Item>
          </>
        )}

        {isMatrix && (
          <>
            <Form.Item name="columnsJson" label="Columns (JSON)">
              <Input.TextArea
                rows={6}
                placeholder='[{"label":"Result","type":"choice","options":["Pass","Fail","N/A"]}, ...]'
              />
            </Form.Item>

            <Form.Item name="rowsJson" label="Rows (JSON or newline labels)">
              <Input.TextArea
                rows={4}
                placeholder='["Skill A","Skill B"] or [{"label":"Skill A","id":"row_..."}]'
              />
            </Form.Item>

            <Form.Item name="cellsJson" label="Initial cells (optional JSON)">
              <Input.TextArea
                rows={4}
                placeholder='{"row_id": {"col_id": "value"}}'
              />
            </Form.Item>
          </>
        )}

        {isFile && (
          <>
            <Form.Item
              name="allowedTypes"
              label="Allowed types (comma separated MIME or .ext)"
            >
              <Input placeholder="application/pdf,image/jpeg,.png" />
            </Form.Item>
            <Form.Item name="maxSizeMB" label="Max size (MB)">
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="maxCount" label="Max files">
              <InputNumber min={1} />
            </Form.Item>
          </>
        )}

        {isSignature && (
          <>
            <Form.Item name="mode" label="Default mode">
              <Select>
                <Select.Option value="draw">Draw</Select.Option>
                <Select.Option value="type">Type</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="requireSignerName" valuePropName="checked">
              <Checkbox>Require signer name</Checkbox>
            </Form.Item>
          </>
        )}

        {editingNode?.type === 'lookupField' && (
          <>
            <Form.Item
              name="lookupEndpoint"
              label="Lookup endpoint (GET)"
              tooltip="Server endpoint used for remote search. Should accept ?q=..&limit=.. and optionally ?ids=.."
              rules={[
                {
                  validator(_, value) {
                    if (!value) return Promise.resolve();
                    try {
                      new URL(value, window.location.origin);
                      return Promise.resolve();
                    } catch {
                      return Promise.reject(new Error('Invalid URL'));
                    }
                  },
                },
              ]}
            >
              <Input placeholder="/api/search/users" />
            </Form.Item>

            <Form.Item
              name="selectedFetchParam"
              label="Selected fetch param (optional)"
            >
              <Input placeholder="e.g. ids or id (server must support resolving by id)" />
            </Form.Item>

            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="mode" label="Mode" initialValue="single">
                  <Select>
                    <Select.Option value="single">Single</Select.Option>
                    <Select.Option value="multiple">Multiple</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col span={8}>
                <Form.Item name="minChars" label="Min chars" initialValue={2}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>

              <Col span={8}>
                <Form.Item name="pageSize" label="Page size" initialValue={20}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {/* <Form.Item name="placeholder" label="Placeholder">
              <Input placeholder="Search…" />
            </Form.Item> */}

            <Form.Item name="labelField" label="Label field (optional)">
              <Input placeholder="e.g. full_name" />
            </Form.Item>

            <Form.Item name="metaField" label="Meta field (optional)">
              <Input placeholder="e.g. unit or email" />
            </Form.Item>
          </>
        )}

        {editingNode?.type === 'addressField' && (
          <>
            <Divider orientation="left">Address / Location</Divider>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="mapEnabled"
                  valuePropName="checked"
                  label="Enable map picker"
                >
                  <Switch />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item name="label" label="Label">
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="street" label="Street">
              <Input />
            </Form.Item>

            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="city" label="City">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="state" label="State / Region">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="postalCode" label="Postal Code">
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="country" label="Country">
              <Input />
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="lat" label="Latitude">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="lng" label="Longitude">
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="formatted" label="Formatted address (optional)">
              <Input.TextArea rows={2} />
            </Form.Item>
          </>
        )}

        {type === 'section' && (
          <>
            <Form.Item name="label" label="Label">
              <Input />
            </Form.Item>
            <Form.Item
              name="showIf"
              label="Show-if condition"
              tooltip="Use fieldId variables"
            >
              <Input />
            </Form.Item>
            <Form.Item name="collapsible" valuePropName="checked">
              <Switch /> Collapsible
            </Form.Item>
            <Form.Item name="collapsed" valuePropName="checked">
              <Switch /> Start collapsed
            </Form.Item>
            <Form.Item name="gated" valuePropName="checked">
              <Switch /> Gated
            </Form.Item>
          </>
        )}

        {type === 'repeater' && (
          <>
            <Form.Item name="label" label="Label">
              <Input />
            </Form.Item>
            <Form.Item name="min" label="Min instances">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="max" label="Max instances (optional)">
              <InputNumber min={1} />
            </Form.Item>

            <Divider />

            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">
                Template: select nodes in the editor (authoring mode), then
                capture selection to set the template used when adding new
                instances.
              </Text>
            </div>

            <Form.Item>
              <Space>
                <Button onClick={onCaptureTemplate}>
                  Capture selection as template
                </Button>
                <Button
                  onClick={() => {
                    editingNode?.updateAttributes({
                      ...editingNode.attrs,
                      template: null,
                    });
                    modal.success({ title: 'Cleared' });
                  }}
                >
                  Clear template
                </Button>
              </Space>
            </Form.Item>
          </>
        )}

        {type === 'staticContent' && (
          <>
            <Form.Item name="type" label="Type">
              <Input />
            </Form.Item>
            <Form.Item name="icon" label="Icon (text)">
              <Input />
            </Form.Item>
            <Form.Item name="title" label="Title">
              <Input />
            </Form.Item>
            <Form.Item name="body" label="Body">
              <TextArea rows={4} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
    </>
  );
};

export default EditModal;
