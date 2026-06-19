import type { UploadFile } from 'antd';
import { Upload, Button, Space, Typography, message, theme } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface DocumentFileUploadProps {
  accept: string;
  maxSizeMB?: number;
  value?: { originFileObj?: File; uid: string; name: string }[];
  fileList?: { originFileObj?: File; uid: string; name: string }[];
  onChange?: (fileList: { originFileObj?: File; uid: string; name: string }[]) => void;
}

export function DocumentFileUpload({
  accept,
  maxSizeMB = 50,
  value,
  fileList: fileListProp,
  onChange,
}: DocumentFileUploadProps) {
  const { token } = theme.useToken();
  const rawList = Array.isArray(fileListProp) ? fileListProp : Array.isArray(value) ? value : [];
  const fileList: UploadFile[] = rawList.map((f, i) => ({
    uid: f?.uid ?? String(i),
    name: f?.name ?? 'file',
    status: 'done',
    originFileObj: f?.originFileObj as UploadFile['originFileObj'],
  }));
  const file = fileList[0]?.originFileObj;
  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Upload
        accept={accept}
        maxCount={1}
        fileList={fileList}
        beforeUpload={(f) => {
          if (f.size > maxSizeMB * 1024 * 1024) {
            message.error(`File must be smaller than ${maxSizeMB} MB`);
            return Upload.LIST_IGNORE;
          }
          onChange?.([{ uid: f.uid, name: f.name, originFileObj: f }]);
          return false;
        }}
        onRemove={() => onChange?.([])}
      >
        <Button icon={<PlusOutlined />}>Select file</Button>
      </Upload>
      {file && (
        <div
          style={{
            padding: token.paddingSM,
            background: token.colorFillQuaternary,
            borderRadius: token.borderRadiusSM,
            fontSize: token.fontSizeSM,
          }}
        >
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
            {file.name}
          </Typography.Text>
          <Space size="middle" split={<span style={{ color: token.colorTextQuaternary }}>·</span>}>
            <Typography.Text type="secondary">{formatFileSize(file.size)}</Typography.Text>
            <Typography.Text type="secondary">{file.type || 'Unknown type'}</Typography.Text>
          </Space>
        </div>
      )}
    </Space>
  );
}
