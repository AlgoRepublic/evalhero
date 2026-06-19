import { Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
// import TagSelector from '../../components/TagSelector';

const LookupEditModal = ({
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

        {/* <Form.Item name="tags" label="Tags">
          <TagSelector placeholder="Select tags for this field" />
        </Form.Item> */}
      </Form>
    </Modal>
  );
};

export default LookupEditModal;
