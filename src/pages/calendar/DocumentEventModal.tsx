import React, { useEffect, useCallback } from 'react';
import {
  Modal,
  Typography,
  Tag,
  Space,
  Button,
  Spin,
  theme,
  Divider,
  Row,
  Col,
  Grid,
  Image,
} from 'antd';
import {
  FileOutlined,
  DownloadOutlined,
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import type { ProfileDocumentRecord } from '../../services/profileDocumentsApi';
import { PROFILE_DOCUMENT_TYPE_LABELS } from '../../constants/profileDocument';
import { useLazyGetAssetUrlQuery } from '../../services/assetsApi';

const { Text } = Typography;
const { useBreakpoint } = Grid;

export interface DocumentEventModalProps {
  open: boolean;
  onClose: () => void;
  document: ProfileDocumentRecord | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getPreviewType(mimeType: string): 'pdf' | 'image' | 'video' | 'audio' | 'other' {
  const m = (mimeType || '').toLowerCase();
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'other';
}

const DOCUMENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  license: <FileTextOutlined />,
  certificate: <FileTextOutlined />,
  passport: <FileTextOutlined />,
  visa: <FileTextOutlined />,
  insurance: <FileTextOutlined />,
  id: <FileTextOutlined />,
  other: <FileOutlined />,
};

export const DocumentEventModal: React.FC<DocumentEventModalProps> = ({
  open,
  onClose,
  document: doc,
}) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.sm;

  const [getAssetUrl, { data: previewUrl, isFetching: isLoadingUrl }] = useLazyGetAssetUrlQuery();

  const fileKey = doc?.file?.key;
  const mimeType = (doc?.file?.mimeType ?? '').toLowerCase();
  const fileName = doc?.file?.fileName ?? 'Document';
  const fileSize = doc?.file?.size;
  const previewType = getPreviewType(mimeType);
  const resolvedPreviewUrl = typeof previewUrl === 'string' && previewUrl ? previewUrl : null;

  useEffect(() => {
    if (!open || !doc?.file?.key) return;
    getAssetUrl(doc.file.key);
  }, [open, fileKey, getAssetUrl]);

  const handleDownload = useCallback(() => {
    if (resolvedPreviewUrl) {
      window.open(resolvedPreviewUrl, '_blank', 'noopener,noreferrer');
    }
  }, [resolvedPreviewUrl]);

  if (!doc) return null;

  const expirationDate = doc.expirationDate
    ? new Date(doc.expirationDate)
    : null;
  const now = new Date();
  const isExpired = doc.isExpired;
  const daysUntilExpiry = expirationDate
    ? Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const expiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  const expirationLabel = expirationDate
    ? expirationDate.toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '—';
  const profileName = doc.profile?.user?.name ?? '—';
  const profileEmail = doc.profile?.user?.email;
  const typeLabel = PROFILE_DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType;
  const TypeIcon = DOCUMENT_TYPE_ICONS[doc.documentType] ?? DOCUMENT_TYPE_ICONS.other;

  const previewHeight = isMobile ? 280 : 360;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={isMobile ? '100%' : 720}
      style={{ top: isMobile ? 16 : 40, maxWidth: 'calc(100vw - 32px)' }}
      destroyOnClose
      styles={{ body: { paddingTop: token.paddingSM } }}
    >
      {/* Header: icon + title + status */}
      <div style={{ marginBottom: token.marginMD }}>
        <Space align="start" size="middle" wrap>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: token.borderRadiusLG,
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            {TypeIcon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Title level={5} style={{ margin: 0, marginBottom: 4 }}>
              {doc.title}
            </Typography.Title>
            <Space size="small" wrap>
              <Tag color="blue">{typeLabel}</Tag>
              {isExpired && <Tag color="error">Expired</Tag>}
              {expiringSoon && !isExpired && (
                <Tag color="warning">Expires in {daysUntilExpiry} days</Tag>
              )}
              {!isExpired && daysUntilExpiry !== null && daysUntilExpiry > 30 && (
                <Tag color="success">Valid</Tag>
              )}
            </Space>
          </div>
        </Space>
      </div>

      <Row gutter={[token.marginLG, token.marginMD]}>
        {/* Details column */}
        <Col xs={24} sm={24} md={10}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Expiration
              </Text>
              <div style={{ marginTop: 4 }}>
                <CalendarOutlined style={{ marginRight: 6, color: token.colorTextSecondary }} />
                <Text strong={!isExpired} style={isExpired ? { color: token.colorError } : undefined}>
                  {expirationLabel}
                </Text>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Profile
              </Text>
              <div style={{ marginTop: 4 }}>
                <UserOutlined style={{ marginRight: 6, color: token.colorTextSecondary }} />
                <Text>{profileName}</Text>
                {profileEmail && (
                  <div style={{ marginLeft: 22, marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{profileEmail}</Text>
                  </div>
                )}
              </div>
            </div>
            {doc.description && (
              <div>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Description
                </Text>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>{doc.description}</Text>
                </div>
              </div>
            )}
            <Divider style={{ margin: '8px 0' }} />
            <div>
              <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                File
              </Text>
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <Text style={{ wordBreak: 'break-all' }}>{fileName}</Text>
                {fileSize != null && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatFileSize(fileSize)}
                  </Text>
                )}
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  size="small"
                  loading={isLoadingUrl}
                  onClick={handleDownload}
                  disabled={!resolvedPreviewUrl}
                >
                  Download
                </Button>
              </div>
            </div>
          </Space>
        </Col>

        {/* Preview column */}
        <Col xs={24} sm={24} md={14}>
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
            Preview
          </Text>
          <div
            style={{
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillQuaternary,
              overflow: 'hidden',
              minHeight: previewHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isLoadingUrl ? (
              <Spin size="large" tip="Loading preview…" />
            ) : !resolvedPreviewUrl ? (
              <div style={{ padding: token.paddingLG, textAlign: 'center' }}>
                <FileOutlined style={{ fontSize: 40, color: token.colorTextQuaternary }} />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">Preview not available</Text>
                </div>
                <Button
                  type="link"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  style={{ marginTop: 8 }}
                >
                  Download file
                </Button>
              </div>
            ) : previewType === 'pdf' ? (
              <iframe
                src={resolvedPreviewUrl}
                title={fileName}
                width="100%"
                height={previewHeight}
                style={{ border: 'none', display: 'block' }}
              />
            ) : previewType === 'image' ? (
              <div
                style={{
                  padding: token.paddingSM,
                  width: '100%',
                  textAlign: 'center',
                  maxHeight: previewHeight,
                  overflow: 'auto',
                }}
              >
                <Image
                  src={resolvedPreviewUrl}
                  alt={fileName}
                  style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
                />
              </div>
            ) : previewType === 'video' ? (
              <video
                controls
                controlsList="nodownload"
                style={{
                  width: '100%',
                  maxHeight: previewHeight,
                  objectFit: 'contain',
                }}
                src={resolvedPreviewUrl}
                preload="metadata"
                playsInline
              >
                <track kind="captions" />
              </video>
            ) : previewType === 'audio' ? (
              <div style={{ padding: token.paddingLG, width: '100%' }}>
                <audio
                  controls
                  style={{ width: '100%', maxWidth: 400 }}
                  src={resolvedPreviewUrl}
                  preload="metadata"
                />
                <div style={{ marginTop: 8, textAlign: 'center' }}>
                  <SoundOutlined style={{ color: token.colorTextSecondary }} />
                  <Text type="secondary" style={{ marginLeft: 6 }}>{fileName}</Text>
                </div>
              </div>
            ) : (
              <div style={{ padding: token.paddingLG, textAlign: 'center' }}>
                <FileOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">This file type cannot be previewed</Text>
                </div>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  style={{ marginTop: 12 }}
                >
                  Download to view
                </Button>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </Modal>
  );
};
