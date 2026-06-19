import { useState, useEffect } from 'react';
import { Button, Form, Input, message, Modal, Space } from 'antd';
import {
  useSendContactVerificationMutation,
  useVerifyContactVerificationMutation,
} from '../../../services/authApi';

/** E.164: + followed by 7–15 digits (e.g. +15551234567) */
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return value;
  if (value.trim().startsWith('+')) return `+${digits}`;
  if (digits.length <= 10) return `+1${digits}`;
  return `+${digits}`;
}

export type ContactType = 'email' | 'phone';

export interface ContactVerificationModalProps {
  open: boolean;
  type: ContactType;
  /** Current value when editing (optional). */
  currentValue?: string | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export function ContactVerificationModal({
  open,
  type,
  currentValue,
  onCancel,
  onSuccess,
}: ContactVerificationModalProps) {
  const [step, setStep] = useState<'enter' | 'verify'>('enter');
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [sendCode, { isLoading: isSending }] = useSendContactVerificationMutation();
  const [verifyCode, { isLoading: isVerifying }] = useVerifyContactVerificationMutation();

  const isEmail = type === 'email';
  const label = isEmail ? 'Email' : 'Phone number';
  const placeholder = isEmail ? 'user@example.com' : '+15551234567';

  const watchedValue = Form.useWatch(isEmail ? 'email' : 'phone', form);
  const hasNoChange =
    currentValue != null &&
    currentValue !== '' &&
    (isEmail
      ? (watchedValue ?? '').trim().toLowerCase() === currentValue.trim().toLowerCase()
      : normalizePhone((watchedValue ?? '').trim()) === normalizePhone(currentValue.trim()));

  useEffect(() => {
    if (!open) {
      setStep('enter');
      setSessionKey(null);
      form.resetFields();
      if (currentValue) {
        form.setFieldValue(isEmail ? 'email' : 'phone', currentValue);
      }
    }
  }, [open, type, currentValue, isEmail, form]);

  const handleSendCode = async () => {
    try {
      const values = await form.validateFields();
      const body = isEmail ? { email: values.email?.trim() } : { phone: normalizePhone(values.phone?.trim() || '') };
      const res = await sendCode(body).unwrap();
      if (res?.data?.sessionKey) {
        setSessionKey(res.data.sessionKey);
        setStep('verify');
        form.resetFields(['code']);
        message.success('Verification code sent.');
      }
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string };
      message.error(err?.data?.message || err?.message || 'Failed to send code.');
    }
  };

  const handleVerify = async () => {
    if (!sessionKey) return;
    try {
      const values = await form.validateFields();
      await verifyCode({ sessionKey, code: String(values.code).trim() }).unwrap();
      message.success('Contact verified and updated.');
      onSuccess();
      onCancel();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string };
      message.error(err?.data?.message || err?.message || 'Verification failed.');
    }
  };

  const handleCancel = () => {
    setStep('enter');
    setSessionKey(null);
    form.resetFields();
    onCancel();
  };

  const emailRules = [
    { required: true, message: 'Please enter your email.' },
    { type: 'email' as const, message: 'Please enter a valid email address.' },
  ];

  const phoneRules = [
    { required: true, message: 'Please enter your phone number.' },
    {
      pattern: E164_REGEX,
      message: 'Use E.164 format, e.g. +15551234567',
    },
  ];

  const codeRules = [
    { required: true, message: 'Please enter the 6-digit code.' },
    { len: 6, message: 'Code must be 6 digits.' },
  ];

  const loading = isSending || isVerifying;

  return (
    <Modal
      title={step === 'enter' ? (currentValue ? `Update ${label}` : `Add ${label}`) : `Verify ${label}`}
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnHidden
      width={400}
      maskClosable={!loading}
      closable={!loading}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {step === 'enter' && (
          <>
            {isEmail ? (
              <Form.Item name="email" label="Email" rules={emailRules} initialValue={currentValue ?? ''}>
                <Input placeholder={placeholder} size="large" autoComplete="email" />
              </Form.Item>
            ) : (
              <Form.Item
                name="phone"
                label="Phone number"
                rules={phoneRules}
                initialValue={currentValue ?? ''}
                getValueFromEvent={(e) => e.target.value}
                normalize={(v) => (typeof v === 'string' ? normalizePhone(v) : v)}
              >
                <Input placeholder={placeholder} size="large" autoComplete="tel" />
              </Form.Item>
            )}
            <Space style={{ marginTop: 16, width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button
                type="primary"
                onClick={handleSendCode}
                loading={loading}
                disabled={hasNoChange}
              >
                Send verification code
              </Button>
            </Space>
          </>
        )}
        {step === 'verify' && (
          <>
            <Form.Item name="code" label="Verification code" rules={codeRules}>
              <Input placeholder="123456" maxLength={6} size="large" autoComplete="one-time-code" />
            </Form.Item>
            <Space style={{ marginTop: 16, width: '100%', justifyContent: 'space-between' }}>
              <Button onClick={() => setStep('enter')} disabled={loading}>
                Back
              </Button>
              <Button type="primary" onClick={handleVerify} loading={loading}>
                Verify
              </Button>
            </Space>
          </>
        )}
      </Form>
    </Modal>
  );
}
