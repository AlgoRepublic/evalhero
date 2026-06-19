import {
  Avatar,
  Button,
  Col,
  Flex,
  Form,
  Input,
  Result,
  Row,
  Spin,
  Upload,
  message,
  Typography,
  theme,
  Tooltip,
  UploadFile,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { Logo, AssetAvatar } from '../../components';
import { useParams, useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { useEffect, useState } from 'react';
import {
  useValidateInviteQuery,
  useConfirmInviteMutation,
} from '../../services/inviteApi';
import { PATH_AUTH } from '../../constants';

const { Title, Text } = Typography;

type UserFormType = {
  name: string;
  email?: string;
  avatar?: File;
};

export const InviteConfirmPage = () => {
  const {
    token: { colorPrimary, colorBgContainer, colorBorder, colorTextQuaternary },
  } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 991 });
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const {
    data: validateRes,
    error,
    isLoading,
  } = useValidateInviteQuery(
    { inviteId: inviteId! },
    {
      skip: !inviteId,
    }
  );

  const [confirmInvite, { isLoading: confirming }] = useConfirmInviteMutation();
  const [file, setFile] = useState<UploadFile | null>(null);

  useEffect(() => {
    if (validateRes?.data?.user) {
      const u = validateRes.data.user;
      form.setFieldValue('name', u.name);
      form.setFieldValue('email', u.email ?? u.phone ?? '');

    } else {
      const inv = validateRes?.data?.invite;
      form.setFieldValue('email', inv?.email ?? inv?.phone ?? '');
    }
  }, [validateRes]);

  const onFinish = async (values: UserFormType) => {
    try {
      const body = {
        name: values.name,
        avatar: values.avatar,
      };
      await confirmInvite({ inviteId: inviteId!, body }).unwrap();
      message.success('Joined organization successfully.');
      navigate(PATH_AUTH.signin);
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Something went wrong';
      message.error(errMsg);
    }
  };

  const handleAcceptExistingInvite = async () => {
    try {
      // if (!validateRes?.data?.user) {
      //   message.error('Invite user data is not available');
      //   return;
      // }
      // const user = validateRes.data.user;
      // const body = {
      //   name: user.name ?? '',
      //   email: user.email ?? '',
      //   password: '123456',
      // };
      await confirmInvite({ inviteId: inviteId! }).unwrap();
      message.success('Joined organization successfully.');
      navigate(PATH_AUTH.signin);
    } catch (err) {
      const errObj = err as { data?: { message?: string } };
      const errMsg = errObj.data?.message || 'Something went wrong';
      message.error(errMsg);
    }
  };

  const handleChange = ({ fileList }: { fileList: UploadFile[] }) => {
    if (fileList.length > 0) {
      const f = fileList[0];
      if (f.originFileObj) {
        f.thumbUrl = URL.createObjectURL(f.originFileObj);
        // Set the avatar field in the form
        form.setFieldValue('avatar', f.originFileObj);
      }
      setFile(f);
    } else {
      setFile(null);
      form.setFieldValue('avatar', undefined);
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

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (error || validateRes?.data?.invite?.status !== 'pending') {
    return (
      <Row style={{ minHeight: '100vh', overflow: 'hidden' }}>
        <Col xs={24} lg={12}>
          <Flex
            vertical
            align="center"
            justify="center"
            className="text-center"
            style={{
              background: colorPrimary,
              height: '100%',
              padding: '1rem',
            }}
          >
            <Logo color="white" />
            <Title level={2} className="text-white">
              Eval Hero
            </Title>
          </Flex>
        </Col>
        <Col xs={24} lg={12}>
          <Flex
            vertical
            align="center"
            justify="center"
            style={{
              height: '100%',
              padding: '2rem',
              backgroundColor: colorBgContainer,
            }}
          >
            <Result
              status="404"
              title="Invalid Invite"
              subTitle="This invite link is invalid or has expired."
            />
          </Flex>
        </Col>
      </Row>
    );
  }

  const invite = validateRes?.data;

  return (
    <Row
      style={{
        minHeight: '100vh',
        overflow: 'hidden',
        background: colorBgContainer,
      }}
      justify={isMobile ? 'center' : 'start'}
    >
      {/* Left Side */}
      <Col xs={24} lg={12}>
        <Flex
          vertical
          align="center"
          justify="center"
          className="text-center"
          style={{ background: colorPrimary, height: '100%', padding: '1rem' }}
        >
          <Logo color="white" />
          <Title level={2} className="text-white">
            Welcome to Eval Hero
          </Title>
        </Flex>
      </Col>

      {/* Right Side */}
      <Col xs={24} lg={12} style={{ height: isMobile ? 'auto' : '100vh' }}>
        <Flex
          vertical
          align={isMobile ? 'center' : 'flex-start'}
          justify={isMobile ? 'flex-start' : 'center'}
          gap="middle"
          style={{
            height: '100%',
            // width: '100%',
            padding: '2rem',
            background: colorBgContainer,
          }}
        >
          {invite?.user && invite?.invite.organization ? (
            <>
              <Title className="m-0">Join Organization</Title>
              <Flex
                vertical
                align={isMobile ? 'center' : 'flex-start'}
                gap="small"
                style={{ width: '100%' }}
              >
                <AssetAvatar
                  avatarKey={invite?.invite.organization?.icon}
                  fallback={invite?.invite.organization?.name?.charAt(0)}
                  size={80}
                />
                <Title level={4}>
                  {invite?.user?.name} - {invite?.user?.email ?? invite?.user?.phone ?? invite?.invite?.email ?? invite?.invite?.phone}
                </Title>
                <Text type="secondary">
                  Organization: {invite?.invite?.organization?.name}
                </Text>
                <Button
                  type="primary"
                  size="large"
                  loading={confirming}
                  onClick={handleAcceptExistingInvite}
                >
                  Join Organization
                </Button>
              </Flex>
            </>
          ) : (
            <>
              <Title className="m-0">Complete Your Profile</Title>
              <Text>Set your username and optionally add a profile picture to continue.</Text>
              <Form<UserFormType>
                layout="vertical"
                style={{}}
                labelCol={{ span: 24 }}
                wrapperCol={{ span: 24 }}
                onFinish={onFinish}
                requiredMark={false}
                form={form}
              >
                <Row gutter={[8, 0]}>
                  <Col xs={24} lg={16}>
                    <Form.Item name="avatar" label="Profile Picture (optional)">
                      <Row justify={isMobile ? 'center' : 'center'}>
                        <Upload
                          beforeUpload={beforeUpload}
                          multiple={false}
                          maxCount={1}
                          fileList={file ? [file] : []}
                          onChange={handleChange}
                          onRemove={() => {
                            setFile(null);
                            form.setFieldValue('avatar', undefined);
                          }}
                          showUploadList={false}
                          accept="image/*"
                          style={{
                            marginBottom: 12,
                            marginTop: 12,
                            // marginLeft: isMobile ? 0 : '100%',
                          }}
                        >
                          <Tooltip title={file ? 'Change file' : 'Upload file'}>
                            <div
                              style={{
                                position: 'relative',
                                width: 100,
                                height: 100,
                                borderRadius: '50%',
                                overflow: 'hidden',
                                border: `2px dashed ${colorBorder}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                background: colorBgContainer,
                                transition: 'all 0.3s ease',
                              }}
                            >
                              {file ? (
                                <Avatar
                                  src={file.thumbUrl || file.url}
                                  size={100}
                                  shape="circle"
                                  style={{ objectFit: 'contain' }}
                                />
                              ) : (
                                <UploadOutlined
                                  style={{
                                    fontSize: 32,
                                    color: colorTextQuaternary,
                                  }}
                                />
                              )}
                            </div>
                          </Tooltip>
                        </Upload>
                      </Row>
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={16}>
                    <Form.Item
                      name="email"
                      label="Email or Phone"
                    >
                      <Input
                        placeholder="From invite"
                        style={{ width: '100%' }}
                        readOnly
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={16}>
                    <Form.Item
                      name="name"
                      label="Name"
                      rules={[{ required: true, message: 'Please input name' }]}
                    >
                      <Input
                        placeholder="Enter name"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Row justify={isMobile ? 'center' : 'start'}>
                      <Form.Item>
                        <Flex align="center" gap="small">
                          <Button
                            type="primary"
                            htmlType="submit"
                            size="middle"
                            loading={confirming}
                          >
                            Join Organization
                          </Button>
                          {/* <Button
                            type="text"
                            size="middle"
                            onClick={() => navigate('/')}
                          >
                            Cancel
                          </Button> */}
                        </Flex>
                      </Form.Item>
                    </Row>
                  </Col>
                </Row>
              </Form>
            </>
          )}
        </Flex>
      </Col>
    </Row>
  );
};
