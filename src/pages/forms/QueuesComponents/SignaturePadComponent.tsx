import React, { useRef, useEffect, useState } from 'react';
import { Button, Flex, Space, Typography, theme } from 'antd';
import SignaturePad from 'react-signature-canvas';

const { Text } = Typography;

interface SignaturePadComponentProps {
  visible: boolean;
  onClose: () => void;
  onSend: (dataUrl: string) => void;
  isSending: boolean;
  isDark: boolean;
  token: ReturnType<typeof theme.useToken>['token'];
}

export const SignaturePadComponent: React.FC<SignaturePadComponentProps> = ({
  visible,
  onClose,
  onSend,
  isSending,
  isDark,
  token,
}) => {
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const signatureContainerRef = useRef<HTMLDivElement | null>(null);
  const [signatureSize, setSignatureSize] = useState<{ width: number; height: number }>({ width: 500, height: 150 });

  // Resize signature canvas to container width
  useEffect(() => {
    if (!visible) return;
    const el = signatureContainerRef.current;
    if (!el) return;
    
    const resize = () => {
      const rect = el.getBoundingClientRect();
      setSignatureSize({ width: Math.max(rect.width - 2, 300), height: 150 });
      try {
        signaturePadRef.current?.clear();
      } catch { /* noop */ }
    };
    
    resize();
    const ResizeObserverClass = (window as Window & typeof globalThis).ResizeObserver;
    let ro: ResizeObserver | null = null;
    if (ResizeObserverClass) {
      ro = new ResizeObserverClass(resize);
      if (ro) {
        ro.observe(el);
      }
    }
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (ro) {
        ro.disconnect();
      }
    };
  }, [visible]);

  const handleClear = () => {
    try {
      signaturePadRef.current?.clear();
    } catch { /* noop */ }
  };

  const handleSend = () => {
    if (!signaturePadRef.current) return;
    
    const isEmpty = signaturePadRef.current.isEmpty();
    if (isEmpty) {
      return;
    }
    
    let canvas: HTMLCanvasElement | null = null;
    try {
      const maybeTrimmed = (signaturePadRef.current as unknown as {
        getTrimmedCanvas?: () => HTMLCanvasElement | null;
      }).getTrimmedCanvas?.();
      if (maybeTrimmed) {
        canvas = maybeTrimmed;
      }
    } catch {
      // ignore trim errors
    }
    if (!canvas) {
      try {
        canvas = signaturePadRef.current.getCanvas() as unknown as HTMLCanvasElement;
      } catch {
        canvas = null;
      }
    }
    
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl && dataUrl !== 'data:,') {
        onSend(dataUrl);
      }
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        marginBottom: 6,
        padding: isDark ? '10px 12px' : '12px 14px',
        background: isDark ? token.colorFillTertiary : token.colorFillAlter,
        borderRadius: 6,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Flex align="center" justify="space-between">
          <Text strong style={{ fontSize: 12, color: token.colorText }}>
            Add Signature
          </Text>
          <Button
            type="text"
            size="small"
            onClick={onClose}
            style={{ height: 20, padding: '0 4px', fontSize: 16 }}
          >
            ×
          </Button>
        </Flex>
        
        <div
          style={{
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 6,
            height: signatureSize.height,
            background: isDark ? token.colorBgContainer : 'white',
            position: 'relative',
          }}
          ref={signatureContainerRef}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onTouchMove={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onWheel={(e) => { e.stopPropagation(); }}
        >
          <SignaturePad
            ref={signaturePadRef}
            canvasProps={{
              width: signatureSize.width,
              height: signatureSize.height,
              style: { 
                width: '100%', 
                height: signatureSize.height, 
                touchAction: 'none', 
                cursor: 'crosshair', 
                backgroundColor: isDark ? token.colorBgContainer : '#ffffff' 
              },
            }}
            backgroundColor={isDark ? token.colorBgContainer : "rgba(255,255,255,1)"}
            penColor={isDark ? token.colorText : "#000000"}
          />
        </div>
        
        <Flex align="center" justify="flex-end" gap={6}>
          <Button size="small" onClick={handleClear}>Clear</Button>
          <Button
            size="small"
            type="primary"
            onClick={handleSend}
            loading={isSending}
            disabled={isSending}
          >
            Send
          </Button>
        </Flex>
      </Space>
    </div>
  );
};

