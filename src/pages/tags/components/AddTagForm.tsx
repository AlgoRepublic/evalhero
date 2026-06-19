import React from 'react';
import {
  Button,
  Col,
  Form,
  Input,
  Row,
  Typography,
  message,
} from 'antd';
import { useAddTagMutation } from '../../../services/tagsApi';
import { useNavigate } from 'react-router-dom';
import { useStylesContext } from '../../../context';

const AddTagForm: React.FC = () => {
  const stylesContext = useStylesContext();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // RTK Query Mutations
  const [addTag, { isLoading: isCreating }] = useAddTagMutation();

  const handleSubmit = async (values: { name: string }) => {
    try {
      await addTag({ name: values.name }).unwrap();
      message.success('Tag created successfully');
      navigate('/tags');
    } catch (err: unknown) {
      console.error(err);
      let errMsg = 'Failed to save tag';
      if (typeof err === 'object' && err !== null) {
        const maybe = err as { data?: { message?: string } };
        errMsg = maybe?.data?.message ?? errMsg;
      } else if (typeof err === 'string') {
        errMsg = err;
      } else if (err instanceof Error) {
        errMsg = err.message;
      }
      message.error(errMsg);
    }
  };

  return (
    <Row {...stylesContext?.rowProps} justify="center">
      <Col xs={24} sm={22} md={18} lg={17} xl={16} xxl={12}>
        <Typography.Title
          level={3}
          style={{ textAlign: 'center', marginBottom: 24 }}
        >
          Add Tag
        </Typography.Title>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="Tag Name"
            name="name"
            rules={[
              { required: true, message: 'Please enter tag name' },
            ]}
          >
            <Input
              placeholder="Enter tag name"
              size="large"
              style={{ height: 45 }}
              readOnly={isCreating}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              style={{ height: 45, fontWeight: 600 }}
              loading={isCreating}
              aria-readonly={isCreating}
            >
              Create Tag
            </Button>
          </Form.Item>
        </Form>
      </Col>
    </Row>
  );
};

export default AddTagForm;

