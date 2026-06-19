import {
  Button,
  Col,
  Flex,
  Form,
  Input,
  message,
  Row,
  theme,
  Typography,
} from 'antd';
import { Logo } from '../../components';
import { useMediaQuery } from 'react-responsive';
import { PATH_AUTH } from '../../constants';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRequestOtpMutation } from '../../services/authApi';
import type { OtpDeliveryChannel, OtpDeliveryTargets } from '../../types/auth';

const { Title } = Typography;

// E.164: + followed by 10-15 digits
const PHONE_REGEX = /^\+[0-9]{10,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldType = {
  identifier?: string;
};

export const SignInPage = () => {
  const {
    token: { colorPrimary, colorBgContainer },
  } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 769 });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [requestOtp, { isLoading }] = useRequestOtpMutation();

  const onFinish = async (values: FieldType) => {
    const identifier = values.identifier?.trim();
    if (!identifier) return;

    try {
      const res = await requestOtp({ identifier }).unwrap();

      if (res.success && res.data?.sessionKey) {
        const fromParam = searchParams.get('from');
        const otpPath = fromParam
          ? `${PATH_AUTH.verifyOtp}?from=${encodeURIComponent(fromParam)}`
          : PATH_AUTH.verifyOtp;
        navigate(otpPath, {
          state: {
            identifier,
            sessionKey: res.data.sessionKey,
            deliveryChannels: res.data.deliveryChannels as OtpDeliveryChannel[] | undefined,
            deliveryTargets: res.data.deliveryTargets as OtpDeliveryTargets | undefined,
          },
        });
      } else {
        message.error(res.message || 'Failed to send code');
      }
    } catch (error) {
      const errObj = error as { data?: { message?: string } };
      const errMsg =
        errObj.data?.message ||
        'User not found. Please check your email/phone or contact support.';
      message.error(errMsg);
    }
  };

  const onFinishFailed = (errorInfo: unknown) => {
    console.log('Failed:', errorInfo);
  };

  return (
    <Row style={{ minHeight: isMobile ? 'auto' : '100vh', overflow: 'hidden' }}>
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
            Welcome Back
          </Title>
        </Flex>
      </Col>
      <Col xs={24} lg={12}>
        <Flex
          vertical
          align={isMobile ? 'center' : 'flex-start'}
          justify="center"
          gap="middle"
          style={{
            height: '100%',
            padding: '2rem',
            backgroundColor: colorBgContainer,
          }}
        >
          <Title className="m-0">Login</Title>
          <Form
            name="sign-in-form"
            layout="vertical"
            labelCol={{ span: 24 }}
            wrapperCol={{ span: 24 }}
            initialValues={{ identifier: '' }}
            onFinish={onFinish}
            onFinishFailed={onFinishFailed}
            autoComplete="off"
            requiredMark={false}
            style={{ width: '100%' }}
          >
            <Row gutter={[8, 0]}>
              <Col xs={24} lg={14}>
                <Form.Item<FieldType>
                  label="Email or Phone Number"
                  name="identifier"
                  rules={[
                    { required: true, message: 'Please enter your email or phone number' },
                    {
                      validator: (_, value) => {
                        const v = value?.trim() || '';
                        if (!v) return Promise.resolve();
                        if (EMAIL_REGEX.test(v)) return Promise.resolve();
                        if (PHONE_REGEX.test(v)) return Promise.resolve();
                        return Promise.reject(
                          new Error('Invalid format. Use email (e.g. user@example.com) or phone in E.164 (e.g. +15551234567)')
                        );
                      },
                    },
                  ]}
                >
                  <Input
                    size="large"
                    placeholder="email@example.com or +15551234567"
                    readOnly={isLoading}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="middle"
                loading={isLoading}
              >
                Send Code
              </Button>
            </Form.Item>
          </Form>
        </Flex>
      </Col>
    </Row>
  );
};
