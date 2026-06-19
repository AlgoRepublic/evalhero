import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  Upload,
  Button,
  Modal,
  Tooltip,
  message,
  Card,
  Flex,
  Space,
  theme,
  Tag,
  Progress,
  Typography,
  Image,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  FileOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload/interface';
import FileEditModal from './editModel';
import { uploadFile } from '../../../../../utils/uploadApi';

const { Text } = Typography;

// File size formatter
const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// File type icon helper
const getFileIcon = (mime?: string, name?: string) => {
  if (mime?.startsWith('image/')) {
    return <FileImageOutlined style={{ fontSize: 16, color: '#1890ff' }} />;
  }
  if (mime === 'application/pdf' || name?.toLowerCase().endsWith('.pdf')) {
    return <FilePdfOutlined style={{ fontSize: 16, color: '#ff4d4f' }} />;
  }
  return <FileOutlined style={{ fontSize: 16, color: '#8c8c8c' }} />;
};

// Scan status helper
const getScanStatusTag = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'clean':
    case 'safe':
    case 'passed':
      return <Tag color="success" icon={<CheckCircleOutlined />}>Safe</Tag>;
    case 'infected':
    case 'malicious':
    case 'failed':
      return <Tag color="error" icon={<CloseCircleOutlined />}>Unsafe</Tag>;
    case 'scanning':
    case 'pending':
      return <Tag color="processing" icon={<LoadingOutlined />}>Scanning</Tag>;
    case 'queued':
      return <Tag color="default">Queued</Tag>;
    default:
      return <Tag color="default">Unknown</Tag>;
  }
};

// Type definitions
export type UploadedFile = {
  id: string;
  url: string;
  name: string;
  size: number;
  mime?: string;
  scanStatus?: 'queued' | 'scanning' | 'clean' | 'safe' | 'passed' | 'infected' | 'malicious' | 'failed';
  uploadedAt?: string;
  hash?: string;
  [key: string]: unknown;
};

type FileFieldAttributes = {
  label?: string;
  allowedTypes?: string[];
  maxSizeBytes?: number;
  maxCount?: number;
  files?: UploadedFile[];
  required?: boolean;
  uploadEndpoint?: string;
  deleteEndpoint?: string;
  onVirusScanComplete?: (fileId: string, status: string) => void;
  onVirusScanError?: (fileId: string, error: Error) => void;
};

// Virus scan hook interface
export interface VirusScanHook {
  onScanStart?: (fileId: string, fileName: string) => void;
  onScanComplete?: (fileId: string, status: string) => void;
  onScanError?: (fileId: string, error: Error) => void;
  pollScanStatus?: (fileId: string) => Promise<string>;
}

const FileNodeComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();
  const [modal, contextHolder] = Modal.useModal();

  // Mode + grouping support (same pattern as Matrix/Choice fields)
  const mode =
    (editor as any)?.storage?.formBuilder?.mode ?? 'readonly';
  const submitted = (editor as any)?.storage?.formBuilder?.submitted === true;
  const isSubmitMode = mode === 'submit';
  const isEditMode = mode === 'edit';
  const isReadonlyMode = mode === 'readonly' || (mode === 'submit' && submitted);

  const globalGroups = (editor as any)?.storage?.formBuilder?.globalGroups || [];
  const availableSubjects = (editor as any)?.storage?.formBuilder?.availableSubjects || [];
  const subjectsOptions = (editor as any)?.storage?.formBuilder?.subjects || [];
  const isAllLocked = (editor as any)?.storage?.formBuilder?.isAllLocked || false;

  const enableGrouping = node.attrs.enableGrouping === true || node.attrs.enableGrouping === 'true';
  const nodeGroups = Array.isArray(node.attrs.nodeGroups) ? node.attrs.nodeGroups : [];
  const nodeGroupValues =
    node.attrs.nodeGroupValues && typeof node.attrs.nodeGroupValues === 'object'
      ? (node.attrs.nodeGroupValues as Record<string, any>)
      : {};

  const groupsToUse = enableGrouping && nodeGroups.length > 0 ? nodeGroups : globalGroups;

  const usedSubjectIds = useMemo(() => {
    const used = new Set<string>();
    if (enableGrouping && nodeGroups.length > 0) {
      nodeGroups.forEach((g: any) => {
        (g.subjectIds || []).forEach((id: string) => used.add(id));
      });
    }
    return used;
  }, [enableGrouping, nodeGroups]);

  const ungroupedSubjects = useMemo(() => {
    return enableGrouping && nodeGroups.length > 0
      ? subjectsOptions.filter((s: any) => !usedSubjectIds.has(s.value))
      : availableSubjects;
  }, [enableGrouping, nodeGroups.length, subjectsOptions, availableSubjects, usedSubjectIds]);

  const shouldShowGrouping =
    (isSubmitMode || isReadonlyMode) &&
    (isSubmitMode ? isAllLocked : true) &&
    (groupsToUse.length > 0 || ungroupedSubjects.length > 0);

  const groupingEntityOptions = useMemo(() => {
    if (!shouldShowGrouping) return [];
    const groupOpts = (groupsToUse || []).map((g: any) => ({
      label: `Group: ${g.name ?? g.id}`,
      value: `group-${g.id}`,
    }));
    const subjectOpts = (ungroupedSubjects || []).map((s: any) => ({
      label: `Subject: ${s.label ?? s.value}`,
      value: `ungrouped-${s.value}`,
    }));
    return [...groupOpts, ...subjectOpts];
  }, [groupsToUse, shouldShowGrouping, ungroupedSubjects]);

  const {
    allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
    maxSizeBytes = 10 * 1024 * 1024, // 10MB default
    maxCount = 5,
    uploadEndpoint = '/api/uploads',
    deleteEndpoint = '/api/files',
    required = false,
  } = node.attrs as FileFieldAttributes;
  const requiredBool = typeof required === 'string'
    ? required === 'true'
    : !!required;

  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'other'>('other');
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map());
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldShowGrouping) {
      setSelectedEntityId(null);
      return;
    }
    const first = groupingEntityOptions[0]?.value ?? null;
    setSelectedEntityId((prev) => prev ?? first);
  }, [groupingEntityOptions, shouldShowGrouping]);

  const initialFiles: UploadedFile[] = useMemo(
    () => {
      if (shouldShowGrouping && selectedEntityId) {
        const v = nodeGroupValues[selectedEntityId];
        return Array.isArray(v) ? (v as UploadedFile[]) : [];
      }
      return Array.isArray(node.attrs.files) ? (node.attrs.files as UploadedFile[]) : [];
    },
    [node.attrs.files, nodeGroupValues, selectedEntityId, shouldShowGrouping]
  );

  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  // Poll for virus scan status
  const pollScanStatus = useCallback(async (fileId: string): Promise<string> => {
    try {
      const response = await fetch(`${uploadEndpoint}/scan-status/${fileId}`);
      if (!response.ok) throw new Error('Failed to fetch scan status');
      const data = await response.json();
      return data.status || 'unknown';
    } catch (err) {
      console.error('Error polling scan status:', err);
      return 'unknown';
    }
  }, [uploadEndpoint]);

  // Check and update scan status for files
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    const filesNeedingScan = files.filter(
      (f) =>
        (f.scanStatus === 'queued' || f.scanStatus === 'scanning') &&
        typeof f.id === 'string' &&
        !f.id.startsWith('upload-')
    );

    if (filesNeedingScan.length === 0) return;

    const interval = setInterval(async () => {
      const currentFiles = filesRef.current;
      const filesToCheck = currentFiles.filter(
        (f) =>
          (f.scanStatus === 'queued' || f.scanStatus === 'scanning') &&
          typeof f.id === 'string' &&
          !f.id.startsWith('upload-')
      );

      for (const file of filesToCheck) {
        try {
          const status = await pollScanStatus(file.id);
          const currentFile = filesRef.current.find((f) => f.id === file.id);
          if (currentFile && status !== currentFile.scanStatus) {
            const updatedFiles = filesRef.current.map((f) =>
              f.id === file.id ? { ...f, scanStatus: status as UploadedFile['scanStatus'] } : f
            );
            filesRef.current = updatedFiles;
            setFiles(updatedFiles);
            if (shouldShowGrouping && selectedEntityId) {
              updateAttributes({
                nodeGroupValues: {
                  ...(nodeGroupValues || {}),
                  [selectedEntityId]: updatedFiles,
                },
              });
            } else {
              updateAttributes({ files: updatedFiles });
            }

            // Call virus scan hooks if provided
            const hooks = (node.attrs as FileFieldAttributes).onVirusScanComplete;
            if (hooks && typeof hooks === 'function') {
              hooks(file.id, status);
            }
          }
        } catch (err) {
          const hooks = (node.attrs as FileFieldAttributes).onVirusScanError;
          if (hooks && typeof hooks === 'function') {
            hooks(file.id, err as Error);
          }
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [pollScanStatus, updateAttributes, node.attrs, shouldShowGrouping, selectedEntityId, nodeGroupValues, files]);

  const validateFile = useCallback(
    (file: RcFile): { valid: boolean; error?: string } => {
      // Check file type
      if (allowedTypes && allowedTypes.length > 0) {
        const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
        const matchesMime = allowedTypes.includes(file.type);
        const matchesExt = allowedTypes.some((type) => type.toLowerCase() === fileExt);

        if (!matchesMime && !matchesExt) {
          return {
            valid: false,
            error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
          };
        }
      }

      // Check file size
      if (maxSizeBytes && file.size > maxSizeBytes) {
        return {
          valid: false,
          error: `File size exceeds maximum allowed size of ${formatFileSize(maxSizeBytes)}`,
        };
      }

      // Check file count
      if (maxCount && files.length >= maxCount) {
        return {
          valid: false,
          error: `Maximum ${maxCount} file(s) allowed`,
        };
      }

      return { valid: true };
    },
    [allowedTypes, maxSizeBytes, maxCount, files.length]
  );

  const beforeUpload = useCallback(
    (file: RcFile) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        message.error(validation.error || 'File validation failed');
        setError(validation.error || null);
        return Upload.LIST_IGNORE;
      }
      setError(null);
      return true;
    },
    [validateFile]
  );

  const customRequest = useCallback(
    async (options: {
      file: RcFile | Blob | string;
      onProgress?: (info: { percent: number }) => void;
      onError?: (error: Error) => void;
      onSuccess?: (response: unknown) => void;
    }) => {
      const { file, onProgress, onError, onSuccess } = options;
      
      // Ensure file is a File/Blob object, not a string
      if (typeof file === 'string') {
        onError?.(new Error('File must be a File or Blob object'));
        return;
      }
      
      const fileObj = file as RcFile;
      const fileId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      try {
        setUploadingFiles((prev) => new Map(prev).set(fileId, 10));
        onProgress?.({ percent: 10 });

        const uploadedUrl = await uploadFile(fileObj);

        setUploadingFiles((prev) => new Map(prev).set(fileId, 100));
        onProgress?.({ percent: 100 });

        const uploadedFile: UploadedFile = {
          id: fileId,
          url: uploadedUrl,
          name: fileObj.name || 'uploaded-file',
          size: fileObj.size || 0,
          mime: fileObj.type,
          scanStatus: 'queued',
          uploadedAt: new Date().toISOString(),
        };

        const next = [...files, uploadedFile];
        setFiles(next);
        if (shouldShowGrouping && selectedEntityId) {
          updateAttributes({
            nodeGroupValues: {
              ...(nodeGroupValues || {}),
              [selectedEntityId]: next,
            },
          });
        } else {
          updateAttributes({ files: next });
        }
        onSuccess?.(uploadedFile);
        message.success(`${uploadedFile.name} uploaded successfully`);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed');
        onError?.(error);
        message.error(error.message || 'Upload failed');
      } finally {
        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.delete(fileId);
          return next;
        });
      }
    },
    [files, updateAttributes, shouldShowGrouping, selectedEntityId, nodeGroupValues]
  );

  const handleRemove = useCallback(
    async (item: UploadedFile) => {
      modal.confirm({
        title: 'Remove file',
        content: `Are you sure you want to remove "${item.name}"?`,
        okText: 'Remove',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            // Attempt to delete from server
            if (deleteEndpoint && item.id) {
              await fetch(`${deleteEndpoint}/${encodeURIComponent(item.id)}`, {
                method: 'DELETE',
              }).catch(() => {
                // Ignore server errors, still remove from UI
              });
            }

            const next = files.filter((f) => f.id !== item.id);
            setFiles(next);
            if (shouldShowGrouping && selectedEntityId) {
              updateAttributes({
                nodeGroupValues: {
                  ...(nodeGroupValues || {}),
                  [selectedEntityId]: next,
                },
              });
            } else {
              updateAttributes({ files: next });
            }
            message.success('File removed');
          } catch (err) {
            message.error('Failed to remove file');
          }
        },
      });
    },
    [files, updateAttributes, deleteEndpoint, shouldShowGrouping, selectedEntityId, nodeGroupValues]
  );

  const handlePreview = useCallback((file: UploadedFile) => {
    if (!file.url) return;

    const mime = file.mime || '';
    if (mime.startsWith('image/')) {
      setPreviewType('image');
    } else if (mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setPreviewType('pdf');
    } else {
      setPreviewType('other');
    }

    setPreviewUrl(file.url);
  }, []);

  const handleDownload = useCallback((file: UploadedFile) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const isReadonly = isReadonlyMode;
  const hasError = error || (mode === 'submit' && submitted && requiredBool && files.length === 0);
  const getEntityFiles = useCallback(
    (entityId: string) => {
      const value = (nodeGroupValues as any)[entityId];
      return Array.isArray(value) ? (value as UploadedFile[]) : [];
    },
    [nodeGroupValues]
  );
  const setEntityFiles = useCallback(
    (entityId: string, next: UploadedFile[]) => {
      updateAttributes({
        nodeGroupValues: {
          ...(nodeGroupValues || {}),
          [entityId]: next,
        },
      });
    },
    [nodeGroupValues, updateAttributes]
  );
  const groupedCustomRequest = useCallback(
    (entityId: string, entityFiles: UploadedFile[]) =>
      async (options: {
        file: RcFile | Blob | string;
        onProgress?: (info: { percent: number }) => void;
        onError?: (error: Error) => void;
        onSuccess?: (response: unknown) => void;
      }) => {
        const { file, onProgress, onError, onSuccess } = options;
        if (typeof file === 'string') {
          onError?.(new Error('File must be a File or Blob object'));
          return;
        }
        const fileObj = file as RcFile;
        const fileId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        try {
          setUploadingFiles((prev) => new Map(prev).set(fileId, 10));
          onProgress?.({ percent: 10 });
          const uploadedUrl = await uploadFile(fileObj);
          setUploadingFiles((prev) => new Map(prev).set(fileId, 100));
          onProgress?.({ percent: 100 });
          const uploadedFile: UploadedFile = {
            id: fileId,
            url: uploadedUrl,
            name: fileObj.name || 'uploaded-file',
            size: fileObj.size || 0,
            mime: fileObj.type,
            scanStatus: 'queued',
            uploadedAt: new Date().toISOString(),
          };
          const next = [...entityFiles, uploadedFile];
          setEntityFiles(entityId, next);
          onSuccess?.(uploadedFile);
          message.success(`${uploadedFile.name} uploaded successfully`);
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Upload failed');
          onError?.(error);
          message.error(error.message || 'Upload failed');
        } finally {
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            next.delete(fileId);
            return next;
          });
        }
      },
    [setEntityFiles]
  );
  const groupedBeforeUpload = useCallback(
    (entityFiles: UploadedFile[]) => (file: RcFile) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        message.error(validation.error || 'File validation failed');
        setError(validation.error || null);
        return Upload.LIST_IGNORE;
      }
      if (maxCount && entityFiles.length >= maxCount) {
        message.error(`Maximum ${maxCount} file(s) allowed`);
        return Upload.LIST_IGNORE;
      }
      setError(null);
      return true;
    },
    [maxCount, validateFile]
  );
  const groupedRemove = useCallback(
    async (entityId: string, entityFiles: UploadedFile[], item: UploadedFile) => {
      modal.confirm({
        title: 'Remove file',
        content: `Are you sure you want to remove "${item.name}"?`,
        okText: 'Remove',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          const next = entityFiles.filter((f) => f.id !== item.id);
          setEntityFiles(entityId, next);
          message.success('File removed');
        },
      });
    },
    [modal, setEntityFiles]
  );

  return (
    <NodeViewWrapper
      {...(isEditMode ? { 'data-drag-handle': true } : {})}
      style={{ margin: '4px 0' }}
    >
      {contextHolder}
      <FileEditModal
        open={showModal}
        onClose={() => setShowModal(false)}
        nodeAttrs={node.attrs}
        onSave={(values) => {
          updateAttributes(values);
          setShowModal(false);
        }}
      />
      <Card
        size="small"
        style={{
          margin: '4px 0',
          borderColor: hasError ? token.colorError : token.colorBorder,
          borderRadius: token.borderRadius,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
        styles={{ body: { padding: '12px' } }}
      >
        {/* Header */}
        <Flex justify="space-between" align="flex-start" style={{ marginBottom: files.length > 0 ? 8 : 0 }}>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div
              contentEditable={isReadonly ? false : undefined}
              style={{
                fontWeight: 500,
                fontSize: '14px',
                color: token.colorText,
                outline: 'none',
                minHeight: '22px',
              }}
            >
              <NodeViewContent className="file-label" />
            </div>
            {requiredBool && (
              <Tag
                color="red"
                style={{
                  marginLeft: 0,
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  paddingInline: 8,
                  paddingBlock: 2,
                  marginTop: 6,
                  marginBottom: 6,
                }}
              >
                Required
              </Tag>
            )}
          </div>
          {isEditMode && (
            <Space size={4} style={{ alignSelf: 'flex-start', marginLeft: 8 }}>
              <Tooltip title="Edit field settings">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setShowModal(true)}
                />
              </Tooltip>
              <Tooltip title="Delete field">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={deleteNode}
                />
              </Tooltip>
            </Space>
          )}
        </Flex>

        {/* Error message */}
        {error && (
          <Text type="danger" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
            {error}
          </Text>
        )}

        {shouldShowGrouping && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {groupsToUse.map((group: any) => {
              const entityId = `group-${group.id}`;
              const entityFiles = getEntityFiles(entityId);
              const groupSubjects = (group.subjectIds || [])
                .map((id: string) => subjectsOptions.find((s: any) => s.value === id))
                .filter(Boolean)
                .map((s: any) => s.label)
                .join(', ');
              return (
                <Card key={entityId} size="small" style={{ background: token.colorFillAlter }}>
                  <div style={{ marginBottom: 8 }}>
                    <Space>
                      <Tag color="blue">Group</Tag>
                      <span>{group.name}</span>
                      {groupSubjects ? <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>({groupSubjects})</span> : null}
                    </Space>
                  </div>
                  {!isReadonly && (
                    <Upload
                      customRequest={groupedCustomRequest(entityId, entityFiles)}
                      beforeUpload={groupedBeforeUpload(entityFiles)}
                      showUploadList={false}
                      multiple={maxCount > 1}
                      disabled={entityFiles.length >= maxCount}
                    >
                      <Button icon={<UploadOutlined />} size="small" disabled={entityFiles.length >= maxCount}>
                        {entityFiles.length >= maxCount ? `Max ${maxCount} files` : 'Upload file'}
                      </Button>
                    </Upload>
                  )}
                  {entityFiles.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {entityFiles.map((file) => (
                        <div key={`${entityId}-${file.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text ellipsis style={{ maxWidth: 260 }}>{file.name}</Text>
                          <Space size={4}>
                            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(file)} />
                            {!isReadonly && <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => groupedRemove(entityId, entityFiles, file)} />}
                          </Space>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
            {ungroupedSubjects.length > 0 && (
              <Card size="small" style={{ background: token.colorFillAlter }} title={<Tag>Ungrouped Subjects</Tag>}>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {ungroupedSubjects.map((subject: any) => {
                    const entityId = `ungrouped-${subject.value}`;
                    const entityFiles = getEntityFiles(entityId);
                    return (
                      <div key={entityId}>
                        <div style={{ marginBottom: 4 }}><Tag>{subject.label}</Tag></div>
                        {!isReadonly && (
                          <Upload
                            customRequest={groupedCustomRequest(entityId, entityFiles)}
                            beforeUpload={groupedBeforeUpload(entityFiles)}
                            showUploadList={false}
                            multiple={maxCount > 1}
                            disabled={entityFiles.length >= maxCount}
                          >
                            <Button icon={<UploadOutlined />} size="small" disabled={entityFiles.length >= maxCount}>
                              {entityFiles.length >= maxCount ? `Max ${maxCount} files` : 'Upload file'}
                            </Button>
                          </Upload>
                        )}
                        {entityFiles.length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            {entityFiles.map((file) => (
                              <div key={`${entityId}-${file.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <Text ellipsis style={{ maxWidth: 260 }}>{file.name}</Text>
                                <Space size={4}>
                                  <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(file)} />
                                  {!isReadonly && <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => groupedRemove(entityId, entityFiles, file)} />}
                                </Space>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Space>
              </Card>
            )}
          </Space>
        )}

        {/* Upload button */}
        {!isReadonly && !shouldShowGrouping && (
          <Upload
            customRequest={customRequest}
            beforeUpload={beforeUpload}
            showUploadList={false}
            multiple={maxCount > 1}
            disabled={files.length >= maxCount}
          >
            <Button
              icon={<UploadOutlined />}
              size="small"
              disabled={files.length >= maxCount}
              style={{ marginBottom: files.length > 0 ? 8 : 0 }}
            >
              {files.length >= maxCount ? `Max ${maxCount} files` : 'Upload file'}
            </Button>
          </Upload>
        )}

        {/* File constraints info */}
        {!isReadonly && !shouldShowGrouping && files.length < maxCount && (
          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: 4 }}>
            Max {formatFileSize(maxSizeBytes)} • {maxCount} file(s) • {allowedTypes.length > 0 ? allowedTypes.slice(0, 3).join(', ') : 'All types'}
            {allowedTypes.length > 3 && '...'}
          </Text>
        )}

        {/* File list - Compact design */}
        {!shouldShowGrouping && files.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {files.map((file) => {
              const uploadProgress = uploadingFiles.get(`upload-${file.id}`);

              return (
                <div
                  key={file.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    marginBottom: 4,
                    background: token.colorFillQuaternary,
                    borderRadius: token.borderRadiusSM,
                    fontSize: '12px',
                  }}
                >
                  {/* File icon */}
                  <div style={{ flexShrink: 0 }}>
                    {getFileIcon(file.mime, file.name)}
                  </div>

                  {/* File info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text
                        strong
                        ellipsis
                        style={{ fontSize: '12px', maxWidth: '200px' }}
                        title={file.name}
                      >
                        {file.name}
                      </Text>
                      {getScanStatusTag(file.scanStatus)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px' }}>
                      <Text type="secondary">{formatFileSize(file.size)}</Text>
                      {file.mime && (
                        <>
                          <Text type="secondary">•</Text>
                          <Text type="secondary">{file.mime.split('/')[1]?.toUpperCase() || 'FILE'}</Text>
                        </>
                      )}
                    </div>
                    {uploadProgress !== undefined && (
                      <Progress
                        percent={uploadProgress}
                        size="small"
                        showInfo={false}
                        style={{ marginTop: 4 }}
                      />
                    )}
                  </div>

                  {/* Actions */}
                  {!isReadonly && (
                    <Space size={4} style={{ flexShrink: 0 }}>
                      <Tooltip title="Preview">
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => handlePreview(file)}
                          disabled={!file.url}
                        />
                      </Tooltip>
                      <Tooltip title="Download">
                        <Button
                          type="text"
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownload(file)}
                          disabled={!file.url}
                        />
                      </Tooltip>
                      <Tooltip title="Remove">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemove(file)}
                        />
                      </Tooltip>
                    </Space>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Preview Modal */}
        <Modal
          open={!!previewUrl}
          footer={null}
          onCancel={() => {
            setPreviewUrl(null);
            setPreviewType('other');
          }}
          width={previewType === 'image' ? 800 : 900}
          style={{ top: 20 }}
        >
          {previewUrl && (
            <div style={{ textAlign: 'center', maxHeight: '80vh', overflow: 'auto' }}>
              {previewType === 'image' ? (
                <Image
                  src={previewUrl}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
                />
              ) : previewType === 'pdf' ? (
                <iframe
                  title="PDF Preview"
                  src={previewUrl}
                  style={{ width: '100%', height: '80vh', border: 'none' }}
                />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <FileOutlined style={{ fontSize: 48, color: token.colorTextSecondary }} />
                  <div style={{ marginTop: 16 }}>
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={() => previewUrl && handleDownload(files.find((f) => f.url === previewUrl)!)}
                    >
                      Download to view
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      </Card>
    </NodeViewWrapper>
  );
};

export { FileNodeComponent };
export default FileNodeComponent;
