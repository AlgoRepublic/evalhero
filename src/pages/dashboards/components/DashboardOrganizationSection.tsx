import {
  Avatar,
  Button,
  Col,
  Form,
  Grid,
  Input,
  InputNumber,
  message,
  Row,
  theme,
  Tooltip,
  Upload,
  UploadFile,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import {
  UpdateOrganizationDto,
  useGetOrganizationQuery,
  useUpdateOrganizationMutation,
} from '../../../services/orgApi';
import { useLazyGetAssetUrlQuery } from '../../../services/assetsApi';
import { useAppSelector } from '../../../hooks';
import { useLazyGetUserInfoQuery } from '../../../services/authApi';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../../features/auth/authSlice';
import { usePermission } from '../../../hooks/usePermission';

const { useBreakpoint } = Grid;

const DashboardOrganizationSection = () => {
  const [file, setFile] = useState<UploadFile | null>(null);
  const [form] = Form.useForm();
  const dispatch = useDispatch();

  const [updateOrganization, { isLoading: isUpdatingOrg }] =
    useUpdateOrganizationMutation();
  const { selectedProfile, user } = useAppSelector((state) => state.auth);
  const canEdit = usePermission('organization::edit');
  const isAdmin = user?.isAdmin === true;

  const [getUserInfo] = useLazyGetUserInfoQuery();

  const { data: org } = useGetOrganizationQuery(
    selectedProfile?.organization?._id || '',
    {
      skip: !selectedProfile?.organization?._id,
    }
  );
  const [getAssetUrl] = useLazyGetAssetUrlQuery();
  const screens = useBreakpoint();
  const isMobile = !screens.md; // Below md (768px) is mobile

  // When org is loaded, set form name and resolve icon URL (fetch signed URL only after we have org)
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
        (async () => {
          try {
            const result = await getAssetUrl(icon);
            const url = result.data;
            if (url) {
              setFile({
                uid: '-1',
                name: 'existing-logo.png',
                status: 'done',
                thumbUrl: url,
              });
            }
          } catch {
            setFile(null);
          }
        })();
      } else {
        setFile(null);
      }
    } else {
      setFile(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getAssetUrl is stable from RTK Query
  }, [org?.data?.organization?._id, org?.data?.organization?.icon, org?.data?.organization?.name, org?.data?.organization?.wasabiStorage?.limitMb, form]);

  const { token } = theme.useToken();

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

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const obj: UpdateOrganizationDto = {
        id: org?.data.organization._id || '',
        name: values.name,
      };

      if (file?.originFileObj) {
        obj.icon = file.originFileObj as File;
      }
      if (isAdmin && values.wasabiStorageLimit != null) {
        obj.wasabiStorageLimit = Math.floor(Number(values.wasabiStorageLimit));
      }

      await updateOrganization(obj).unwrap();
      message.success('Organization updated successfully!');

      try {
        const { data, success } = await getUserInfo().unwrap();
        if (success) {
          dispatch(
            setCredentials({
              user: data.user,
              profiles: data.profiles,
            })
          );
        }
      } catch (error) {
        console.error('Failed to refresh user info', error);
      }
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to update organization';
      message.error(errMsg);
    }
  };

  const avatarSize = isMobile ? 60 : 80;
  const iconSize = isMobile ? 24 : 32;

  return (
    <Row
      align={isMobile ? 'top' : 'middle'}
      gutter={[isMobile ? 0 : 16, isMobile ? 16 : 0]}
      style={{
        padding: isMobile ? token.paddingMD : token.paddingLG,
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        marginTop: isMobile ? 12 : 16,
      }}
    >
      <Col 
        xs={24} 
        sm={24} 
        md={isMobile ? 24 : 'none'} 
        flex={isMobile ? undefined : 'none'} 
        style={{ textAlign: 'center' }}
      >
        {canEdit ? (
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
                  width: avatarSize,
                  height: avatarSize,
                  margin: '0 auto',
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
                    size={avatarSize * 1.5}
                    shape="circle"
                    style={{ objectFit: 'contain' }}
                  />
                ) : (
                  <UploadOutlined
                    style={{
                      fontSize: iconSize,
                      color: token.colorTextQuaternary,
                    }}
                  />
                )}
              </div>
            </Tooltip>
          </Upload>
        ) : (
          <div
            style={{
              position: 'relative',
              width: avatarSize,
              height: avatarSize,
              margin: '0 auto',
              borderRadius: '50%',
              overflow: 'hidden',
              border: `2px solid ${token.colorBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: token.colorBgContainer,
            }}
          >
            {file ? (
              <Avatar
                src={file.thumbUrl || file.url}
                size={avatarSize * 1.5}
                shape="circle"
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <UploadOutlined
                style={{
                  fontSize: iconSize,
                  color: token.colorTextQuaternary,
                }}
              />
            )}
          </div>
        )}
      </Col>

      <Col 
        xs={24} 
        sm={24} 
        md={isMobile ? 24 : undefined} 
        flex={isMobile ? undefined : '9'} 
        style={{ padding: isMobile ? 0 : '0 16px' }}
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item
            label="Organization Name"
            name="name"
            rules={[
              {
                required: true,
                message: 'Please enter organization name',
              },
            ]}
            style={{ marginBottom: isMobile ? 12 : 0 }}
          >
            <Input
              placeholder="Enter organization name"
              size={isMobile ? 'middle' : 'large'}
              disabled={!canEdit}
              readOnly={!canEdit}
            />
          </Form.Item>
          {canEdit && isAdmin && (
            <Form.Item
              label="Wasabi storage limit (MB)"
              name="wasabiStorageLimit"
              help="Storage quota in MB. Leave empty to keep current limit."
              rules={[
                { type: 'number', min: 0, message: 'Must be 0 or greater' },
              ]}
              style={{ marginBottom: isMobile ? 24 : 12, marginTop: isMobile ? 24 : 12 }}
            >
              <InputNumber
                min={0}
                step={1}
                precision={0}
                placeholder="e.g. 100"
                style={{ width: '100%' }}
                size={isMobile ? 'middle' : 'large'}
                disabled={!canEdit}
              />
            </Form.Item>
          )}
        </Form>
      </Col>

      {canEdit && (
        <Col 
          xs={24} 
          sm={24} 
          md={isMobile ? 24 : undefined} 
          flex={isMobile ? undefined : '100px'} 
          style={{ 
            textAlign: isMobile ? 'left' : 'right', 
            marginTop: isMobile ? 0 : 32 
          }}
        >
          <Button
            type="primary"
            htmlType="submit"
            size={isMobile ? 'middle' : 'large'}
            loading={isUpdatingOrg}
            onClick={() => form.submit()}
            block={isMobile}
            style={{ minWidth: isMobile ? '100%' : 100 }}
          >
            Save
          </Button>
        </Col>
      )}
    </Row>
  );
};

export default DashboardOrganizationSection;
