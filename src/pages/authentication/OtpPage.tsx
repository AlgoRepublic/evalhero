import { useEffect, useState } from 'react';
import { Button, Col, Form, Row, Typography, theme, message } from 'antd';
import { useMediaQuery } from 'react-responsive';
import { Input } from 'antd';
import { Logo } from '../../components';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  useVerifyOtpMutation,
  useRequestOtpMutation,
  useLazyGetUserInfoQuery,
} from '../../services/authApi';
import { api } from '../../services/api';
import { useDispatch } from 'react-redux';
import type { OtpDeliveryChannel, OtpDeliveryTargets } from '../../types/auth';

const { Title, Text } = Typography;

const RESEND_COOLDOWN_SEC = 30;
const OTP_EXPIRY_SEC = 5 * 60; // 5 minutes (display only)

export const OtpPage = () => {
  const {
    token: { colorPrimary, colorBgContainer },
  } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 769 });
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const state = location.state as
    | {
        identifier?: string;
        sessionKey?: string;
        deliveryChannels?: OtpDeliveryChannel[];
        deliveryTargets?: OtpDeliveryTargets;
      }
    | null;
  const [identifier] = useState<string>(() => state?.identifier ?? '');
  const [sessionKey, setSessionKey] = useState<string>(() => state?.sessionKey ?? '');
  const [deliveryChannels, setDeliveryChannels] = useState<OtpDeliveryChannel[]>(
    () => state?.deliveryChannels ?? []
  );
  const [deliveryTargets, setDeliveryTargets] = useState<OtpDeliveryTargets | null>(
    () => state?.deliveryTargets ?? null
  );

  const [verifyOtp, verifyOtpOptions] = useVerifyOtpMutation();
  const [requestOtp, requestOtpOptions] = useRequestOtpMutation();
  const [fetchUserInfo] = useLazyGetUserInfoQuery();

  const [resendTimer, setResendTimer] = useState<number>(RESEND_COOLDOWN_SEC);
  const [expiryTimer, setExpiryTimer] = useState<number>(OTP_EXPIRY_SEC);

  useEffect(() => {
    if (!state?.identifier || !state?.sessionKey) {
      message.error('Session expired. Please request a new code.');
      const fromParam = searchParams.get('from');
      const signinPath = fromParam
        ? `/auth/signin?from=${encodeURIComponent(fromParam)}`
        : '/auth/signin';
      navigate(signinPath);
    }
  }, [state?.identifier, state?.sessionKey, navigate, searchParams]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
      return () => clearInterval(t);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (expiryTimer > 0) {
      const t = setInterval(() => setExpiryTimer((prev) => prev - 1), 1000);
      return () => clearInterval(t);
    }
  }, [expiryTimer]);

  const loading = verifyOtpOptions.isLoading || requestOtpOptions.isLoading;

  const [otp, setOtp] = useState<string>('');

  const onFinish = async () => {
    if (otp.length !== 6 || !identifier || !sessionKey) {
      message.error('Please enter the 6-digit code');
      return;
    }

    try {
      const res = await verifyOtp({
        identifier,
        code: otp,
        sessionKey,
      }).unwrap();

      if (res.success) {
        // Call info API to load user and profiles, then redirect
        const infoRes = await fetchUserInfo().unwrap();
        if (infoRes.success) {
          message.success('Logged in successfully!');
          dispatch(api.util.invalidateTags(['Department', 'Role', 'Location']));

          const fromParam = searchParams.get('from');
          let redirectPath = '/dashboard';

          if (fromParam) {
            try {
              const decodedPath = decodeURIComponent(fromParam);
              if (decodedPath.startsWith('/') && !decodedPath.startsWith('//')) {
                redirectPath = decodedPath;
              }
            } catch (e) {
              console.error('Error decoding from parameter:', e);
            }
          }

          navigate(redirectPath);
        } else {
          message.error('Failed to load user info');
        }
      } else {
        message.error('OTP verification failed');
      }
    } catch (err) {
      const errorMessage =
        (err as { data?: { message?: string } })?.data?.message ||
        'Invalid code. Please try again.';
      message.error(errorMessage);
    }
  };

  const handleResendOtp = async () => {
    if (!identifier) return;
    try {
      const res = await requestOtp({ identifier }).unwrap();
      if (res.success && res.data?.sessionKey) {
        setSessionKey(res.data.sessionKey);
        setDeliveryChannels(res.data.deliveryChannels ?? []);
        setDeliveryTargets(res.data.deliveryTargets ?? null);
        setResendTimer(RESEND_COOLDOWN_SEC);
        setExpiryTimer(OTP_EXPIRY_SEC);
        message.success('New code sent!');
      } else {
        message.error(res.message || 'Failed to resend code');
      }
    } catch (err: unknown) {
      const errorMessage =
        (err as { data?: { message?: string } })?.data?.message ||
        'Failed to resend code. Please try again.';
      message.error(errorMessage);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const deliveryChannelText = (() => {
    if (deliveryChannels.length === 2) return 'email and phone';
    if (deliveryChannels[0] === 'email') return 'email';
    if (deliveryChannels[0] === 'sms') return 'phone';
    return 'email or phone';
  })();

  const deliveryTargetText = (() => {
    const targets: string[] = [];
    if (deliveryTargets?.email) targets.push(deliveryTargets.email);
    if (deliveryTargets?.phone) targets.push(deliveryTargets.phone);
    if (targets.length > 0) return targets.join(' and ');
    return identifier;
  })();

  if (!identifier || !sessionKey) {
    return null; // redirect in progress
  }

  return (
    <Row style={{ minHeight: isMobile ? 'auto' : '100vh', overflow: 'hidden' }}>
      <Col xs={24} lg={12}>
        <div
          style={{
            background: colorPrimary,
            height: '100%',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <Logo color="white" />
          <Text style={{ color: 'white', fontSize: 18 }}>
            Enter the 6-digit code sent to your {deliveryChannelText}
          </Text>
        </div>
      </Col>
      <Col xs={24} lg={12}>
        <div
          style={{
            height: '100%',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: isMobile ? 'center' : 'flex-start',
            gap: '1rem',
            background: colorBgContainer,
          }}
        >
          <Title style={{ margin: 0 }}>Enter Verification Code</Title>
          <Text type="secondary">
            We sent a code to: {deliveryTargetText}
          </Text>
          {expiryTimer > 0 && (
            <Text type="secondary">Code expires in {formatTime(expiryTimer)}</Text>
          )}
          <Form
            name="otp-form"
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
            style={{ width: '100%', maxWidth: 400 }}
          >
            <Form.Item
              label="OTP Code"
              name="otp"
              rules={[
                { required: true, message: 'Please enter the 6-digit code' },
                { len: 6, message: 'Code must be 6 digits' },
                { pattern: /^\d{6}$/, message: 'Code must be numeric' },
              ]}
            >
              <Input.OTP
                length={6}
                size="large"
                variant="outlined"
                onChange={(val: string) => setOtp(val)}
                value={otp}
                status={otp && otp.length < 6 ? 'error' : undefined}
                disabled={loading}
                autoFocus
              />
            </Form.Item>

            <Form.Item>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={verifyOtpOptions.isLoading}
                  disabled={otp.length !== 6 || loading}
                >
                  Verify Code
                </Button>
                <Button
                  type="link"
                  onClick={handleResendOtp}
                  disabled={loading || resendTimer > 0}
                  loading={requestOtpOptions.isLoading}
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                </Button>
              </div>
            </Form.Item>
          </Form>
        </div>
      </Col>
    </Row>
  );
};
