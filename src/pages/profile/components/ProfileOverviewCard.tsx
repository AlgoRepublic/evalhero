import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  FormInstance,
  Input,
  Row,
  Select,
  Space,
  Tag,
  theme,
  Typography,
  Upload,
  UploadFile,
} from 'antd';
import { UserOutlined, UploadOutlined, SaveOutlined, SafetyOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { Profile } from '../../../features/auth/authSlice';
import type { OtpDeliveryPreference } from '../../../types/auth';
import { OrganizationDetailsSection } from './OrganizationDetailsSection';
import dayjs from 'dayjs';

export interface ProfileOverviewCardProps {
  email?: string | null;
  phone?: string | null;
  /** Whether the profile's user is an admin */
  isAdmin: boolean;
  /** When true (logged-in user is admin), the Admin badge is shown if isAdmin is true */
  showAdminField?: boolean;
  isMobile: boolean;
  file: UploadFile | null;
  isUpdating: boolean;
  selectedProfile: Profile | null;
  roleMap: Map<string, string>;
  departmentMap: Map<string, string>;
  locationMap: Map<string, string>;
  form: FormInstance<{ name: string; otpDeliveryPreference: OtpDeliveryPreference }>;
  onFinish: (values: { name: string; otpDeliveryPreference: OtpDeliveryPreference }) => void;
  onFileChange: (fileList: UploadFile[]) => void;
  onFileRemove: () => void;
  beforeUpload: (file: File) => boolean | typeof Upload.LIST_IGNORE;
  onViewStats?: () => void;
  /** Open contact verification modal for email (add or edit). currentEmail passed when editing. */
  onEmailAction?: (currentEmail: string | null) => void;
  /** Open contact verification modal for phone (add or edit). currentPhone passed when editing. */
  onPhoneAction?: (currentPhone: string | null) => void;
}

export function ProfileOverviewCard({
  email,
  phone,
  isAdmin,
  showAdminField = false,
  isMobile,
  file,
  isUpdating,
  selectedProfile,
  roleMap,
  departmentMap,
  locationMap,
  form,
  onFinish,
  onFileChange,
  onFileRemove,
  beforeUpload,
  onEmailAction,
  onPhoneAction,
}: ProfileOverviewCardProps) {
  const { token } = theme.useToken();

  return (
    <Card
      size="small"
      styles={{
        body: {
          padding: isMobile ? token.paddingSM : token.paddingLG,
        },
      }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
        <Row gutter={isMobile ? [0, token.marginMD] : [token.marginLG, 0]} align={isMobile ? 'stretch' : 'top'}>
          <Col
            xs={24}
            md={8}
            lg={6}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isMobile ? 'center' : 'flex-start',
            }}
          >
            <Form.Item label="Photo" style={{ marginBottom: isMobile ? token.marginSM : 0 }}>
              <Upload
                beforeUpload={beforeUpload}
                multiple={false}
                maxCount={1}
                fileList={file ? [file] : []}
                onChange={({ fileList }) => onFileChange(fileList)}
                onRemove={onFileRemove}
                showUploadList={false}
                accept="image/*"
              >
                <div
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    padding: 4,
                    background: token.colorBorderSecondary,
                  }}
                >
                  <Avatar
                    src={file?.thumbUrl || file?.url}
                    size={isMobile ? 88 : 112}
                    icon={<UserOutlined />}
                    style={{
                      border: `3px solid ${token.colorBgContainer}`,
                      backgroundColor: token.colorPrimary,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      background: token.colorPrimary,
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px solid ${token.colorBgContainer}`,
                      cursor: 'pointer',
                    }}
                  >
                    <UploadOutlined style={{ fontSize: 12, color: '#fff' }} />
                  </div>
                </div>
              </Upload>
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                Max 2MB, image only
              </Typography.Text>
            </Form.Item>
          </Col>
          <Col xs={24} md={16} lg={18}>
            <Space direction="vertical" size={isMobile ? 'small' : 'middle'} style={{ width: '100%' }}>
              <Form.Item
                label={
                    <Flex gap="small" align="center" justify="flex-start">
                          <span style={{ fontWeight: 500 }}>Full name</span>
                          {showAdminField && isAdmin && (
                            <Tag color="gold" icon={<SafetyOutlined />} style={{ fontWeight: 600 }}>
                              Admin
                            </Tag>
                          )}
                    </Flex>
                }
                name="name"
                rules={[
                  { required: true, message: 'Please enter your name' },
                  { min: 2, message: 'Name must be at least 2 characters' },
                ]}
                style={{ marginBottom: 0 }}
              >
                <Input
                  placeholder="Enter your full name"
                  size={isMobile ? 'middle' : 'large'}
                  prefix={<UserOutlined />}
                  readOnly={isUpdating}
                />
              </Form.Item>
              <Form.Item
                label="OTP receive preference"
                name="otpDeliveryPreference"
                rules={[
                  { required: true, message: 'Please select OTP receive preference' },
                  () => ({
                    validator(_, value: OtpDeliveryPreference) {
                      const hasEmail = email != null && email.trim() !== '';
                      const hasPhone = phone != null && phone.trim() !== '';

                      if (!value) return Promise.resolve();
                      if (value === 'email' && !hasEmail) {
                        return Promise.reject(new Error('Add an email first to receive OTP via email'));
                      }
                      if (value === 'sms' && !hasPhone) {
                        return Promise.reject(new Error('Add a phone number first to receive OTP via SMS'));
                      }
                      if (value === 'both' && (!hasEmail || !hasPhone)) {
                        return Promise.reject(
                          new Error('Add both email and phone number to select the "Both" option')
                        );
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  size={isMobile ? 'middle' : 'large'}
                  disabled={isUpdating}
                  options={[
                    { label: 'Email', value: 'email' },
                    { label: 'SMS', value: 'sms' },
                    { label: 'Both', value: 'both' },
                  ]}
                />
              </Form.Item>

              <Space wrap size="small" style={{ marginTop: 4 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  size={isMobile ? 'middle' : 'large'}
                  loading={isUpdating}
                  style={{ fontWeight: 600 }}
                >
                  Save changes
                </Button>
                {/* {onViewStats && (
                  <Button
                    type="default"
                    icon={<BarChartOutlined />}
                    onClick={onViewStats}
                    size={isMobile ? 'middle' : 'large'}
                  >
                    View stats
                  </Button>
                )} */}
              </Space>

              <Row gutter={[token.marginSM, token.marginSM]}>
                <Col xs={24} sm={14}>
                  <Form.Item label="Email" style={{ marginBottom: 0 }}>
                    <Flex gap="small" align="center" wrap="wrap">
                      {email != null && email !== '' ? (
                        <>
                          <Input
                            value={email}
                            size={isMobile ? 'middle' : 'large'}
                            disabled
                            style={{ cursor: 'not-allowed', flex: 1, minWidth: 120 }}
                          />
                          {onEmailAction && (
                            <Button
                              type="default"
                              size={isMobile ? 'middle' : 'large'}
                              icon={<EditOutlined />}
                              onClick={() => onEmailAction(email)}
                            >
                              Edit
                            </Button>
                          )}
                        </>
                      ) : (
                        onEmailAction && (
                          <Button
                            type="default"
                            size={isMobile ? 'middle' : 'large'}
                            icon={<PlusOutlined />}
                            onClick={() => onEmailAction(null)}
                          >
                            Add Email
                          </Button>
                        )
                      )}
                    </Flex>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={14}>
                  <Form.Item label="Phone" style={{ marginBottom: 0 }}>
                    <Flex gap="small" align="center" wrap="wrap">
                      {phone != null && phone !== '' ? (
                        <>
                          <Input
                            value={phone}
                            size={isMobile ? 'middle' : 'large'}
                            disabled
                            style={{ cursor: 'not-allowed', flex: 1, minWidth: 120 }}
                          />
                          {onPhoneAction && (
                            <Button
                              type="default"
                              size={isMobile ? 'middle' : 'large'}
                              icon={<EditOutlined />}
                              onClick={() => onPhoneAction(phone)}
                            >
                              Edit
                            </Button>
                          )}
                        </>
                      ) : (
                        onPhoneAction && (
                          <Button
                            type="default"
                            size={isMobile ? 'middle' : 'large'}
                            icon={<PlusOutlined />}
                            onClick={() => onPhoneAction(null)}
                          >
                            Add Phone
                          </Button>
                        )
                      )}
                    </Flex>
                  </Form.Item>
                </Col>
              </Row>
            </Space>
          </Col>
        </Row>
      </Form>

      {selectedProfile && (
        <>
          <Divider style={{ margin: `${token.marginLG}px 0` }} />
          <Typography.Text strong style={{ display: 'block', marginBottom: token.marginSM, fontSize: 13 }}>
            Organization details
          </Typography.Text>
          <OrganizationDetailsSection
            profile={selectedProfile}
            isAdmin={isAdmin}
            roleMap={roleMap}
            departmentMap={departmentMap}
            locationMap={locationMap}
            isMobile={isMobile}
            createdAtFormatted={
              selectedProfile.createdAt
                ? dayjs(selectedProfile.createdAt).format('YYYY-MM-DD HH:mm')
                : '—'
            }
            updatedAtFormatted={
              selectedProfile.updatedAt
                ? dayjs(selectedProfile.updatedAt).format('YYYY-MM-DD HH:mm')
                : '—'
            }
          />
        </>
      )}
    </Card>
  );
}
