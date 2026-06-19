import React from 'react';
import { Button, Space, Popconfirm, Tooltip, Dropdown } from 'antd';
import { theme } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { usePermission } from '../../../hooks/usePermission';
import type { KnowledgeBaseFolder } from '../../../services/knowledgeBaseApi';

const { useToken } = theme;

export type FolderActionsSize = 'small' | 'middle';
export type FolderActionsMode = 'dropdown' | 'buttons' | 'icon';

export interface FolderActionsProps {
  /** The folder to render actions for */
  folder: KnowledgeBaseFolder;
  /** Callback when Edit is clicked */
  onEdit?: () => void;
  /** Callback when Delete is clicked */
  onDelete?: () => void;
  /** Button size */
  size?: FolderActionsSize;
  /** Rendering mode */
  mode?: FolderActionsMode;
  /** Show edit button */
  showEdit?: boolean;
  /** Show delete button */
  showDelete?: boolean;
  /** Disable all actions */
  disabled?: boolean;
  /** ClassName for custom styling */
  className?: string;
  /** Custom delete confirmation message */
  deleteConfirmTitle?: string;
  /** Custom delete description */
  deleteConfirmDescription?: string;
}

/**
 * FolderActions - Permission-aware folder action buttons
 *
 * This component centralizes all folder action buttons and ensures
 * consistent permission checking across all views.
 *
 * Permission Model:
 * - Edit: Requires knowledgebase::edit permission
 * - Delete: Requires knowledgebase::delete permission
 */
export const FolderActions: React.FC<FolderActionsProps> = ({
  folder: _folder,
  onEdit,
  onDelete,
  size = 'middle',
  mode = 'icon',
  showEdit = true,
  showDelete = true,
  disabled = false,
  className,
  deleteConfirmTitle = 'Delete this folder?',
  deleteConfirmDescription = 'Documents in this folder will become uncategorized.',
}) => {
  const { token } = useToken();

  // Permission checks - centralized here for consistency
  const canEdit = usePermission('knowledgebase::edit');
  const canDelete = usePermission('knowledgebase::delete');

  // Build menu items for dropdown mode
  const menuItems: MenuProps['items'] = [];

  // Edit (requires permission)
  if (showEdit && canEdit && onEdit) {
    menuItems.push({
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit',
      onClick: onEdit,
    });
  }

  // Delete (requires permission)
  if (showDelete && canDelete && onDelete) {
    menuItems.push({
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete',
      danger: true,
      onClick: onDelete,
    });
  }

  // Render as dropdown
  if (mode === 'dropdown') {
    // Don't render dropdown if no actions are available
    if (menuItems.length === 0) {
      return null;
    }

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

  // Render as icon buttons (for folder cards)
  if (mode === 'icon') {
    return (
      <Space size={0} className={className}>
        {showEdit && canEdit && onEdit && (
          <Tooltip title="Edit folder">
            <Button
              type="text"
              size={size}
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              disabled={disabled}
              style={{ color: token.colorTextSecondary }}
            />
          </Tooltip>
        )}
        {showDelete && canDelete && onDelete && (
          <Popconfirm
            title={deleteConfirmTitle}
            description={deleteConfirmDescription}
            onConfirm={(e) => {
              e?.stopPropagation();
              onDelete();
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Tooltip title="Delete folder">
              <Button
                type="text"
                size={size}
                icon={<DeleteOutlined />}
                danger
                onClick={(e) => e.stopPropagation()}
                disabled={disabled}
              />
            </Tooltip>
          </Popconfirm>
        )}
      </Space>
    );
  }

  // Render as buttons
  return (
    <Space size={size === 'small' ? 'small' : 'middle'} className={className}>
      {showEdit && canEdit && onEdit && (
        <Button
          size={size}
          icon={<EditOutlined />}
          onClick={onEdit}
          disabled={disabled}
        >
          Edit
        </Button>
      )}
      {showDelete && canDelete && onDelete && (
        <Popconfirm
          title={deleteConfirmTitle}
          description={deleteConfirmDescription}
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

export default FolderActions;
