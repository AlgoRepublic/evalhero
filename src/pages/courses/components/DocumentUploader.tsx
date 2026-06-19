import { useState } from 'react';
import { Upload, Typography, theme } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import {
  COURSE_PAGE_DOCUMENT_ACCEPT,
  validateCoursePageDocumentFile,
} from '../../../constants/coursePageDocument';

const { Text } = Typography;

export interface DocumentUploaderProps {
  value?: File | null;
  onChange?: (file: File | null) => void;
  disabled?: boolean;
  maxSizeMB?: number;
  /** Show inline error message */
  error?: string;
}

export default function DocumentUploader({
  value,
  onChange,
  disabled,
  maxSizeMB = 500,
  error,
}: DocumentUploaderProps) {
  const { token } = theme.useToken();
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleBeforeUpload: UploadProps['beforeUpload'] = (file) => {
    setValidationError(null);
    const result = validateCoursePageDocumentFile(file, maxSizeMB);
    if (!result.valid) {
      setValidationError(result.error);
      return Upload.LIST_IGNORE;
    }
    onChange?.(file);
    return false; // prevent auto upload
  };

  const fileList: UploadFile[] = value
    ? [
        {
          uid: '-1',
          name: value.name,
          size: value.size,
          type: value.type,
          originFileObj: value as UploadFile['originFileObj'],
        },
      ]
    : [];

  const handleRemove = () => {
    setValidationError(null);
    onChange?.(null);
  };

  const uploadHint = `Video, audio, PDF, documents, or images · max ${maxSizeMB} MB`;

  return (
    <div>
      <Upload.Dragger
        accept={COURSE_PAGE_DOCUMENT_ACCEPT}
        fileList={fileList}
        beforeUpload={handleBeforeUpload}
        onRemove={handleRemove}
        maxCount={1}
        disabled={disabled}
        showUploadList={{ showPreviewIcon: false, showRemoveIcon: true }}
        style={{
          background: token.colorFillQuaternary,
          border: `2px dashed ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
        }}
      >
        <p className="ant-upload-drag-icon" style={{ marginBottom: token.marginXS }}>
          <InboxOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
        </p>
        <p className="ant-upload-text" style={{ marginBottom: 4, fontWeight: 600, color: token.colorText }}>
          Click or drag file here
        </p>
        <p className="ant-upload-hint" style={{ margin: 0, fontSize: 12, color: token.colorTextSecondary }}>
          {uploadHint}
        </p>
      </Upload.Dragger>
      {(validationError || error) && (
        <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          {validationError || error}
        </Text>
      )}
    </div>
  );
}
