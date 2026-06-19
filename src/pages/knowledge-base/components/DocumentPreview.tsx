import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Spin,
  Alert,
  Button,
  Space,
  Typography,
  Descriptions,
  Tag,
  Divider,
  Dropdown,
  Tooltip,
} from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  FolderOutlined,
  DeleteOutlined,
  MoreOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { theme } from 'antd';
import { usePermission } from '../../../hooks/usePermission';
import { useLazyGetAssetUrlQuery } from '../../../services/assetsApi';
import type { KnowledgeBaseDocument } from '../../../services/knowledgeBaseApi';
import { FileTypeIcon } from './FileTypeIcon';

const { Title, Text } = Typography;
const { useToken } = theme;

export interface DocumentPreviewProps {
  /** The document to preview */
  document: KnowledgeBaseDocument | null;
  /** Whether the preview is open */
  open: boolean;
  /** Callback when preview is closed */
  onClose: () => void;
  /** Callback when Download is clicked */
  onDownload?: () => void;
  /** Callback when Edit is clicked */
  onEdit?: () => void;
  /** Callback when Move is clicked */
  onMove?: () => void;
  /** Callback when Delete is clicked */
  onDelete?: () => void;
  /** Whether to use mobile layout */
  isMobile?: boolean;
}

/**
 * Check if a MIME type is previewable in-browser
 */
const isPreviewableMimeType = (mimeType: string | null): mimeType is string => {
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase();

  // PDF
  if (normalized === 'application/pdf' || normalized.includes('pdf')) {
    return true;
  }

  // Images
  if (normalized.startsWith('image/')) {
    return true;
  }

  // Text
  if (normalized.startsWith('text/')) {
    return true;
  }

  return false;
};

/**
 * Get preview type based on MIME type
 */
const getPreviewType = (mimeType: string | null): 'pdf' | 'image' | 'text' | 'unsupported' => {
  if (!mimeType) return 'unsupported';
  const normalized = mimeType.toLowerCase();

  if (normalized === 'application/pdf' || normalized.includes('pdf')) {
    return 'pdf';
  }

  if (normalized.startsWith('image/')) {
    return 'image';
  }

  if (normalized.startsWith('text/')) {
    return 'text';
  }

  return 'unsupported';
};

/**
 * Format date for display
 */
