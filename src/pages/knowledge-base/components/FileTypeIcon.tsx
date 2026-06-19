import React from 'react';
import {
  FilePdfOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileOutlined,
  FileZipOutlined,
} from '@ant-design/icons';
import { theme } from 'antd';

const { useToken } = theme;

export type FileTypeIconSize = 'small' | 'medium' | 'large';

export interface FileTypeIconProps {
  /** MIME type string (e.g., 'application/pdf', 'image/png') */
  mimeType: string | null;
  /** Icon size preset */
  size?: FileTypeIconSize;
  /** Custom size in pixels (overrides preset) */
  customSize?: number;
  /** Whether to show a colored background circle */
  showBackground?: boolean;
  /** Custom className for additional styling */
  className?: string;
  /** Optional file path - reserved for future thumbnail support */
  filePath?: string;
}

/**
 * Maps MIME types to Ant Design icons
 */
const getIconForMimeType = (
  mimeType: string | null
): { icon: React.ReactNode; color: string } => {
  if (!mimeType) {
    return { icon: <FileOutlined />, color: '#8c8c8c' };
  }

  const normalizedMime = mimeType.toLowerCase();

  // PDF
  if (normalizedMime === 'application/pdf' || normalizedMime.includes('pdf')) {
    return { icon: <FilePdfOutlined />, color: '#ff4d4f' };
  }

  // Images
  if (
    normalizedMime.startsWith('image/') ||
    normalizedMime.includes('jpeg') ||
    normalizedMime.includes('jpg') ||
    normalizedMime.includes('png') ||
    normalizedMime.includes('gif') ||
    normalizedMime.includes('webp') ||
    normalizedMime.includes('svg')
  ) {
    return { icon: <FileImageOutlined />, color: '#52c41a' };
  }

  // Word documents
  if (
    normalizedMime.includes('word') ||
    normalizedMime.includes('document') ||
    normalizedMime.includes('docx') ||
    normalizedMime.includes('doc')
  ) {
    return { icon: <FileWordOutlined />, color: '#1890ff' };
  }

  // Excel/spreadsheets
  if (
    normalizedMime.includes('excel') ||
    normalizedMime.includes('spreadsheet') ||
    normalizedMime.includes('xlsx') ||
    normalizedMime.includes('xls')
  ) {
    return { icon: <FileExcelOutlined />, color: '#52c41a' };
  }

  // PowerPoint/presentations
  if (
    normalizedMime.includes('powerpoint') ||
    normalizedMime.includes('presentation') ||
    normalizedMime.includes('pptx') ||
    normalizedMime.includes('ppt')
  ) {
    return { icon: <FilePptOutlined />, color: '#fa8c16' };
  }

  // Text files
  if (
    normalizedMime.startsWith('text/') ||
    normalizedMime.includes('plain') ||
    normalizedMime.includes('markdown') ||
    normalizedMime.includes('json') ||
    normalizedMime.includes('xml') ||
    normalizedMime.includes('html')
  ) {
    return { icon: <FileTextOutlined />, color: '#722ed1' };
  }

  // Archives
  if (
    normalizedMime.includes('zip') ||
    normalizedMime.includes('rar') ||
    normalizedMime.includes('tar') ||
    normalizedMime.includes('gzip') ||
    normalizedMime.includes('7z')
  ) {
    return { icon: <FileZipOutlined />, color: '#8c8c8c' };
  }

  // Default
  return { icon: <FileOutlined />, color: '#8c8c8c' };
};

/**
 * Get numeric size from preset or custom value
 */
const getSizeValue = (size: FileTypeIconSize, customSize?: number): number => {
  if (customSize !== undefined) return customSize;

  switch (size) {
    case 'small':
      return 16;
    case 'medium':
      return 24;
    case 'large':
      return 32;
    default:
      return 24;
  }
};

/**
 * FileTypeIcon component - displays appropriate icon based on MIME type
 * Used throughout Knowledge Base for visual file type identification
 */
export const FileTypeIcon: React.FC<FileTypeIconProps> = ({
  mimeType,
  size = 'medium',
  customSize,
  showBackground = false,
  className,
}) => {
  const { token } = useToken();
  const { icon, color } = getIconForMimeType(mimeType);
  const iconSize = getSizeValue(size, customSize);

  if (showBackground) {
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: iconSize + 16,
          height: iconSize + 16,
          borderRadius: token.borderRadiusLG,
          backgroundColor: `${color}15`,
          color: color,
        }}
      >
        <span style={{ fontSize: iconSize }}>{icon}</span>
      </div>
    );
  }

  return (
    <span
      className={className}
      style={{
        fontSize: iconSize,
        color: color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </span>
  );
};

export default FileTypeIcon;
