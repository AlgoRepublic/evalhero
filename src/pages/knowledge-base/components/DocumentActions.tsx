import React from 'react';
import {
  Dropdown,
  Button,
  Space,
  Popconfirm,
  message,
} from 'antd';
import {
  MoreOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { usePermission } from '../../../hooks/usePermission';
import { useLazyGetAssetUrlQuery } from '../../../services/assetsApi';
import type { KnowledgeBaseDocument } from '../../../services/knowledgeBaseApi';

export type DocumentActionsSize = 'small' | 'middle' | 'large';
export type DocumentActionsMode = 'dropdown' | 'buttons' | 'icon';

// New: Responsive mode type for mobile polish
export type DocumentActionsDisplayMode = 'inline' | 'menu';

export interface DocumentActionsProps {
  /** The document to render actions for */
  document: KnowledgeBaseDocument;
  /** Callback when Edit is clicked */
  onEdit?: () => void;
  /** Callback when Move is clicked */
  onMove?: () => void;
  /** Callback when Delete is clicked */
  onDelete?: () => void;
  /** Callback when Download is clicked */
  onDownload?: () => void;
  /** Callback when Preview is clicked */
  onPreview?: () => void;
  /** Button size */
  size?: DocumentActionsSize;
  /** Rendering mode - 'dropdown' | 'buttons' | 'icon' */
  mode?: DocumentActionsMode;
  /** Responsive display mode - 'inline' shows buttons, 'menu' shows ellipsis dropdown */
  displayMode?: DocumentActionsDisplayMode;
  /** Whether to show preview button (based on file type capability) */
  showPreview?: boolean;
  /** Disable all actions */
  disabled?: boolean;
  /** ClassName for custom styling */
  className?: string;
}

/**
 * Check if a MIME type is previewable in-browser
 */
const isPreviewableMimeType = (mimeType: string | null): boolean => {
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
 * DocumentActions - Permission-aware document action buttons
 *
 * This component centralizes all document action buttons and ensures
 * consistent permission checking across all views (table, grid, preview).
 *
 * Permission Model:
 * - Download: Available to all users who can access the document
 * - Preview: Available based on file type (no permission required)
 * - Edit: Requires knowledgebase::edit permission
 * - Move: Requires knowledgebase::edit permission
 * - Delete: Requires knowledgebase::delete permission
 */
export const DocumentActions: React.FC<DocumentActionsProps> = ({
  document,
  onEdit,
  onMove,
  onDelete,
  onDownload,
  onPreview,
  size = 'middle',
  mode = 'buttons',
  displayMode = 'inline',
  showPreview = true,
  disabled = false,
  className,
}) => {
  // Permission checks - centralized here for consistency
  const canEdit = usePermission('knowledgebase::edit');
  const canDelete = usePermission('knowledgebase::delete');

  // Check if preview is available for this file type
  const previewable = isPreviewableMimeType(document.mimeType);

  // Build menu items for dropdown mode
  const menuItems: MenuProps['items'] = [];

  // Preview (if supported)
  if (showPreview && previewable && onPreview) {
    menuItems.push({
      key: 'preview',
      icon: <EyeOutlined />,
      label: 'Preview',
      onClick: onPreview,
    });
  }

  // Download (always available to those with access)
  if (onDownload) {
    menuItems.push({
      key: 'download',
      icon: <DownloadOutlined />,
      label: 'Download',
      onClick: onDownload,
    });
  }

  // Edit (requires permission)
  if (canEdit && onEdit) {
    menuItems.push({
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit',
      onClick: onEdit,
    });
  }

  // Move (requires permission)
  if (canEdit && onMove) {
    menuItems.push({
      key: 'move',
      icon: <FolderOutlined />,
      label: 'Move',
      onClick: onMove,
    });
  }

  // Delete (requires permission)
  if (canDelete && onDelete) {
    menuItems.push({
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete',
      danger: true,
      onClick: onDelete,
    });
  }

  // Use menu mode on mobile (displayMode='menu') for compact UI
  const useMenuMode = displayMode === 'menu';

  // Render as menu/dropdown when in menu mode
  if (useMenuMode) {
    return (
      <Dropdown
        menu={{ 
          items: menuItems,
          style: { minWidth: 120 },
        }}
        trigger={['click']}
        disabled={disabled}
        placement="bottomRight"
      >
        <Button
          type="text"
          size={size}
          className={className}
          onClick={(e) => e.stopPropagation()}
          aria-label="Actions"
        >
          <MoreOutlined />
        </Button>
      </Dropdown>
    );
  }

  // Render as dropdown (legacy mode)
  if (mode === 'dropdown') {
    return (
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        disabled={disabled}
      >
        <Button
          type="text"
          size={size}
          className={className}
          onClick={(e) => e.preventDefault()}
        >
          <MoreOutlined />
        </Button>
      </Dropdown>
    );
  }

  // Render as icon buttons (for grid view cards)
  if (mode === 'icon') {
    return (
      <Space size={4} className={className}>
        {showPreview && previewable && onPreview && (
          <Button
            type="text"
            size={size}
            icon={<EyeOutlined />}
            onClick={onPreview}
            disabled={disabled}
            title="Preview"
          />
        )}
        {onDownload && (
          <Button
            type="text"
            size={size}
            icon={<DownloadOutlined />}
            onClick={onDownload}
            disabled={disabled}
            title="Download"
          />
        )}
        {canEdit && onEdit && (
          <Button
            type="text"
            size={size}
            icon={<EditOutlined />}
            onClick={onEdit}
            disabled={disabled}
            title="Edit"
          />
        )}
        {canDelete && onDelete && (
          <Popconfirm
            title="Delete this document?"
            onConfirm={(e) => {
              e?.stopPropagation();
              onDelete();
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              type="text"
              size={size}
              icon={<DeleteOutlined />}
              danger
              disabled={disabled}
              title="Delete"
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        )}
      </Space>
    );
  }

  // Render as buttons (default - for table view)
  return (
    <Space
      size={size === 'small' ? 'small' : 'middle'}
      className={className}
    >
      {showPreview && previewable && onPreview && (
        <Button
          size={size}
          icon={<EyeOutlined />}
          onClick={onPreview}
          disabled={disabled}
        >
          Preview
        </Button>
      )}
      {onDownload && (
        <Button
          size={size}
          icon={<DownloadOutlined />}
          onClick={onDownload}
          disabled={disabled}
        >
          Download
        </Button>
      )}
      {canEdit && onEdit && (
        <Button
          size={size}
          icon={<EditOutlined />}
          onClick={onEdit}
          disabled={disabled}
        >
          Edit
        </Button>
      )}
      {canEdit && onMove && (
        <Button
          size={size}
          icon={<FolderOutlined />}
          onClick={onMove}
          disabled={disabled}
        >
          Move
        </Button>
      )}
      {canDelete && onDelete && (
        <Popconfirm
          title="Delete this document?"
          onConfirm={onDelete}
        >
          <Button
            size={size}
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
          >
            Delete
          </Button>
        </Popconfirm>
      )}
    </Space>
  );
};

/**
 * Hook to get document download URL and handle download
 * Used by components that need download functionality
 */
export const useDocumentDownload = () => {
  const [getAssetUrl] = useLazyGetAssetUrlQuery();

  const downloadDocument = React.useCallback(
    async (doc: KnowledgeBaseDocument) => {
      if (!doc.filePath) {
        message.error('Document has no file path');
        return;
      }

      try {
        const result = await getAssetUrl(doc.filePath);
        const signedUrl = result.data;

        if (!signedUrl) {
          message.error('Could not get download URL');
          return;
        }

        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error('Download failed');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;

        // Extract extension from filePath or use mimeType
        const extension = doc.filePath?.split('.').pop() || '';
        const filename = extension ? `${doc.title}.${extension}` : doc.title;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } catch {
        message.error('Failed to download document');
      }
    },
    [getAssetUrl]
  );

  const getPreviewUrl = React.useCallback(
    async (doc: KnowledgeBaseDocument): Promise<string | null> => {
      if (!doc.filePath) {
        return null;
      }

      try {
        const result = await getAssetUrl(doc.filePath);
        return result.data || null;
      } catch {
        return null;
      }
    },
    [getAssetUrl]
  );

  return {
    downloadDocument,
    getPreviewUrl,
  };
};

export default DocumentActions;
