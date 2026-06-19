import { useEffect, useState } from 'react';
import { Card, Button, Typography, theme } from 'antd';
import {
  FilePdfOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  FileTextOutlined,
  FileOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { getCoursePageDocumentIcon } from '../../../constants/coursePageDocument';
import type { CoursePageDocument } from '../../../types/course';

const { Text } = Typography;

export interface CoursePageDocumentViewerProps {
  /** Existing document (has url from API). */
  document?: CoursePageDocument | null;
  /** Or a File for preview (e.g. before upload). Uses object URL. */
  file?: File | null;
  /** Compact mode: less padding, smaller headings. */
  compact?: boolean;
  /** Optional title above the viewer (e.g. "Current document", "Preview"). */
  title?: React.ReactNode;
  /** className for the wrapper. */
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CoursePageDocumentViewer({
  document: doc,
  file,
  compact,
  title,
  className,
}: CoursePageDocumentViewerProps) {
  const { token } = theme.useToken();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Create object URL in effect so it stays valid after Strict Mode remount; revoke only on cleanup.
  useEffect(() => {
    if (!file || typeof window === 'undefined') {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const url = doc?.url ?? null;
  const displayUrl = url ?? objectUrl ?? '';
  const fileName = doc?.fileName ?? file?.name ?? 'Document';
  const mimeType = (doc?.mimeType ?? file?.type ?? '').toLowerCase();
  const size = doc?.size ?? file?.size;

  if (!displayUrl) return null;

  const iconMap: Record<string, React.ReactNode> = {
    video: <VideoCameraOutlined style={{ color: token.colorPrimary }} />,
    audio: <SoundOutlined style={{ color: token.colorPrimary }} />,
    image: <FileImageOutlined style={{ color: token.colorPrimary }} />,
    pdf: <FilePdfOutlined style={{ color: token.colorError }} />,
    text: <FileTextOutlined style={{ color: token.colorSuccess }} />,
    document: <FileTextOutlined style={{ color: token.colorPrimary }} />,
    spreadsheet: <FileOutlined style={{ color: token.colorSuccess }} />,
    presentation: <FileOutlined style={{ color: token.colorWarning }} />,
    file: <FileOutlined style={{ color: token.colorTextSecondary }} />,
  };
  const iconKey = getCoursePageDocumentIcon(mimeType);
  const icon = iconMap[iconKey] ?? iconMap.file;

  const cardStyle: React.CSSProperties = {
    borderRadius: token.borderRadiusLG,
    overflow: 'hidden',
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorFillQuaternary,
  };

  const contentStyle: React.CSSProperties = {
    padding: compact ? token.paddingSM : token.paddingLG,
  };

  const renderByType = () => {
    if (mimeType.startsWith('video/')) {
      return (
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            borderRadius: token.borderRadiusLG,
            overflow: 'hidden',
            background: '#000',
            boxShadow: token.boxShadowSecondary,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              minHeight: 200,
              background: '#000',
            }}
          >
            <video
              controls
              controlsList="nodownload"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
              src={displayUrl}
              key={displayUrl}
              preload="metadata"
              playsInline
            >
              {mimeType ? <source src={displayUrl} type={mimeType} /> : null}
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      );
    }
    if (mimeType.startsWith('audio/')) {
      return (
        <div
          style={{
            padding: token.paddingLG,
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <audio controls style={{ width: '100%', maxWidth: 500 }} src={displayUrl} key={displayUrl}>
            {mimeType ? <source src={displayUrl} type={mimeType} /> : null}
            Your browser does not support the audio tag.
          </audio>
          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
            {fileName}
            {size != null && ` · ${formatFileSize(size)}`}
          </Text>
        </div>
      );
    }
    if (mimeType === 'application/pdf') {
      return (
        <div
          style={{
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
          }}
        >
          <iframe
            src={displayUrl}
            title={fileName}
            width="100%"
            height={compact ? 480 : 640}
            style={{ border: 'none', display: 'block' }}
          />
        </div>
      );
    }
    if (mimeType.startsWith('image/')) {
      return (
        <div
          style={{
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
            padding: token.paddingSM,
            display: 'inline-block',
            maxWidth: '100%',
          }}
        >
          <img
            src={displayUrl}
            alt={fileName}
            style={{ maxWidth: '100%', height: 'auto', display: 'block', borderRadius: token.borderRadius }}
          />
        </div>
      );
    }
    if (mimeType.startsWith('text/')) {
      return (
        <div
          style={{
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
          }}
        >
          <iframe
            src={displayUrl}
            title={fileName}
            width="100%"
            height={compact ? 400 : 500}
            style={{ border: 'none', display: 'block' }}
          />
        </div>
      );
    }
    // Office docs and others: show file info + download
    return (
      <div
        style={{
          padding: token.paddingLG,
          background: token.colorBgContainer,
          borderRadius: token.borderRadius,
          border: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: token.marginMD,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text strong>{fileName}</Text>
          {size != null && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatFileSize(size)}
            </Text>
          )}
        </span>
        <Button type="primary" icon={<DownloadOutlined />} href={displayUrl} download={fileName}>
          Download to View
        </Button>
      </div>
    );
  };

  return (
    <div className={className}>
      {title != null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: token.marginSM,
            flexWrap: 'wrap',
          }}
        >
          {icon}
          <Text strong style={{ fontSize: compact ? 13 : 14 }}>
            {title}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {fileName}
            {size != null && ` · ${formatFileSize(size)}`}
          </Text>
        </div>
      )}
      <Card size={compact ? 'small' : 'default'} style={cardStyle} styles={{ body: contentStyle }}>
        {renderByType()}
      </Card>
    </div>
  );
}
