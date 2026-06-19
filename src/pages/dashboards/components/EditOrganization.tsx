import { useEffect, useState } from 'react';
import { useStylesContext } from '../../../context';
import {
  Avatar,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  theme,
  Tooltip,
  Typography,
  Upload,
  UploadFile,
} from 'antd';
import { EditOutlined, UploadOutlined } from '@ant-design/icons';
import {
  useGetOrganizationQuery,
  useUpdateOrganizationMutation,
} from '../../../services/orgApi';
import { useLazyGetAssetUrlQuery } from '../../../services/assetsApi';
import { useNavigate, useParams } from 'react-router-dom';
import { useLazyGetUserInfoQuery } from '../../../services/authApi';
import { useAppSelector } from '../../../hooks';

interface OrganizationFormValues {
  name: string;
  wasabiStorageLimit?: number;
}

const EditOrganization = () => {
  const [file, setFile] = useState<UploadFile | null>(null);
  const stylesContext = useStylesContext();
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.isAdmin === true;

  const { data: org, isLoading } = useGetOrganizationQuery(id!);
  const [updateOrganization, { isLoading: isUpdating }] =
    useUpdateOrganizationMutation();
  const [getUserInfo] = useLazyGetUserInfoQuery();
  const [getAssetUrl] = useLazyGetAssetUrlQuery();

  useEffect(() => {
    if (!org?.data?.organization) return;
    const { icon, name, wasabiStorage } = org.data.organization;
    form.setFieldsValue({
      name,
      ...(wasabiStorage?.limitMb != null && { wasabiStorageLimit: wasabiStorage.limitMb }),
    });
    if (icon) {
      if (icon.startsWith('http://') || icon.startsWith('https://')) {
        setFile({
          uid: '-1',
          name: 'existing-logo.png',
          status: 'done',
          thumbUrl: icon,
        });
      } else if (!/^(image|image\/[\w+-]+)$/i.test(icon)) {
        setFile(null);
        getAssetUrl(icon)
          .then((result) => {
            const url = result.data;
            if (url) {
              setFile({
                uid: '-1',
                name: 'existing-logo.png',
                status: 'done',
                thumbUrl: url,
              });
            }
          })
          .catch(() => setFile(null));
      } else {
        setFile(null);
      }
    } else {
      setFile(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getAssetUrl is stable from RTK Query
  }, [org?.data?.organization?._id, org?.data?.organization?.icon, org?.data?.organization?.name, org?.data?.organization?.wasabiStorage?.limitMb, form]);

  const handleSubmit = async (values: OrganizationFormValues) => {
    try {
      const body: {
        id: string;
        name: string;
        icon?: File;
        wasabiStorageLimit?: number;
      } = {
        id: id!,
        name: values.name,
      };

      if (file?.originFileObj) {
        body.icon = file.originFileObj;
      }
      if (isAdmin && values.wasabiStorageLimit != null) {
        body.wasabiStorageLimit = Math.floor(Number(values.wasabiStorageLimit));
      }

      await updateOrganization(body).unwrap();
      getUserInfo();
      message.success('Organization updated successfully!');
      navigate('/dashboard/organizations');
    } catch (err) {
      const errObj = err as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to update organization';
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
          Update Organization
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

                  {file && (
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
                      <EditOutlined style={{ fontSize: 16, color: '#fff' }} />
                    </div>
                  )}
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
              help="Storage quota in MB. Leave empty to keep current limit."
              rules={[
                { type: 'number', min: 0, message: 'Must be 0 or greater' },
              ]}
            >
              <InputNumber
                min={0}
                step={1}
                precision={0}
                placeholder="e.g. 100"
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
              loading={isUpdating || isLoading}
              style={{ height: 45, fontWeight: 600 }}
              disabled={isLoading}
              aria-disabled={isLoading}
            >
              Update Organization
            </Button>
          </Form.Item>
        </Form>
      </Col>
    </Row>
  );
};

export default EditOrganization;
