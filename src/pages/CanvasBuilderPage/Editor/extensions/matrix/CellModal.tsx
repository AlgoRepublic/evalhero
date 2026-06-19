/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { Modal, Input, Upload, Button, message, DatePicker, InputNumber, Rate, Segmented, Switch, Space, Radio, Checkbox, theme } from 'antd';
import SignaturePad from 'react-signature-canvas';
import { CloudUploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMediaQuery } from 'react-responsive';
import { uploadFile } from '../../../../../utils/uploadApi';
import { openMatrixAssetInNewTab, resolveMatrixAssetHref } from './utils';

export default function CellModal({
  visible,
  row,
  column,
  initialValue,
  viewOnly = false,
  onSave,
  onCancel,
}: any) {
  const { token } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const [value, setValue] = useState<any>(initialValue ?? null);
  const [uploading, setUploading] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const sigRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    setValue(initialValue ?? null);
    // Show signature pad only if there's no existing signature
    // Check for both string URLs and object format {url}
    const hasExistingSignature = initialValue && (
      (typeof initialValue === 'string' && initialValue.length > 0) ||
      (typeof initialValue === 'object' && initialValue !== null && initialValue.url)
    );
    setShowSignaturePad(!hasExistingSignature);
  }, [initialValue, visible]);

  const uploadProps = {
    customRequest: async ({ file, onSuccess, onError }: any) => {
      try {
        setUploading(true);
        const fileObj = file as File;
        const uploadedUrl = await uploadFile(fileObj);
        const meta = {
          name: fileObj.name,
          url: uploadedUrl,
          size: fileObj.size,
          type: fileObj.type,
        };
        setValue(meta);
        onSuccess && onSuccess('ok');
        message.success('File uploaded successfully');
      } catch (error: any) {
        console.error('Upload error:', error);
        message.error(error?.message || 'Failed to upload file');
        onError && onError(error);
      } finally {
        setUploading(false);
      }
    },
    showUploadList: false,
  };

  const handleSave = () => {
    onSave(value);
  };
  const isSignatureColumn = column?.type === 'signature';
  const isFileColumn = column?.type === 'file';

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      onOk={isSignatureColumn || viewOnly ? undefined : handleSave}
      title={`${column?.label ?? ''} — ${row?.label ?? ''}`}
      width={isMobile ? '100%' : 720}
      style={isMobile ? { maxWidth: '100%', top: 8, paddingBottom: 8, margin: '0 8px' } : undefined}
      styles={isMobile ? { body: { maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' } } : undefined}
      okText={isSignatureColumn || viewOnly ? undefined : "Save"}
      cancelText="Cancel"
      footer={isSignatureColumn || viewOnly ? null : undefined}
    >
      {column?.type === 'longText' && (
        <Input.TextArea
          rows={8}
          value={value ?? ''}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter text..."
        />
      )}

      {column?.type === 'text' && (
        <Input
          value={value ?? ''}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter text..."
        />
      )}

      {column?.type === 'number' && (
        <InputNumber
          value={value ?? undefined}
          onChange={(v) => setValue(v === undefined ? null : v)}
          style={{ width: '100%' }}
          min={column.min}
          max={column.max}
          step={column.step ?? 1}
          placeholder="Enter number..."
        />
      )}

      {column?.type === 'date' && (
        <DatePicker
          value={value ? dayjs(value) : null}
          onChange={(d) => setValue(d ? d.toISOString() : null)}
          style={{ width: '100%' }}
          suffixIcon={null}
          format="DD MMM YYYY"
        />
      )}

      {column?.type === 'boolean' && (
        <div>
          <Switch
            checked={!!value}
            onChange={(checked) => setValue(checked)}
          />
          <span style={{ marginLeft: 8 }}>{value ? 'Yes' : 'No'}</span>
        </div>
      )}

      {column?.type === 'rating' && (
        <div>
          <Rate
            value={value !== null && value !== undefined ? Number(value) : 0}
            count={column.scale && typeof column.scale === 'number' ? column.scale : 5}
            onChange={(v) => setValue(v)}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary }}>
            Scale: {column.scale && typeof column.scale === 'number' ? column.scale : 5} stars
          </div>
        </div>
      )}

      {column?.type === 'anchors' && (
        <div>
          {(() => {
            const scale = column.scale && typeof column.scale === 'number' ? column.scale : 5;
            const anchorsValue = value !== null && value !== undefined ? Number(value) : undefined;
            const hasValidLabels = Array.isArray(column.anchorLabels) && 
                                  column.anchorLabels.length > 0 && 
                                  column.anchorLabels.length === scale;
            
            if (hasValidLabels) {
              return (
                <>
                  <Segmented
                    block={isMobile}
                    options={column.anchorLabels.map((lab: string, i: number) => ({
                      label: lab,
                      value: String(i + 1),
                    }))}
                    value={anchorsValue ? String(anchorsValue) : undefined}
                    onChange={(v) => setValue(Number(v))}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary }}>
                    Scale: {scale} options
                  </div>
                </>
              );
            }
            return (
              <>
                <Segmented
                  block={isMobile}
                  options={Array.from({ length: scale }, (_, i) => ({
                    label: String(i + 1),
                    value: String(i + 1),
                  }))}
                  value={anchorsValue ? String(anchorsValue) : undefined}
                  onChange={(v) => setValue(Number(v))}
                />
                {column.anchorLabels && column.anchorLabels.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: token.colorWarning }}>
                    Warning: {column.anchorLabels.length} labels provided but scale is {scale}. Labels will not display.
                  </div>
                )}
                {(!column.anchorLabels || column.anchorLabels.length === 0) && (
                  <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary }}>
                    Scale: {scale} options. Add anchor labels in column settings to show custom labels.
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {column?.type === 'choice' && (
        <div>
          <Space direction="vertical">
            {(column.options || []).map((opt: string) => (
              <Radio
                key={opt}
                checked={value === opt}
                onChange={() => setValue(opt)}
              >
                {opt}
              </Radio>
            ))}
          </Space>
        </div>
      )}

      {column?.type === 'multiple' && (
        <div>
          <Space direction="vertical">
            {(column.options || []).map((opt: string) => (
              <Checkbox
                key={opt}
                checked={Array.isArray(value) && value.includes(opt)}
                onChange={(e) => {
                  const current = Array.isArray(value) ? value : [];
                  if (e.target.checked) {
                    if (column.maxSelections && current.length >= column.maxSelections) {
                      message.warning(`Maximum ${column.maxSelections} selection(s) allowed`);
                      return;
                    }
                    setValue([...current, opt]);
                  } else {
                    setValue(current.filter((v: string) => v !== opt));
                  }
                }}
              >
                {opt}
              </Checkbox>
            ))}
          </Space>
          {column.maxSelections && (
            <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary }}>
              {Array.isArray(value) ? value.length : 0}/{column.maxSelections} selected
            </div>
          )}
        </div>
      )}

      {column?.type === 'file' && (
        <>
          {!viewOnly && (
            <Upload {...uploadProps} disabled={uploading}>
              <Button icon={<CloudUploadOutlined />} loading={uploading} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload File'}
              </Button>
            </Upload>
          )}
          {value && (
            <div style={{ marginTop: 12 }}>
              {typeof value === 'object' && value.url ? (
                <>
                  <div>Current file: {value.name || 'File attached'}</div>
                  {value.url && (
                    <a
                      href={resolveMatrixAssetHref(value.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginTop: 4, display: 'block' }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => openMatrixAssetInNewTab(value.url, e)}
                    >
                      View/Download
                    </a>
                  )}
                </>
              ) : typeof value === 'string' && value ? (
                <>
                  <div>Current file: File attached</div>
                  <a
                    href={resolveMatrixAssetHref(value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginTop: 4, display: 'block' }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => openMatrixAssetInNewTab(value, e)}
                  >
                    View/Download
                  </a>
                </>
              ) : null}
            </div>
          )}
          {viewOnly && !value && (
            <div style={{ color: token.colorTextTertiary }}>No file uploaded</div>
          )}
        </>
      )}

      {column?.type === 'signature' && (
        <>
          {value && !showSignaturePad && (
            <div style={{ marginBottom: 12 }}>
              {typeof value === 'string' && value.startsWith('data:') ? (
                <img
                  src={value}
                  alt="signature"
                  style={{ maxWidth: '100%', border: `1px solid ${token.colorBorder}`, borderRadius: 4 }}
                />
              ) : typeof value === 'string' && value ? (
                <img
                  src={resolveMatrixAssetHref(value)}
                  alt="signature"
                  style={{ maxWidth: '100%', border: `1px solid ${token.colorBorder}`, borderRadius: 4 }}
                  onError={(e) => {
                    // If image fails to load, show a placeholder
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : value?.url ? (
                <img
                  src={resolveMatrixAssetHref(value.url)}
                  alt="signature"
                  style={{ maxWidth: '100%', border: `1px solid ${token.colorBorder}`, borderRadius: 4 }}
                  onError={(e) => {
                    // If image fails to load, show a placeholder
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
            </div>
          )}
          
          {showSignaturePad && !viewOnly && (
            <>
              <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 4, height: isMobile ? 200 : 240, position: 'relative', width: '100%', background: token.colorBgContainer }}>
                <SignaturePad
                  ref={sigRef}
                  canvasProps={{
                    width: isMobile ? Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 48 : 320) : 660,
                    height: isMobile ? 200 : 240,
                    style: {
                      width: '100%',
                      height: isMobile ? 200 : 240,
                      touchAction: 'none',
                      maxWidth: '100%',
                      cursor: 'crosshair',
                      backgroundColor: token.colorBgContainer,
                    },
                  }}
                  backgroundColor={token.colorBgContainer}
                  penColor={token.colorText}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <Space>
                  <Button 
                    onClick={() => {
                      if (sigRef.current) {
                        sigRef.current.clear();
                      }
                    }}
                  >
                    Clear Canvas
                  </Button>
                  <Button
                    type="primary"
                    loading={uploading}
                    onClick={async () => {
                      if (!sigRef.current) {
                        message.warning('Please draw a signature first');
                        return;
                      }

                      try {
                        setUploading(true);
                        
                        // Check if canvas is empty
                        try {
                          if (typeof sigRef.current.isEmpty === 'function' && sigRef.current.isEmpty()) {
                            message.warning('Please draw a signature first');
                            setUploading(false);
                            return;
                          }
                        } catch (e) {
                          // Continue if isEmpty check fails
                        }

                        // Get the trimmed canvas with fallback
                        let canvas: HTMLCanvasElement | null = null;
                        
                        // Try getTrimmedCanvas first
                        try {
                          if (typeof sigRef.current.getTrimmedCanvas === 'function') {
                            canvas = sigRef.current.getTrimmedCanvas();
                          }
                        } catch (err) {
                          console.warn('getTrimmedCanvas failed, using fallback', err);
                        }

                        // Fallback to getCanvas if getTrimmedCanvas fails
                        if (!canvas) {
                          try {
                            if (typeof sigRef.current.getCanvas === 'function') {
                              canvas = sigRef.current.getCanvas();
                            }
                          } catch (err) {
                            console.error('Canvas extraction failed', err);
                          }
                        }

                        if (!canvas) {
                          throw new Error('Failed to extract signature canvas');
                        }

                        const dataUrl = canvas.toDataURL('image/png');
                        
                        if (!dataUrl || dataUrl === 'data:,') {
                          throw new Error('Failed to generate signature image');
                        }
                        
                        // Convert canvas to blob for upload (more reliable than data URL)
                        // TypeScript: canvas is guaranteed to be non-null after the check above
                        const finalCanvas = canvas;
                        const blob = await new Promise<Blob>((resolve, reject) => {
                          finalCanvas.toBlob((blob) => {
                            if (blob) {
                              resolve(blob);
                            } else {
                              reject(new Error('Failed to convert signature to blob'));
                            }
                          }, 'image/png');
                        });
                        
                        // Upload the blob
                        const uploadedUrl = await uploadFile(blob);
                        
                        // Signature is immutable once captured: save directly and close.
                        message.success('Signature saved and uploaded successfully');
                        onSave(uploadedUrl);
                        onCancel();
                      } catch (error: any) {
                        console.error('Signature save error:', error);
                        message.error(error?.message || 'Failed to save signature');
                      } finally {
                        setUploading(false);
                      }
                    }}
                  >
                    {uploading ? 'Saving...' : 'Save Signature'}
                  </Button>
                </Space>
              </div>
            </>
          )}
        </>
      )}

      {viewOnly && (isSignatureColumn || isFileColumn) && (
        <div style={{ marginTop: 12 }}>
          <Button onClick={onCancel}>Close</Button>
        </div>
      )}

      {/* Default fallback */}
      {!column && (
        <Input value={value ?? ''} onChange={(e) => setValue(e.target.value)} />
      )}
    </Modal>
  );
}
