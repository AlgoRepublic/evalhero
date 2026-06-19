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
import { useUpdateTagMutation, Tag } from '../../../services/tagsApi';
import { useNavigate } from 'react-router-dom';
import { useStylesContext } from '../../../context';

export const EditTagForm: React.FC<{
  tag: Tag;
}> = ({ tag }) => {
  const stylesContext = useStylesContext();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // RTK Query Mutations
  const [updateTag, { isLoading: isUpdating }] = useUpdateTagMutation();

  React.useEffect(() => {
    form.setFieldsValue({
      name: tag.name,
    });
  }, [tag, form]);

  const handleSubmit = async (values: { name: string }) => {
    try {
      await updateTag({
        id: tag._id,
        name: values.name,
      }).unwrap();
      message.success('Tag updated successfully');
      navigate('/tags');
    } catch (err: unknown) {
      console.error(err);
      let errMsg = 'Failed to update tag';
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
          Update Tag
        </Typography.Title>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          initialValues={{
            name: tag.name,
          }}
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
              readOnly={isUpdating}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              style={{ height: 45, fontWeight: 600 }}
              loading={isUpdating}
              aria-readonly={isUpdating}
            >
              Update Tag
            </Button>
          </Form.Item>
        </Form>
      </Col>
    </Row>
  );
};

