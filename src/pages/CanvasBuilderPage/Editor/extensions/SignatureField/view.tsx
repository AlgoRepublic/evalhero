import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  Button,
  Modal,
  Radio,
  Input,
  Space,
  message,
  theme,
  Card,
  Flex,
  Tooltip,
  Divider,
  Tag,
} from 'antd';
import SignaturePad from 'react-signature-canvas';
import { EditOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import SignatureEditModal from './editModel';
import { uploadFile } from '../../../../../utils/uploadApi';

const SignatureComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();

  const mode = (editor as any)?.storage?.formBuilder?.mode ?? 'readonly';
  const submitted = (editor as any)?.storage?.formBuilder?.submitted === true;
  const isEditMode = mode === 'edit';
  const isSubmitMode = mode === 'submit';
  const isReadonlyMode = mode === 'readonly' || (mode === 'submit' && submitted);

  const {
    mode: signatureMode = 'draw',
    signerName = null,
    timestamp = null,
    dataUrl: initialDataUrl = null,
    uploadedUrl: initialUploadedUrl = null,
    requireSignerName = false,
  } = node.attrs;

  // Grouping support (same pattern as Matrix/Choice fields)
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

  const [showEditModal, setShowEditModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState<'draw' | 'type'>(signatureMode);
  const [name, setName] = useState<string>(signerName ?? '');
  const [saving, setSaving] = useState(false);
  const sigRef = useRef<InstanceType<typeof SignaturePad> | null>(null);
  const isBrowser = typeof window !== 'undefined' && !!window.document;

  const readSignature = useCallback((entityId?: string | null) => {
    if (shouldShowGrouping && entityId) {
      const v = nodeGroupValues[entityId];
      if (v && typeof v === 'object') {
        return {
          mode: (v.mode as 'draw' | 'type') ?? 'draw',
          signerName: v.signerName ?? null,
          timestamp: v.timestamp ?? null,
          dataUrl: v.dataUrl ?? null,
          uploadedUrl: v.uploadedUrl ?? null,
          signatureId: v.signatureId ?? null,
          signatureName: v.signatureName ?? null,
        };
      }
      return {
        mode: 'draw' as const,
        signerName: null,
        timestamp: null,
        dataUrl: null,
        uploadedUrl: null,
        signatureId: null,
        signatureName: null,
      };
    }
    return {
      mode: signatureMode as 'draw' | 'type',
      signerName,
      timestamp,
      dataUrl: initialDataUrl,
      uploadedUrl: initialUploadedUrl,
      signatureId: (node.attrs as any).signatureId ?? null,
      signatureName: (node.attrs as any).signatureName ?? null,
    };
  }, [initialDataUrl, initialUploadedUrl, node.attrs, nodeGroupValues, shouldShowGrouping, signatureMode, signerName, timestamp]);

  const writeSignature = (next: Record<string, unknown>, entityId?: string | null) => {
    if (shouldShowGrouping && entityId) {
      updateAttributes({
        nodeGroupValues: {
          ...(nodeGroupValues || {}),
          [entityId]: {
            ...(nodeGroupValues?.[entityId] || {}),
            ...next,
          },
        },
      });
      return;
    }
    updateAttributes(next);
  };
  const editSignature = readSignature(null);
  const editSignatureImageUrl = editSignature.uploadedUrl || editSignature.dataUrl || null;
  const hasEditSignature = !!(editSignatureImageUrl || (editSignature.signerName && editSignature.timestamp));

  useEffect(() => {
    if (!showSignModal) return;
    const sig = readSignature(activeEntityId);
    setLocalMode(sig.mode ?? 'draw');
    setName(sig.signerName ?? '');
  }, [activeEntityId, readSignature, showSignModal]);

  const clearSignature = (entityId?: string | null) => {
    try {
      sigRef.current?.clear?.();
    } catch (e) {
      // Ignore clear errors
    }
    writeSignature({
      dataUrl: null,
      uploadedUrl: null,
      signerName: null,
      timestamp: null,
      mode: 'draw',
      signatureId: null,
      signatureName: null,
    }, entityId ?? activeEntityId);
    message.success('Signature cleared');
  };

  const saveTyped = async () => {
    const trimmedName = name?.trim() || '';
    if (requireSignerName && !trimmedName) {
      message.error('Signer name is required');
      return;
    }

    setSaving(true);
    try {
      const ts = new Date().toISOString();
      writeSignature({
        mode: 'type',
        signerName: trimmedName || null,
        timestamp: ts,
        dataUrl: null,
        uploadedUrl: null,
        signatureId: null,
        signatureName: null,
      }, activeEntityId);
      message.success('Signature saved');
      setShowSignModal(false);
    } catch (err) {
      console.error('Failed to save typed signature:', err);
      message.error('Failed to save signature');
    } finally {
      setSaving(false);
    }
  };

  const saveDrawn = async () => {
    if (!isBrowser) {
      message.error('Signature drawing requires a browser environment');
      return;
    }
    if (!sigRef.current) {
      message.error('Signature pad not ready');
      return;
    }

    // Check if signature is empty
    try {
      const isEmpty =
        typeof sigRef.current.isEmpty === 'function'
          ? sigRef.current.isEmpty()
          : false;
      if (isEmpty) {
        message.error('Please draw a signature before saving');
        return;
      }
    } catch (e) {
      // Continue if isEmpty check fails
    }

    const trimmedName = name?.trim() || '';
    if (requireSignerName && !trimmedName) {
      message.error('Signer name is required');
      return;
    }

    setSaving(true);
    try {
      let canvas: HTMLCanvasElement | null = null;

      // Use getCanvas directly to avoid getTrimmedCanvas runtime issues.
      try {
        if (typeof sigRef.current.getCanvas === 'function') {
          canvas = sigRef.current.getCanvas();
        }
      } catch (err) {
        console.error('Canvas extraction failed', err);
      }

      if (!canvas) {
        message.error('Failed to extract signature image');
        setSaving(false);
        return;
      }

      const ts = new Date().toISOString();

      // Convert canvas to blob for upload
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            message.error('Failed to convert signature to image');
            setSaving(false);
            return;
          }

          try {
            const uploadedUrl = await uploadFile(blob);
            writeSignature({
              mode: 'draw',
              signerName: trimmedName || null,
              timestamp: ts,
              dataUrl: null,
              uploadedUrl,
            }, activeEntityId);
            message.success('Signature saved');
            setShowSignModal(false);
            setSaving(false);
          } catch (err) {
            console.error('Upload error', err);
            // Fallback to dataURL
            const dataUrl = canvas?.toDataURL('image/png');
            if (dataUrl && canvas) {
              writeSignature({
                mode: 'draw',
                signerName: trimmedName || null,
                timestamp: ts,
                dataUrl: dataUrl,
                uploadedUrl: null,
              }, activeEntityId);
              message.warning('Signature saved locally (upload failed)');
              setShowSignModal(false);
            }
            setSaving(false);
          }
        },
        'image/png',
        0.95
      );
    } catch (err) {
      console.error('Save error', err);
      message.error('Failed to save signature');
      setSaving(false);
    }
  };

  return (
    <NodeViewWrapper
      {...(isEditMode ? { 'data-drag-handle': true } : {})}
      style={{ margin: '4px 0' }}
    >
      <SignatureEditModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        nodeAttrs={node.attrs}
        onSave={(values) => {
          updateAttributes(values);
          setShowEditModal(false);
        }}
      />

      <Card
        size="small"
        style={{
          margin: 0,
          borderRadius: token.borderRadius,
          background: token.colorBgContainer,
        }}
        variant="outlined"
        styles={{ body: { padding: '12px' } }}
      >
        {/* Header with label and edit controls */}
        <Flex justify="space-between" align="flex-start" style={{ marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div
              contentEditable={isSubmitMode ? false : undefined}
              style={{ fontWeight: 500, fontSize: 14 }}
            >
              <NodeViewContent className="signature-label" />
            </div>
          </div>
          {isEditMode && (
            <Space size={4} style={{ alignSelf: 'flex-start', marginLeft: 8 }}>
              <Tooltip title="Edit field settings">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setShowEditModal(true)}
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

        {/* Signature pad or display area */}
        {!isEditMode && (
          <div style={{ marginTop: 8 }}>
            {(shouldShowGrouping ? [
              ...groupsToUse.map((group: any) => ({
                entityId: `group-${group.id}`,
                title: group.name,
                isGroup: true,
                subjects: (group.subjectIds || [])
                  .map((id: string) => subjectsOptions.find((s: any) => s.value === id))
                  .filter(Boolean)
                  .map((s: any) => s.label)
                  .join(', '),
              })),
              ...ungroupedSubjects.map((subject: any) => ({
                entityId: `ungrouped-${subject.value}`,
                title: subject.label ?? subject.value,
                isGroup: false,
                subjects: '',
              })),
            ] : [{ entityId: null, title: '', isGroup: false, subjects: '' }]).map((entry) => {
              const sig = readSignature(entry.entityId);
              const imageUrl = sig.uploadedUrl || sig.dataUrl || null;
              const hasSig = !!(imageUrl || (sig.signerName && sig.timestamp));
              const content = (
                <>
                  {hasSig ? (
                    <div>
                      {imageUrl ? (
                        <div
                          style={{
                            border: `1px solid ${token.colorBorder}`,
                            borderRadius: token.borderRadius,
                            padding: 8,
                            background: token.colorBgLayout,
                            display: 'inline-block',
                          }}
                        >
                          <img
                            src={imageUrl}
                            alt="signature"
                            style={{ maxWidth: 280, maxHeight: 120, display: 'block' }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            border: `1px solid ${token.colorBorder}`,
                            borderRadius: token.borderRadius,
                            padding: '12px 16px',
                            background: token.colorBgLayout,
                            display: 'inline-block',
                            minWidth: 200,
                          }}
                        >
                          <div style={{ fontSize: 16, fontWeight: 500, color: token.colorText, marginBottom: 4, fontFamily: 'cursive' }}>
                            {sig.signerName || '—'}
                          </div>
                          <Divider style={{ margin: '4px 0' }} />
                          <div style={{ fontSize: 11, color: token.colorTextSecondary, fontFamily: 'monospace' }}>
                            {sig.timestamp ? dayjs(sig.timestamp).format('MMM D, YYYY [at] h:mm A') : '—'}
                          </div>
                        </div>
                      )}
                      <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 12 }} />
                        <span>
                          Signed by {sig.signerName || '—'} on {sig.timestamp ? dayjs(sig.timestamp).format('MMM D, YYYY [at] h:mm A') : '—'}
                        </span>
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <Button size="small" icon={<EditOutlined />} onClick={() => { setActiveEntityId(entry.entityId); setShowSignModal(true); }}>
                          Update Signature
                        </Button>
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => clearSignature(entry.entityId)}>
                          Clear
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => {
                        setActiveEntityId(entry.entityId);
                        setShowSignModal(true);
                      }}
                    >
                      Add Signature
                    </Button>
                  )}
                </>
              );

              if (!shouldShowGrouping) return <div key="signature-single">{content}</div>;

              return (
                <Card
                  key={entry.entityId || 'single'}
                  size="small"
                  style={{ marginBottom: 10, background: token.colorFillAlter }}
                  title={
                    <Space>
                      {entry.isGroup ? <Tag color="blue">Group</Tag> : <Tag>Ungrouped</Tag>}
                      <span>{entry.title}</span>
                      {entry.subjects ? <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>({entry.subjects})</span> : null}
                    </Space>
                  }
                >
                  {content}
                </Card>
              );
            })}
          </div>
        )}

        {/* Edit mode: show signature if exists */}
        {isEditMode && hasEditSignature && (
          <div style={{ marginTop: 8 }}>
            {editSignatureImageUrl ? (
              <div
                style={{
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: token.borderRadius,
                  padding: 8,
                  background: token.colorBgLayout,
                  display: 'inline-block',
                }}
              >
                <img
                  src={editSignatureImageUrl}
                  alt="signature"
                  style={{
                    maxWidth: 280,
                    maxHeight: 120,
                    display: 'block',
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: token.borderRadius,
                  padding: '12px 16px',
                  background: token.colorBgLayout,
                  display: 'inline-block',
                  minWidth: 200,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: token.colorText,
                    marginBottom: 4,
                    fontFamily: 'cursive',
                  }}
                >
                  {editSignature.signerName || '—'}
                </div>
                <Divider style={{ margin: '4px 0' }} />
                <div
                  style={{
                    fontSize: 11,
                    color: token.colorTextSecondary,
                    fontFamily: 'monospace',
                  }}
                >
                  {editSignature.timestamp
                    ? dayjs(editSignature.timestamp).format('MMM D, YYYY [at] h:mm A')
                    : '—'}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Signature modal */}
      <Modal
        open={showSignModal}
        onCancel={() => setShowSignModal(false)}
        onOk={() => (localMode === 'draw' ? saveDrawn() : saveTyped())}
        okText="Save"
        cancelText="Cancel"
        okButtonProps={{ loading: saving }}
        title="Add Signature"
        width={600}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
              Signature Type
            </div>
            <Radio.Group
              value={localMode}
              onChange={(e) => setLocalMode(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="draw">Draw</Radio.Button>
              <Radio.Button value="type">Type</Radio.Button>
            </Radio.Group>
          </div>

          <div>
            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
              Signer Name {requireSignerName && <span style={{ color: token.colorError }}>*</span>}
            </div>
            <Input
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="middle"
            />
          </div>

          {localMode === 'draw' && (
            <div>
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
                Draw Your Signature
              </div>
              {isBrowser ? (
                <>
                  <div
                    style={{
                      border: `1px solid ${token.colorBorder}`,
                      borderRadius: token.borderRadius,
                      height: 200,
                      background: token.colorBgContainer,
                    }}
                  >
                    <SignaturePad
                      ref={sigRef}
                      canvasProps={{
                        width: 560,
                        height: 200,
                        style: {
                          width: '100%',
                          height: 200,
                          touchAction: 'none',
                          cursor: 'crosshair',
                          backgroundColor: token.colorBgContainer,
                        },
                      }}
                      backgroundColor={token.colorBgContainer}
                      penColor={token.colorText}
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Button
                      size="small"
                      onClick={() => sigRef.current?.clear()}
                    >
                      Clear Canvas
                    </Button>
                  </div>
                </>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', color: token.colorTextSecondary }}>
                  Signature drawing requires a browser environment.
                </div>
              )}
            </div>
          )}

          {localMode === 'type' && (
            <div
              style={{
                padding: 16,
                background: token.colorFillQuaternary,
                borderRadius: token.borderRadius,
                border: `1px solid ${token.colorBorder}`,
              }}
            >
              <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                Typed signature will record your name and timestamp as a digital
                consent record. This is suitable for evaluator/trainee sign-offs
                and taskbook signoffs.
              </div>
            </div>
          )}
        </Space>
      </Modal>
    </NodeViewWrapper>
  );
};

export default SignatureComponent;
