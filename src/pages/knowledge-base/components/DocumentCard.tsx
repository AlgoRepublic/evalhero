import React from 'react';
import { Card, Space, Tag, Tooltip, Typography } from 'antd';
import { FileTypeIcon } from './FileTypeIcon';
import { DocumentActions } from './DocumentActions';
import type { KnowledgeBaseDocument } from '../../../services/knowledgeBaseApi';

const { Text } = Typography;

interface DocumentCardProps {
  document: KnowledgeBaseDocument;
  onPreview: (doc: KnowledgeBaseDocument) => void;
  onDownload: (doc: KnowledgeBaseDocument) => void;
  onEdit: (doc: KnowledgeBaseDocument) => void;
  onMove: (doc: KnowledgeBaseDocument) => void;
  onDelete: (docId: string) => void;
  token?: any;
}

/**
 * Check if we can safely show a thumbnail preview (images only)
 */
const canShowThumbnail = (mimeType: string | null): boolean => {
  if (!mimeType) return false;
  return mimeType.toLowerCase().startsWith('image/');
};

/**
 * DocumentCard - Grid view card with safe thumbnail or file-type icon
 * Uses stable thumbnails for images only; falls back to clean icon for other types
 */
export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onPreview,
  onDownload,
  onEdit,
  onMove,
  onDelete,
  token,
}) => {
  const isImage = canShowThumbnail(document.mimeType);

  // For images, show thumbnail; for everything else, use file type icon
  const renderCover = () => {
    if (isImage) {
      // Try to use filePath as direct image URL (may work for some storage backends)
      return (
        <div
          style={{
            height: 120,
            overflow: 'hidden',
            backgroundColor: '#f5f5f5',
          }}
        >
          <img
            src={document.filePath}
            alt={document.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              // Fall back to icon on error
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      );
    }

    // For PDFs, docs, and other types, show file-type icon with styled background
    return (
      <div
        style={{
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${token?.colorPrimary || '#1890ff'}10`,
        }}
      >
        <FileTypeIcon mimeType={document.mimeType} size="large" showBackground />
      </div>
    );
  };

  return (
    <Card
      hoverable
      onClick={() => onPreview(document)}
      style={{
        cursor: 'pointer',
        textAlign: 'center',
        border: `1px solid ${token?.colorBorderSecondary || '#f0f0f0'}`,
      }}
      cover={renderCover()}
    >
      <Card.Meta
        title={
          <Tooltip title={document.title}>
            <Text ellipsis style={{ fontSize: 13 }}>
              {document.title}
            </Text>
          </Tooltip>
        }
        description={
          <Space direction="vertical" size={0}>
            {document.tags && document.tags.length > 0 && (
              <Space size={4} wrap>
                {document.tags.slice(0, 2).map((tag) => (
                  <Tag key={tag._id} color="blue" style={{ margin: 0, fontSize: 10 }}>
                    {tag.name}
                  </Tag>
                ))}
              </Space>
            )}
            <Text type="secondary" style={{ fontSize: 11 }}>
              {document.updatedAt ? new Date(document.updatedAt).toLocaleDateString() : '—'}
            </Text>
          </Space>
        }
      />
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
        }}
      >
        <DocumentActions
          document={document}
          onDownload={() => onDownload(document)}
          onEdit={() => onEdit(document)}
          onMove={() => onMove(document)}
          onDelete={() => onDelete(document._id)}
          onPreview={() => onPreview(document)}
          size="small"
          displayMode="menu"
        />
      </div>
    </Card>
  );
};

export default DocumentCard;
