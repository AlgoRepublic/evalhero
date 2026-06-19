import React, { useMemo, useEffect } from 'react';
import { Modal, Button, Space, Typography, Descriptions, message, Card, Tag, Tabs } from 'antd';
import { DownloadOutlined, CopyOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { JSONContent } from '@tiptap/core';
import { theme } from 'antd';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../CanvasBuilderPage/Editor/extensions';
import { TemplateEditor } from '../../CanvasBuilderPage';

const { Text } = Typography;

interface SubjectFormPreviewProps {
  open: boolean;
  onClose: () => void;
  subjectData: {
    metadata: {
      subjectId: string;
      subjectName: string;
      groupId: string | null;
      groupName: string | null;
      type: 'grouped' | 'ungrouped';
    };
    form: JSONContent;
    timestamp: string;
  } | null;
  formName?: string;
  assignmentId?: string;
  onSave?: (subjectId: string, formData: JSONContent) => Promise<void>;
}

export const SubjectFormPreview: React.FC<SubjectFormPreviewProps> = ({
  open,
  onClose,
  subjectData,
  formName = 'Form',
  assignmentId,
  onSave,
}) => {
  const { token } = theme.useToken();
  const [isSaving, setIsSaving] = React.useState(false);

  // Create read-only Tiptap instance
  const readonlyExtensions = useMemo(() => {
    try {
      return (extensions || []).filter((ext: any) => ext?.name !== 'slashCommand');
    } catch {
      return extensions;
    }
  }, []);

  const tiptap = useTiptapInstance({
    extensions: readonlyExtensions,
    initialContent: subjectData?.form || '',
    mode: 'readonly',
  });

  // Update editor content when subjectData changes
  useEffect(() => {
    if (subjectData?.form && tiptap.editor) {
      tiptap.setJSON(subjectData.form);
      
      // Set editor to readonly mode
      const storage = tiptap.editor.storage as any;
      storage.formBuilder = storage.formBuilder || {};
      storage.formBuilder.mode = 'readonly';
      
      // Disable editing
      tiptap.editor.setEditable(false);
    }
  }, [subjectData, tiptap]);

  const formattedJSON = useMemo(() => {
    if (!subjectData) return '';
    return JSON.stringify(subjectData, null, 2);
  }, [subjectData]);

  const handleDownload = () => {
    if (!subjectData) return;

    const blob = new Blob([formattedJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formName}_${subjectData.metadata.subjectName}_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Form data downloaded successfully');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJSON);
      message.success('Form data copied to clipboard');
    } catch (err) {
      message.error('Failed to copy to clipboard');
    }
  };

  const handleSave = async () => {
    if (!subjectData || !onSave) return;
    
    try {
      setIsSaving(true);
      await onSave(subjectData.metadata.subjectId, subjectData.form);
      message.success(`Form saved successfully for ${subjectData.metadata.subjectName}`);
      onClose();
    } catch (err: any) {
      message.error(err?.message || 'Failed to save form to backend');
    } finally {
      setIsSaving(false);
    }
  };

  // Extract all field values from the form - Commented out as Answers tab is hidden
  // const extractFieldValues = (node: JSONContent): Array<{ label: string; value: any; type: string }> => {
  //   const fields: Array<{ label: string; value: any; type: string }> = [];
  //   
  //   const walk = (n: JSONContent) => {
  //     if (!n) return;
  //     
  //     const attrs = n.attrs || {};
  //     const nodeType = n.type;
  //     
  //     // Field types that have values
  //     const fieldTypes = [
  //       'shortText', 'longText', 'numberField', 'ratingField', 
  //       'sliderField', 'dateField', 'dateTimeField', 'richText',
  //       'addressNode', 'lookupField', 'fileField', 'signatureField',
  //       'singleChoice', 'multipleChoice', 'ranking'
  //     ];
  //     
  //     if (fieldTypes.includes(nodeType || '')) {
  //       const label = attrs.label || attrs.name || nodeType;
  //       const value = attrs.value || attrs.order || null;
  //       
  //       if (value !== null && value !== undefined && value !== '') {
  //         fields.push({
  //           label: label as string,
  //           value,
  //           type: nodeType || 'unknown',
  //         });
  //       }
  //     }
  //     
  //     // Recurse
  //     if (Array.isArray(n.content)) {
  //       n.content.forEach(child => walk(child));
  //     }
  //   };
  //   
  //   walk(node);
  //   return fields;
  // };

  // const fieldValues = useMemo(() => {
  //   if (!subjectData?.form) return [];
  //   return extractFieldValues(subjectData.form);
  // }, [subjectData]);

  if (!subjectData) return null;

  return (
    <Modal
      title={
        <Space>
          <EyeOutlined style={{ color: token.colorPrimary }} />
          <span>Subject Form Preview</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="close" onClick={onClose} disabled={isSaving}>
          Close
        </Button>,
        <Button
          key="copy"
          icon={<CopyOutlined />}
          onClick={handleCopy}
          disabled={isSaving}
        >
          Copy JSON
        </Button>,
        <Button
          key="download"
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          disabled={isSaving}
        >
          Download JSON
        </Button>,
        ...(onSave && assignmentId ? [
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={isSaving}
          >
            Save to Backend
          </Button>
        ] : []),
      ]}
      style={{ top: 20 }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Metadata Section */}
        <Card
          size="small"
          style={{
            background: token.colorFillAlter,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Descriptions
            title="Subject Information"
            size="small"
            column={2}
            bordered
          >
            <Descriptions.Item label="Subject Name" span={2}>
              <Text strong>{subjectData.metadata.subjectName}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Subject ID">
              <Text code>{subjectData.metadata.subjectId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color={subjectData.metadata.type === 'grouped' ? 'blue' : 'default'}>
                {subjectData.metadata.type === 'grouped' ? 'Grouped' : 'Ungrouped'}
              </Tag>
            </Descriptions.Item>
            {subjectData.metadata.groupName && (
              <>
                <Descriptions.Item label="Group Name">
                  <Text strong>{subjectData.metadata.groupName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Group ID">
                  <Text code>{subjectData.metadata.groupId}</Text>
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="Generated At" span={2}>
              {new Date(subjectData.timestamp).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Tabbed Content */}
        <Tabs
          defaultActiveKey="form"
          items={[
            {
              key: 'form',
              label: 'Form Preview',
              children: (
                <Card
                  size="small"
                  style={{
                    background: token.colorFillAlter,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    maxHeight: '60vh',
                    overflow: 'auto',
                  }}
                >
                  {tiptap.editor ? (
                    <div style={{ pointerEvents: 'none', userSelect: 'text' }}>
                      <TemplateEditor instance={tiptap} />
                    </div>
                  ) : (
                    <Text type="secondary">Loading form preview...</Text>
                  )}
                </Card>
              ),
            },
            // {
            //   key: 'answers',
            //   label: `Answers (${fieldValues.length})`,
            //   children: (
            //     <Card
            //       size="small"
            //       style={{
            //         background: token.colorFillAlter,
            //         border: `1px solid ${token.colorBorderSecondary}`,
            //         maxHeight: '60vh',
            //         overflow: 'auto',
            //       }}
            //     >
            //       {fieldValues.length === 0 ? (
            //         <Text type="secondary">No answers filled yet</Text>
            //       ) : (
            //         <Descriptions
            //           size="small"
            //           column={1}
            //           bordered
            //           layout="vertical"
            //         >
            //           {fieldValues.map((field, index) => (
            //             <Descriptions.Item
            //               key={index}
            //               label={
            //                 <Space>
            //                   <Text strong>{field.label}</Text>
            //                   <Tag color="blue" style={{ fontSize: 10 }}>
            //                     {field.type}
            //                   </Tag>
            //                 </Space>
            //               }
            //             >
            //               <Text>
            //                 {typeof field.value === 'object'
            //                   ? JSON.stringify(field.value)
            //                   : String(field.value)}
            //               </Text>
            //             </Descriptions.Item>
            //           ))}
            //         </Descriptions>
            //       )}
            //     </Card>
            //   ),
            // },
            {
              key: 'json',
              label: 'Raw JSON',
              children: (
                <Card
                  size="small"
                  style={{
                    background: token.colorFillAlter,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <pre
                    style={{
                      background: token.colorBgContainer,
                      padding: 12,
                      borderRadius: 6,
                      maxHeight: '60vh',
                      overflow: 'auto',
                      fontSize: 12,
                      border: `1px solid ${token.colorBorder}`,
                      margin: 0,
                    }}
                  >
                    {formattedJSON}
                  </pre>
                </Card>
              ),
            },
          ]}
        />
      </Space>
    </Modal>
  );
};

