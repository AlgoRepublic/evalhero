import { useState } from 'react';
import {
  Modal,
  Form,
  Grid,
  Input,
  Button,
  Space,
  Typography,
  theme,
  Collapse,
  message,
  Select,
  Popconfirm,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  MailOutlined,
  PhoneOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useGetDepartmentsQuery } from '../../../services/departmentApi';
import { useGetLocationsQuery } from '../../../services/locationsApi';
import { useGetRolesQuery } from '../../../services/roleApi';
import {
  InviteUserRequest,
  useCheckInviteableMutation,
  useSendInviteMutation,
} from '../../../services/inviteApi';

const { useBreakpoint } = Grid;

const { Text } = Typography;

const PHONE_E164_REGEX = /^\+[0-9]{10,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeIdentifier(value: string): { email?: string; phone?: string } {
  const trimmed = value.trim();
  if (EMAIL_REGEX.test(trimmed)) return { email: trimmed };
  if (PHONE_E164_REGEX.test(trimmed)) return { phone: trimmed };
  return {};
}

function getInviteLabel(item: InviteUserRequest): string {
  return item.email ?? item.phone ?? '';
}

/** Remove departments, roles, locations from item when they are empty arrays. */
function sanitizeInviteItem(item: InviteUserRequest): InviteUserRequest {
  const result: InviteUserRequest = {};
  if (item.email) result.email = item.email;
  if (item.phone) result.phone = item.phone;
  if (Array.isArray(item.departments) && item.departments.length > 0)
    result.departments = item.departments;
  if (Array.isArray(item.roles) && item.roles.length > 0)
    result.roles = item.roles;
  if (Array.isArray(item.locations) && item.locations.length > 0)
    result.locations = item.locations;
  return result;
}

interface InviteUserModalProps {
  open: boolean;
  onCancel: () => void;
  onInvite: () => void;
}

export default function InviteUserModal({
  open,
  onCancel,
  onInvite,
}: InviteUserModalProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // Below md (768px) is mobile
  const [form] = Form.useForm();
  const [inviteItems, setInviteItems] = useState<InviteUserRequest[]>([]);
  const { token } = theme.useToken();

  const { data: departments, isLoading: departmentLoading } =
    useGetDepartmentsQuery();
  const { data: locations, isLoading: locationLoading } =
    useGetLocationsQuery();
  const { data: roles, isLoading: roleLoading } = useGetRolesQuery();

  const [checkInviteable, { isLoading: isChecking }] =
    useCheckInviteableMutation();
  const [sendInvite, { isLoading: isSending }] = useSendInviteMutation();

  const handleAddUser = async () => {
    try {
      const { identifier } = await form.validateFields(['identifier']);
      const trimmed = (identifier || '').trim();
      if (!trimmed) return;

      const parsed = normalizeIdentifier(trimmed);
      if (!parsed.email && !parsed.phone) {
        return message.error(
          'Invalid format. Use email (e.g. user@example.com) or phone in E.164 (e.g. +15551234567)'
        );
      }

      const key = parsed.email ?? parsed.phone ?? '';
      const isAlreadyExist = inviteItems.some(
        (e) => (e.email && e.email === key) || (e.phone && e.phone === key)
      );
      if (isAlreadyExist) {
        return message.error('This email or phone is already in the list');
      }

      if (parsed.email) {
        await checkInviteable({ email: parsed.email }).unwrap();
      }
      // For phone invites we skip inviteable check (backend may not support it)

      setInviteItems([
        ...inviteItems,
        {
          ...parsed,
          departments: [],
          roles: [],
          locations: [],
        },
      ]);
      form.resetFields(['identifier']);
    } catch (err) {
      const errObj = err as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Error validating email or phone';
      message.error(errMsg);
    }
  };

  const handleRemoveItem = (item: InviteUserRequest) => {
    const key = item.email ?? item.phone ?? '';
    setInviteItems(inviteItems.filter(
      (e) => (e.email ?? e.phone ?? '') !== key
    ));
  };

  const handleInvite = async () => {
    try {
      const items = inviteItems.map(sanitizeInviteItem);
      await sendInvite({ items }).unwrap();
      onInvite();
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Failed to invite users';
      message.error(errMsg);
    }
  };

  return (
    <Modal
      open={open}
      title="Invite User"
      onCancel={onCancel}
      footer={null}
      centered
      width={isMobile ? '95%' : 600}
      styles={{
        body: {
          background: token.colorBgContainer,
          padding: isMobile ? token.paddingXS : token.paddingSM,
          borderRadius: token.borderRadiusLG,
        },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        // wrapperCol={{ span: 16 }}
        className="no-margin-form"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <Form.Item
          label="Email or Phone Number"
          name="identifier"
          rules={[
            {
              validator: (_, value) => {
                const v = (value ?? '').trim();
                if (!v) return Promise.resolve();
                const p = normalizeIdentifier(v);
                if (p.email || p.phone) return Promise.resolve();
                return Promise.reject(
                  new Error('Use email (user@example.com) or E.164 phone (+15551234567)')
                );
              },
            },
          ]}
          style={{ width: '100%' }}
          help="Format: email or +15551234567"
        >
          <Input
            placeholder="user@example.com or +15551234567"
            onPressEnter={handleAddUser}
            size={isMobile ? 'middle' : 'large'}
          />
        </Form.Item>

        <Button
          type="primary"
          size={isMobile ? 'middle' : 'large'}
          block
          icon={<PlusOutlined />}
          onClick={handleAddUser}
          loading={isChecking}
          disabled={isChecking}
          style={{
            marginTop: isMobile ? '12px' : '16px',
          }}
        >
          Add User
        </Button>

        {inviteItems.map((user) => (
          <Collapse
            key={getInviteLabel(user)}
            defaultActiveKey={['1']}
            expandIconPosition="end"
            expandIcon={({ isActive }) => (
              <DownOutlined rotate={isActive ? 180 : 0} />
            )}
            style={{
              marginTop: isMobile ? '12px' : '16px',
              width: '100%',
            }}
            size={isMobile ? 'small' : 'large'}
            items={[
              {
                key: '1',
                label: (
                  <Space
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text
                      strong
                      style={{
                        fontSize: isMobile ? '13px' : undefined,
                        wordBreak: 'break-word',
                      }}
                    >
                      {user.email && <><MailOutlined style={{ marginRight: 6 }} />{user.email}</>}
                      {user.email && user.phone && ' • '}
                      {user.phone && <><PhoneOutlined style={{ marginRight: 6 }} />{user.phone}</>}
                      {!user.email && !user.phone && '—'}
                    </Text>
                    <Popconfirm
                      title="Remove this user from the list?"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleRemoveItem(user);
                      }}
                      onPopupClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="primary"
                        danger
                        size={isMobile ? 'small' : 'middle'}
                        icon={
                          <DeleteOutlined style={{ color: token.colorWhite }} />
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </Space>
                ),
                children: (
                  <Space
                    size={isMobile ? 'small' : 'middle'}
                    direction="vertical"
                    style={{ width: '100%' }}
                  >
                    <Form.Item label="Departments">
                      <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        size={isMobile ? 'middle' : 'large'}
                        loading={departmentLoading}
                        options={departments?.data?.departments?.records.map(
                          (d) => ({
                            label: d.name,
                            value: d._id,
                          })
                        )}
                        value={user.departments}
                        onChange={(val) =>
                          setInviteItems((prev) =>
                            prev.map((e) =>
                              (e.email ?? e.phone) === (user.email ?? user.phone)
                                ? { ...e, departments: val }
                                : e
                            )
                          )
                        }
                        optionFilterProp="label"
                        filterSort={(optionA, optionB) =>
                          (optionA?.label ?? '')
                            .toLowerCase()
                            .localeCompare((optionB?.label ?? '').toLowerCase())
                        }
                      />
                    </Form.Item>

                    <Form.Item label="Roles">
                      <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        size={isMobile ? 'middle' : 'large'}
                        loading={roleLoading}
                        options={roles?.data?.roles?.records.map((r) => ({
                          label: r.name,
                          value: r._id,
                        }))}
                        value={user.roles}
                        onChange={(val) =>
                          setInviteItems((prev) =>
                            prev.map((e) =>
                              (e.email ?? e.phone) === (user.email ?? user.phone)
                                ? { ...e, roles: val }
                                : e
                            )
                          )
                        }
                        optionFilterProp="label"
                        filterSort={(optionA, optionB) =>
                          (optionA?.label ?? '')
                            .toLowerCase()
                            .localeCompare((optionB?.label ?? '').toLowerCase())
                        }
                      />
                    </Form.Item>

                    <Form.Item label="Locations">
                      <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        size={isMobile ? 'middle' : 'large'}
                        loading={locationLoading}
                        options={locations?.data?.locations?.records?.map(
                          (l) => ({
                            label: l.name,
                            value: l._id,
                          })
                        )}
                        value={user.locations}
                        onChange={(val) =>
                          setInviteItems((prev) =>
                            prev.map((e) =>
                              (e.email ?? e.phone) === (user.email ?? user.phone)
                                ? { ...e, locations: val }
                                : e
                            )
                          )
                        }
                        optionFilterProp="label"
                        filterSort={(optionA, optionB) =>
                          (optionA?.label ?? '')
                            .toLowerCase()
                            .localeCompare((optionB?.label ?? '').toLowerCase())
                        }
                      />
                    </Form.Item>
                  </Space>
                ),
              },
            ]}
          />
        ))}
        {/* <Form.Item
          label="Invite Message"
          name="message"
          initialValue="Welcome [username], you've been invited to the [Organization]"
          style={{ marginTop: 24 }}
        >
          <TextArea rows={4} />
        </Form.Item> */}

        <Space
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={{
            width: '100%',
            justifyContent: isMobile ? 'stretch' : 'flex-end',
            marginTop: isMobile ? 12 : 16,
          }}
        >
          <Button 
            onClick={onCancel} 
            disabled={isSending}
            block={isMobile}
            size={isMobile ? 'middle' : 'large'}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            onClick={() => {
              form.validateFields().then(() => {
                handleInvite();
              });
            }}
            disabled={inviteItems.length === 0 || isSending}
            loading={isSending}
            block={isMobile}
            size={isMobile ? 'middle' : 'large'}
          >
            {isSending ? 'Inviting...' : 'Invite'}
          </Button>
        </Space>
      </Form>
    </Modal>
  );
}
