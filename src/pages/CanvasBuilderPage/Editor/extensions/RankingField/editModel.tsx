import { Form, Input, Modal, Select, Switch, Popover, Button, Space, Checkbox } from 'antd';
// import TagSelector from '../../components/TagSelector';

const RankingEditModal = ({
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
  const watchedIconStyle = Form.useWatch('iconStyle', form);
  const watchedEmoji = Form.useWatch('emoji', form);

  const handleFinish = (values: any) => {
    // Normalize options: comma-separated string -> array of strings
    const raw = values.options;
    let normalizedOptions: string[] = Array.isArray(raw) ? raw : [];
    if (typeof raw === 'string') {
      normalizedOptions = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    // Rebuild order if options length changed or order invalid
    let nextOrder = nodeAttrs?.order;
    if (
      !Array.isArray(nextOrder) ||
      !Array.isArray(nodeAttrs?.options) ||
      (nodeAttrs?.options?.length ?? 0) !== normalizedOptions.length
    ) {
      nextOrder = normalizedOptions.map((l: string, i: number) => `${l}-${i}`);
    }
    onSave({
      ...nodeAttrs,
      ...values,
      options: normalizedOptions,
      order: nextOrder,
    });
  };

  const EMOJI_PRESET = [
    '⭐','👍','🔥','✅','🏆','🎯','💡','🚀','❤️','😊',
    '😎','👏','🙌','🤝','🧠','📌','📈','⚡','📝','🔧',
  ];

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
        <Form.Item
          name="options"
          label="Options (comma separated)"
          tooltip="Comma-separated list (order matters for ranking). For robust IDs use the option editor (todo)."
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="mode"
          label="Input Mode"
          tooltip="Use Drag & Drop or Numeric input to set ranks"
        >
          <Select
            options={[
              { label: 'Drag & Drop', value: 'drag' },
              { label: 'Numeric', value: 'numeric' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="iconStyle"
          label="Icon Style"
          tooltip="Choose the icon displayed with each item"
        >
          <Select
            options={[
              { label: 'Star', value: 'star' },
              { label: 'Emoji', value: 'emoji' },
            ]}
          />
        </Form.Item>

        {watchedIconStyle === 'emoji' && (
          <Form.Item
            name="emoji"
            label="Emoji (when Icon Style = Emoji)"
            tooltip="Pick an emoji or enter one manually, e.g., ⭐, 👍"
          >
            <Space.Compact>
              <Form.Item name="emoji" noStyle>
                <Input
                  placeholder="⭐"
                  maxLength={4}
                  style={{ width: 120 }}
                />
              </Form.Item>
              <Popover
                trigger="click"
                placement="bottomLeft"
                content={
                  <div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(10, 1fr)',
                        gap: 6,
                      }}
                    >
                      {EMOJI_PRESET.map((e) => (
                        <Button
                          key={e}
                          type="text"
                          style={{ fontSize: 18, lineHeight: 1, padding: 4 }}
                          onClick={(ev) => {
                            form.setFieldsValue({ emoji: e });
                            (ev.currentTarget as HTMLElement).blur();
                          }}
                        >
                          {e}
                        </Button>
                      ))}
                    </div>
                  </div>
                }
              >
                <Button>
                  {watchedEmoji ? `Pick ${watchedEmoji}` : 'Select'}
                </Button>
              </Popover>
            </Space.Compact>
          </Form.Item>
        )}

        <Form.Item
          name="showSuffix"
          label="Show Suffix"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="suffixText"
          label="Suffix Text"
          tooltip='Shown after label when "Show Suffix" is enabled, e.g., (0/5)'
        >
          <Input placeholder="(0/5)" />
        </Form.Item>

        <Form.Item
          name="approvalRequired"
          valuePropName="checked"
          label=""
        >
          <Checkbox>Approval required before this value is accepted</Checkbox>
        </Form.Item>

        {/* <Form.Item name="rankingDescription" label="Description (optional)">
          <Input />
        </Form.Item> */}
        {/* <Form.Item>
          <Tooltip title="Ordering is done by dragging the items in-editor">
            <span style={{ color: '#888' }}>
              To change the option labels, edit the Options field above.
            </span>
          </Tooltip>
        </Form.Item> */}

        {/* <Form.Item name="tags" label="Tags">
          <TagSelector placeholder="Select tags for this field" />
        </Form.Item> */}
      </Form>
    </Modal>
  );
};

export default RankingEditModal;