const formatDate = (dateString?: string): string => {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

/**
 * DocumentPreview - In-app document preview using Drawer
 *
 * Supports:
 * - PDF preview (iframe)
 * - Image preview (img tag)
 * - Text preview (pre tag)
 * - Fallback for unsupported types (metadata + download)
 *
 * Permission Model (actions in header):
 * - Download: Available to all users with access
 * - Edit: Requires knowledgebase::edit
 * - Move: Requires knowledgebase::edit
 * - Delete: Requires knowledgebase::delete
 */
export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  open,
  onClose,
  onDownload,
  onEdit,
  onMove,
  onDelete,
  isMobile = false,
}) => {
  const { token } = useToken();
  const [getAssetUrl, { isFetching: loadingUrl }] = useLazyGetAssetUrlQuery();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Permission checks
  const canEdit = usePermission('knowledgebase::edit');
  const canDelete = usePermission('knowledgebase::delete');

  const previewType = document ? getPreviewType(document.mimeType) : 'unsupported';

  // Fetch preview URL when document changes
  useEffect(() => {
    if (document && open && isPreviewableMimeType(document.mimeType)) {
      const fetchUrl = async () => {
        setLoadingContent(true);
        setError(null);
        try {
          const result = await getAssetUrl(document.filePath);
          if (result.data) {
            setPreviewUrl(result.data);
          } else {
            setError('Could not load preview URL');
          }
        } catch {
          setError('Failed to load preview');
        } finally {
          setLoadingContent(false);
        }
      };
      fetchUrl();
    } else {
      setPreviewUrl(null);
    }
  }, [document, open, getAssetUrl]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setError(null);
    }
  }, [open]);

  if (!document) {
    return null;
  }

  const renderPreviewContent = () => {
    // Loading state
    if (loadingUrl || loadingContent) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Spin size="large" tip="Loading preview..." />
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <Alert
          type="error"
          message="Preview Error"
          description={error}
          showIcon
        />
      );
    }

    // Unsupported type fallback
    if (previewType === 'unsupported') {
      return (
        <div style={{ padding: 24 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }} align="center">
            <FileTypeIcon mimeType={document.mimeType} size="large" showBackground />
            <Title level={4} style={{ margin: 0 }}>{document.title}</Title>
            
            <Descriptions column={1} bordered size="small" style={{ width: '100%', maxWidth: 400 }}>
              <Descriptions.Item label="Type">{document.mimeType || 'Unknown'}</Descriptions.Item>
              <Descriptions.Item label="Location">
                {document.folder ? (
                  document.folder.parents?.map(p => p.name).join(' / ') + ' / ' + document.folder.name
                ) : 'Root'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">{formatDate(document.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Modified">{formatDate(document.updatedAt)}</Descriptions.Item>
            </Descriptions>

            {document.tags && document.tags.length > 0 && (
              <div style={{ width: '100%', maxWidth: 400 }}>
                <Text type="secondary">Tags:</Text>
                <div style={{ marginTop: 8 }}>
                  {document.tags.map(tag => (
                    <Tag key={tag._id} color="blue">{tag.name}</Tag>
                  ))}
                </div>
              </div>
            )}

            <Divider />

            <Alert
              message="Preview not available"
              description="This file type cannot be previewed in the browser. You can download the file to view it."
              type="info"
              showIcon
            />

            {onDownload && (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={onDownload}
                size="large"
              >
                Download File
              </Button>
            )}
          </Space>
        </div>
      );
    }

    // PDF preview
    if (previewType === 'pdf' && previewUrl) {
      return (
        <iframe
          src={previewUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={document.title}
        />
      );
    }

    // Image preview
    if (previewType === 'image' && previewUrl) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          overflow: 'auto',
          padding: token.padding,
        }}>
          <img
            src={previewUrl}
            alt={document.title}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      );
    }

    // Text preview
    if (previewType === 'text' && previewUrl) {
      return (
        <iframe
          src={previewUrl}
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
          title={document.title}
        />
      );
    }

    return null;
  };

  // Header actions - reuse permission logic from DocumentActions
  // Use menu dropdown on mobile, inline buttons on desktop
  const renderHeaderActions = () => {
    const menuItems = [
      ...(onDownload ? [{ key: 'download', icon: <DownloadOutlined />, label: 'Download', onClick: onDownload }] : []),
      ...(canEdit && onEdit ? [{ key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: onEdit }] : []),
      ...(canEdit && onMove ? [{ key: 'move', icon: <FolderOutlined />, label: 'Move', onClick: onMove }] : []),
      ...(canDelete && onDelete ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: onDelete }] : []),
    ];

    if (menuItems.length === 0) {
      return null;
    }

    if (isMobile) {
      return (
        <Dropdown
          menu={{ items: menuItems }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      );
    }

    return (
      <Space>
        {menuItems.map(item => (
          <Button
            key={item.key}
            icon={item.icon}
            onClick={item.onClick}
            danger={item.danger}
          >
            {item.label}
          </Button>
        ))}
      </Space>
    );
  };

  return (
    <Drawer
      title={
        <Space>
          <FileTypeIcon mimeType={document.mimeType} size="small" />
          <span>{document.title}</span>
          {previewType === 'pdf' && (
            <Tooltip title={isFullScreen ? 'Exit full screen' : 'Full screen'}>
              <Button
                type="text"
                icon={isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={() => setIsFullScreen(!isFullScreen)}
                size="small"
              />
            </Tooltip>
          )}
        </Space>
      }
      placement="right"
      width={isFullScreen ? '100%' : 720}
      onClose={() => {
        setIsFullScreen(false);
        onClose();
      }}
      open={open}
      extra={renderHeaderActions()}
      bodyStyle={{ padding: 0, overflow: 'hidden' }}
      styles={{ body: { height: isFullScreen ? 'calc(100vh - 55px)' : 'auto' } }}
    >
      <div style={{ height: '100%', overflow: 'auto' }}>
        {renderPreviewContent()}
      </div>
    </Drawer>
  );
};

export default DocumentPreview;
