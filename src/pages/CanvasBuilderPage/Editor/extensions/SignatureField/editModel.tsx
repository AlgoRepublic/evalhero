import { Checkbox, Form, Modal, Select } from 'antd';
// import TagSelector from '../../components/TagSelector';

const SignatureEditModal = ({
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
      title="Edit Signature Field"
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Save"
      cancelText="Cancel"
      destroyOnHidden
      maskClosable={false}
      width={480}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={nodeAttrs}
        onFinish={onSave}
      >
        <Form.Item
          name="mode"
          label="Default Signature Mode"
          tooltip="Choose the default signature method when users open the signature dialog"
        >
          <Select>
            <Select.Option value="draw">Draw (Hand-drawn signature)</Select.Option>
            <Select.Option value="type">Type (Name + timestamp)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="requireSignerName" valuePropName="checked">
          <Checkbox>
            Require signer name
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              Users must provide their name before signing
            </div>
          </Checkbox>
        </Form.Item>

        {/* <Form.Item name="tags" label="Tags">
          <TagSelector placeholder="Select tags for this field" />
        </Form.Item> */}
      </Form>
    </Modal>
  );
};

export default SignatureEditModal;
