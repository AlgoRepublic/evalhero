import { useState } from 'react';
import { useStylesContext } from '../../../context';
import {
  Avatar,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Tooltip,
  Typography,
  Upload,
  UploadFile,
  message,
  theme,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useCreateOrganizationMutation } from '../../../services/orgApi';
import { useNavigate } from 'react-router-dom';
import { useLazyGetUserInfoQuery } from '../../../services/authApi';
import { useAppSelector } from '../../../hooks';

interface OrganizationFormValues {
  name: string;
  wasabiStorageLimit?: number;
}

const AddOrganization = () => {
  const [file, setFile] = useState<UploadFile | null>(null);
  const stylesContext = useStylesContext();
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.isAdmin === true;

  const [createOrg, { isLoading }] = useCreateOrganizationMutation();
  const [getUserInfo] = useLazyGetUserInfoQuery();

  const handleSubmit = async (values: OrganizationFormValues) => {
    try {
      const payload = {
        name: values.name,
        icon: file?.originFileObj as File,
        ...(isAdmin && values.wasabiStorageLimit != null && { wasabiStorageLimit: Math.floor(Number(values.wasabiStorageLimit)) }),
      };
      await createOrg(payload).unwrap();

      message.success('Organization created successfully');
      getUserInfo();
      navigate('/dashboard/organizations');
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to create organization';
      message.error(errMsg);
    }
  };

  const handleChange = ({ fileList }: { fileList: UploadFile[] }) => {
    if (fileList.length > 0) {
      const f = fileList[0];
      if (f.originFileObj) {
        f.thumbUrl = URL.createObjectURL(f.originFileObj);
      }
      setFile(f);
    } else {
      setFile(null);
    }
  };

  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  return (
    <Row {...stylesContext?.rowProps} justify="center">
      <Col xs={24} sm={20} md={16} lg={16} xl={12}>
        <Typography.Title
          level={3}
          style={{ textAlign: 'center', marginBottom: 24 }}
        >
          Add Organization
        </Typography.Title>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Row {...stylesContext?.rowProps} justify="center">
            <Upload
              beforeUpload={beforeUpload}
              multiple={false}
              maxCount={1}
              fileList={file ? [file] : []}
              onChange={handleChange}
              onRemove={() => setFile(null)}
              showUploadList={false}
              accept="image/*"
            >
              <Tooltip title={file ? 'Change file' : 'Upload file'}>
                <div
                  style={{
                    position: 'relative',
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: `2px dashed ${token.colorBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: token.colorBgContainer,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {file ? (
                    <Avatar
                      src={file.thumbUrl || file.url}
                      size={120}
                      shape="circle"
                      style={{ objectFit: 'contain' }}
                    />
                  ) : (
                    <UploadOutlined
                      style={{ fontSize: 32, color: token.colorTextQuaternary }}
                    />
                  )}

                  {/* {file && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: '50%',
                        padding: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <EditOutlined style={{ fontSize: 16, color: token.colorTextQuaternary }} />
                    </div>
                  )} */}
                </div>
              </Tooltip>
            </Upload>
          </Row>

          <Form.Item
            label="Organization Name"
            name="name"
            rules={[
              { required: true, message: 'Please enter organization name' },
            ]}
            style={{ marginTop: 16 }}
          >
            <Input
              placeholder="Enter organization name"
              size="large"
              style={{ height: 45 }}
              readOnly={isLoading}
            />
          </Form.Item>

          {isAdmin && (
            <Form.Item
              label="Wasabi storage limit (MB)"
              name="wasabiStorageLimit"
              help="Storage quota in MB. Default: 100 if left empty."
              rules={[
                { type: 'number', min: 0, message: 'Must be 0 or greater' },
              ]}
              style={{ marginBottom: 32 }}
            >
              <InputNumber
                min={0}
                step={1}
                precision={0}
                placeholder="e.g. 100 (default)"
                style={{ width: '100%' }}
                size="large"
                disabled={isLoading}
              />
            </Form.Item>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              style={{ height: 45, fontWeight: 600 }}
              loading={isLoading}
              aria-readonly={isLoading}
            >
              Create Organization
            </Button>
          </Form.Item>
        </Form>
      </Col>
    </Row>
  );
};

export default AddOrganization;
