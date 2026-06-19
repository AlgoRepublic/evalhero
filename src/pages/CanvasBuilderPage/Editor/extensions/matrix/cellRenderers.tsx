/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
  Button,
  Tooltip,
  Space,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Checkbox,
  Radio,
  Rate,
  Segmented,
  Switch,
  Popover,
  message,
} from 'antd';
import {
  ExclamationCircleOutlined,
  ExpandAltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { openMatrixAssetInNewTab } from './utils';

interface RenderCellContentProps {
  col: any;
  rowId: string;
  colKey: string;
  val: any;
  commonStyle: React.CSSProperties;
  violatedMessage: string | undefined;
  record: any;
  readCellFn: (rowId: string, colId: string) => any;
  writeCellFn: (rowId: string, colId: string, value: any) => void;
  isInputDisabled: boolean;
  /** When false, hide points/pass-fail badges in cells (e.g. submit mode). Align with SingleChoice/MultipleChoice. */
  showScoringInCell?: boolean;
  /** Force vertical stacking on mobile for button/radio/checkbox options */
  isMobile?: boolean;
  columns: any[];
  setCellModal: (modal: {
    visible: boolean;
    row?: any;
    col?: any;
    value?: any;
    viewOnly?: boolean;
    writeFn?: (rowId: string, colId: string, value: any) => void;
  }) => void;
  token: ReturnType<typeof import('antd').theme.useToken>['token'];
}

export const renderCellContent = ({
  col,
  rowId,
  colKey,
  val,
  commonStyle,
  violatedMessage,
  record,
  readCellFn,
  writeCellFn,
  isInputDisabled,
  showScoringInCell = true,
  isMobile = false,
  columns,
  setCellModal,
  token,
}: RenderCellContentProps) => {

  // Helper: render pass/fail/points badge. Only in edit/readonly (hide in submit). Critical Fail is row-based and shown on row label.
  const renderScoringBadge = (selectedVal: string | string[] | null, isMultiple: boolean) => {
    if (!showScoringInCell) return null;
    const optionPoints = col.optionPoints || {};
    if (!col.enablePassFail && !col.enablePoints) return null;
    if (isMultiple && Array.isArray(selectedVal)) {
      const pts = (selectedVal as string[]).reduce((s, v) => {
        const entry = optionPoints[v];
        const numP = Number(entry?.points) || 0;
        return entry?.isCorrect && numP >= 0 ? s + numP : s;
      }, 0);
      const allCorrect = selectedVal.length > 0 && (selectedVal as string[]).every((v) => optionPoints[v]?.isCorrect);
      const isFail = (selectedVal as string[]).length && !allCorrect;
      return (
        <div style={{ marginTop: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {col.enablePoints && <span style={{ color: token.colorTextSecondary }}>{pts} pt(s)</span>}
          {col.enablePassFail && (
            !isFail && (selectedVal as string[]).length ? (
              <span style={{ color: token.colorSuccess }}><CheckCircleOutlined /> Pass</span>
            ) : isFail ? (
              <span style={{ color: token.colorWarning }}><CloseCircleOutlined /> Fail</span>
            ) : null
          )}
        </div>
      );
    }
    if (!isMultiple && typeof selectedVal === 'string') {
      const entry = optionPoints[selectedVal];
      const numP = Number(entry?.points) ?? 0;
      const pts = entry?.isCorrect && numP >= 0 ? numP : 0;
      return (
        <div style={{ marginTop: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {col.enablePoints && selectedVal && <span style={{ color: token.colorTextSecondary }}>{pts} pt(s)</span>}
          {col.enablePassFail && selectedVal && (
            entry?.isCorrect ? (
              <span style={{ color: token.colorSuccess }}><CheckCircleOutlined /> Pass</span>
            ) : (
              <span style={{ color: token.colorWarning }}><CloseCircleOutlined /> Fail</span>
            )
          )}
        </div>
      );
    }
    return null;
  };

  if (col.type === 'choice') {
    const variant = col.variant || 'radio';
    const layout = col.layout || 'horizontal';
    const options = (col.options || []) as string[];
    // Force vertical stacking on mobile for better fit
    const dir = isMobile || layout === 'vertical' ? 'vertical' : 'horizontal';
    const content = (
      <>
        {variant === 'dropdown' && (
          <Select
            value={val ?? undefined}
            onChange={(v: string | null) => !isInputDisabled && writeCellFn(rowId, colKey, v)}
            options={options.map((o) => ({ label: o, value: o }))}
            style={{ width: '100%', minWidth: 100 }}
            disabled={isInputDisabled}
            allowClear
          />
        )}
        {variant === 'buttons' && (
          <Space size="small" wrap direction={dir as 'horizontal' | 'vertical'}>
            {options.map((o) => (
              <Button
                key={o}
                type={val === o ? 'primary' : 'default'}
                size="small"
                onClick={() => !isInputDisabled && writeCellFn(rowId, colKey, o)}
                disabled={isInputDisabled}
              >
                {o}
              </Button>
            ))}
          </Space>
        )}
        {variant === 'yesno' && (
          <Radio.Group
            value={val ?? undefined}
            onChange={(e) => !isInputDisabled && writeCellFn(rowId, colKey, e.target.value)}
            disabled={isInputDisabled}
          >
            <Space direction={dir as 'horizontal' | 'vertical'} size={layout === 'vertical' ? 8 : undefined} wrap>
              <Radio value="Yes">Yes</Radio>
              <Radio value="No">No</Radio>
            </Space>
          </Radio.Group>
        )}
        {(variant === 'radio' || !['dropdown', 'buttons', 'yesno'].includes(variant)) && (
          <Radio.Group
            value={val ?? undefined}
            onChange={(e) => !isInputDisabled && writeCellFn(rowId, colKey, e.target.value)}
            disabled={isInputDisabled}
          >
            <Space direction={dir as 'horizontal' | 'vertical'} size="small" wrap>
              {options.map((o) => (
                <Radio key={o} value={o}>{o}</Radio>
              ))}
            </Space>
          </Radio.Group>
        )}
        {renderScoringBadge(val ?? null, false)}
      </>
    );
    return (
      <div style={{ ...commonStyle, wordBreak: 'break-word' }}>
        {content}
        {violatedMessage && (
          <Tooltip title={violatedMessage}>
            <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
          </Tooltip>
        )}
      </div>
    );
  }
  if (col.type === 'multiple') {
    const currentValue = Array.isArray(val) ? val : [];
    const maxSelections = col.maxSelections ? Number(col.maxSelections) : null;
    const variant = col.variant || 'checkbox';
    const layout = col.layout || 'horizontal';
    const options = (col.options || []) as string[];
    // Force vertical stacking on mobile for better fit
    const dir = isMobile || layout === 'vertical' ? 'vertical' : 'horizontal';
    const content = (
      <>
        {variant === 'dropdown' && (
          <Select
            mode="multiple"
            value={currentValue}
            onChange={(v: string[]) => {
              if (isInputDisabled) return;
              if (maxSelections && v.length > maxSelections) {
                message.warning(`Maximum ${maxSelections} selection(s) allowed`);
                return;
              }
              writeCellFn(rowId, colKey, v);
            }}
            options={options.map((o) => ({ label: o, value: o }))}
            style={{ width: '100%', minWidth: 100 }}
            disabled={isInputDisabled}
          />
        )}
        {variant === 'buttons' && (
          <Space size="small" wrap direction={dir as 'horizontal' | 'vertical'}>
            {options.map((o) => {
              const checked = currentValue.includes(o);
              return (
                <Button
                  key={o}
                  type={checked ? 'primary' : 'default'}
                  size="small"
                  onClick={() => {
                    if (isInputDisabled) return;
                    const next = checked ? currentValue.filter((x) => x !== o) : (maxSelections && currentValue.length >= maxSelections ? currentValue : [...currentValue, o]);
                    if (maxSelections && next.length > maxSelections) {
                      message.warning(`Maximum ${maxSelections} selection(s) allowed`);
                      return;
                    }
                    writeCellFn(rowId, colKey, next);
                  }}
                  disabled={isInputDisabled}
                >
                  {o}
                </Button>
              );
            })}
          </Space>
        )}
        {(variant === 'checkbox' || !['dropdown', 'buttons'].includes(variant)) && (
          <Checkbox.Group
            value={currentValue}
            options={options}
            onChange={(checked) => {
              if (isInputDisabled) return;
              if (maxSelections && checked.length > maxSelections) {
                message.warning(`Maximum ${maxSelections} selection(s) allowed`);
                return;
              }
              writeCellFn(rowId, colKey, checked);
            }}
            disabled={isInputDisabled}
            style={{ display: 'flex', flexDirection: dir === 'vertical' ? 'column' : 'row', flexWrap: 'wrap', gap: 4 }}
          />
        )}
        {maxSelections && (
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 4 }}>
            {currentValue.length}/{maxSelections} selected
          </div>
        )}
        {renderScoringBadge(currentValue.length ? currentValue : null, true)}
        {!isInputDisabled && options.length > 5 && (
          <div style={{ marginTop: 8 }}>
            <Button
              size="small"
              icon={<ExpandAltOutlined />}
              onClick={() =>
                setCellModal({
                  visible: true,
                  row: record,
                  col,
                  value: val,
                  writeFn: writeCellFn,
                })
              }
            >
              Edit
            </Button>
          </div>
        )}
      </>
    );
    return (
      <div style={{ ...commonStyle, wordBreak: 'break-word' }}>
        {content}
        {violatedMessage && (
          <Tooltip title={violatedMessage}>
            <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
          </Tooltip>
        )}
      </div>
    );
  }
  if (col.type === 'number') {
    return (
      <div style={commonStyle}>
        <InputNumber
          value={val ?? undefined}
          onChange={(v) => !isInputDisabled && writeCellFn(rowId, colKey, v === undefined ? null : Number(v))}
          style={{ width: '100%' }}
          min={col.min}
          max={col.max}
          step={col.step ?? 1}
          disabled={isInputDisabled}
          readOnly={isInputDisabled}
        />
        {violatedMessage && (
          <Tooltip title={violatedMessage}>
            <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
          </Tooltip>
        )}
      </div>
    );
  }
  if (col.type === 'date') {
    return (
      <div style={commonStyle}>
        <DatePicker
          value={val ? dayjs(val) : null}
          onChange={(d) => !isInputDisabled && writeCellFn(rowId, colKey, d ? d.toISOString() : null)}
          disabled={isInputDisabled}
          suffixIcon={null}
          format="DD MMM YYYY"
        />
        {violatedMessage && (
          <Tooltip title={violatedMessage}>
            <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
          </Tooltip>
        )}
      </div>
    );
  }
  if (col.type === 'boolean') {
    return (
      <div style={commonStyle}>
        <Switch
          checked={!!val}
          onChange={(checked) => !isInputDisabled && writeCellFn(rowId, colKey, checked)}
          disabled={isInputDisabled}
        />
      </div>
    );
  }
  if (col.type === 'rating') {
    const scale = col.scale && typeof col.scale === 'number' ? col.scale : 5;
    const ratingValue = val !== null && val !== undefined ? Number(val) : 0;
    return (
      <div style={commonStyle}>
        <Rate
          value={ratingValue}
          count={scale}
          onChange={(v) => !isInputDisabled && writeCellFn(rowId, colKey, v)}
          disabled={isInputDisabled}
          style={{ margin: '0.4rem', padding: '0px' }}
        />
        {violatedMessage && (
          <Tooltip title={violatedMessage}>
            <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
          </Tooltip>
        )}
      </div>
    );
  }
  if (col.type === 'anchors') {
    const scale = col.scale && typeof col.scale === 'number' ? col.scale : 5;
    const anchorsValue = val !== null && val !== undefined ? Number(val) : undefined;
    const anchorLabels = Array.isArray(col.anchorLabels) ? col.anchorLabels : [];
    const maxLabelLength = anchorLabels.length > 0 
      ? Math.max(...anchorLabels.map((lab: string) => String(lab).length))
      : 0;
    const useVerticalLayout = maxLabelLength > 15 || scale > 7;
    
    if (anchorLabels.length > 0) {
      const options = Array.from({ length: scale }, (_, i) => {
        const label = anchorLabels[i] !== undefined && anchorLabels[i] !== null 
          ? String(anchorLabels[i]).trim() 
          : String(i + 1);
        return { label: label, value: String(i + 1) };
      });
      
      if (useVerticalLayout) {
        return (
          <div style={{ ...commonStyle, maxWidth: '100%', overflow: 'hidden' }}>
            <Radio.Group
              value={anchorsValue ? String(anchorsValue) : undefined}
              onChange={(e) => !isInputDisabled && writeCellFn(rowId, colKey, Number(e.target.value))}
              style={{ width: '100%' }}
              disabled={isInputDisabled}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {options.map((opt: any) => (
                  <Radio key={opt.value} value={opt.value} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {opt.label}
                    </span>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
            {violatedMessage && (
              <Tooltip title={violatedMessage}>
                <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
              </Tooltip>
            )}
          </div>
        );
      }
      
      return (
        <div style={{ ...commonStyle, maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <Segmented
              options={options}
              value={anchorsValue ? String(anchorsValue) : undefined}
              onChange={(v) => !isInputDisabled && writeCellFn(rowId, colKey, Number(v))}
              style={{ width: 'max-content', minWidth: '100%' }}
              readOnly={isInputDisabled}
            />
          </div>
          {violatedMessage && (
            <Tooltip title={violatedMessage}>
              <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
            </Tooltip>
          )}
        </div>
      );
    }
    
    if (scale > 7) {
      return (
        <div style={{ ...commonStyle, maxWidth: '100%', overflow: 'hidden' }}>
          <Radio.Group
            value={anchorsValue ? String(anchorsValue) : undefined}
            onChange={(e) => !isInputDisabled && writeCellFn(rowId, colKey, Number(e.target.value))}
            style={{ width: '100%' }}
            disabled={isInputDisabled}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {Array.from({ length: scale }, (_, i) => (
                <Radio key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
          {violatedMessage && (
            <Tooltip title={violatedMessage}>
              <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
            </Tooltip>
          )}
        </div>
      );
    }
    
    return (
      <div style={{ ...commonStyle, maxWidth: '100%', overflow: 'hidden' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <Segmented
            options={Array.from({ length: scale }, (_, i) => ({
              label: String(i + 1),
              value: String(i + 1),
            }))}
            value={anchorsValue ? String(anchorsValue) : undefined}
            onChange={(v) => !isInputDisabled && writeCellFn(rowId, colKey, Number(v))}
            style={{ width: 'max-content', minWidth: '100%' }}
            readOnly={isInputDisabled}
          />
        </div>
        {violatedMessage && (
          <Tooltip title={violatedMessage}>
            <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
          </Tooltip>
        )}
      </div>
    );
  }
  if (col.type === 'computed') {
    // For computed, we need to compute based on the cells passed in
    const computedValue = (() => {
      try {
        const expr = String(col.computedExpr || '').trim();
        if (!expr) return null;
        const ctx: Record<string, any> = {};
        columns.forEach((c: any) => {
          const v = readCellFn(rowId, c.id);
          ctx[c.id] = typeof v === 'number' ? v : isNaN(Number(v)) ? 0 : Number(v);
        });
        const safeExpr = expr.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
          if (Object.prototype.hasOwnProperty.call(ctx, match)) {
            return String(ctx[match] ?? 0);
          }
          return '0';
        });

        return Function(`return (${safeExpr});`)();
      } catch (e) {
        console.warn('Computed cell error', e);
        return null;
      }
    })();
    return (
      <div style={commonStyle}>
        <div style={{ fontWeight: 500, color: token.colorTextSecondary }}>
          {computedValue !== null && computedValue !== undefined
            ? String(computedValue)
            : '—'}
        </div>
      </div>
    );
  }
  if (col.type === 'file') {
    // Handle both object format {name, url} and string URL format
    const fileDisplay = typeof val === 'object' && val !== null
      ? (val.name || val.url || 'File attached')
      : (typeof val === 'string' && val ? 'File attached' : '—');
    const fileUrl = typeof val === 'object' && val !== null
      ? val.url
      : (typeof val === 'string' && val ? val : null);
    
    return (
      <div style={commonStyle}>
        <div>
          {fileDisplay}
        </div>
        {!isInputDisabled && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="small"
              icon={<ExpandAltOutlined />}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setCellModal({
                  visible: true,
                  row: record,
                  col,
                  value: val,
                  writeFn: writeCellFn,
                });
              }}
            >
              {val ? 'View/Replace' : 'Upload'}
            </Button>
            {fileUrl && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: 'auto', fontSize: 12 }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => openMatrixAssetInNewTab(fileUrl, e)}
              >
                Open in new tab
              </Button>
            )}
          </div>
        )}
        {isInputDisabled && fileUrl && (
          <div style={{ marginTop: 8 }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto', fontSize: 12 }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => openMatrixAssetInNewTab(fileUrl, e)}
            >
              Open in new tab
            </Button>
          </div>
        )}
        {violatedMessage && (
          <Tooltip title={violatedMessage}>
            <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
          </Tooltip>
        )}
      </div>
    );
  }
  if (col.type === 'signature') {
    // Handle both object format {url} and string URL/data URL format
    const hasSignature = val && (
      (typeof val === 'string' && (val.startsWith('data:') || val.length > 0)) ||
      (typeof val === 'object' && val !== null && val.url)
    );
    const signatureUrl = typeof val === 'object' && val !== null
      ? val.url
      : (typeof val === 'string' && val ? val : null);
    
    return (
      <div style={commonStyle}>
        <div>
          {hasSignature ? '✓ Signed' : '—'}
        </div>
        {!isInputDisabled && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="small"
              icon={<ExpandAltOutlined />}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setCellModal({
                  visible: true,
                  row: record,
                  col,
                  value: val,
                  writeFn: writeCellFn,
                });
              }}
            >
              {val ? 'View/Replace' : 'Sign'}
            </Button>
            {signatureUrl && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: 'auto', fontSize: 12 }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => openMatrixAssetInNewTab(signatureUrl, e)}
              >
                Open in new tab
              </Button>
            )}
          </div>
        )}
        {isInputDisabled && signatureUrl && (
          <div style={{ marginTop: 8 }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto', fontSize: 12 }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => openMatrixAssetInNewTab(signatureUrl, e)}
            >
              Open in new tab
            </Button>
          </div>
        )}
        {violatedMessage && (
          <Tooltip title={violatedMessage}>
            <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
          </Tooltip>
        )}
      </div>
    );
  }
  if (col.type === 'longText') {
    const textValue = val || '';
    const preview = String(textValue).slice(0, 80);
    return (
      <div style={commonStyle}>
        {isInputDisabled ? (
          <div style={{ padding: '4px 0', color: token.colorTextSecondary }}>
            {textValue ? (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {textValue}
              </div>
            ) : (
              <span style={{ color: token.colorTextTertiary }}>—</span>
            )}
          </div>
        ) : (
          <Popover
            content={
              <Input.TextArea
                rows={6}
                value={textValue}
                onBlur={(e) => writeCellFn(rowId, colKey, e.target.value)}
                onChange={(e) => writeCellFn(rowId, colKey, e.target.value)}
                style={{ width: 400 }}
              />
            }
            title={col.label}
            trigger="click"
          >
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{textValue ? preview + (textValue.length > 80 ? '...' : '') : '—'}</span>
              <ExpandAltOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </div>
          </Popover>
        )}
        {violatedMessage && (
          <Tooltip title={violatedMessage}>
            <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
          </Tooltip>
        )}
      </div>
    );
  }
  // default text
  return (
    <div style={commonStyle}>
      <Input
        value={val ?? ''}
        onChange={(e) => writeCellFn(rowId, colKey, e.target.value)}
        disabled={isInputDisabled}
      />
      {violatedMessage && (
        <Tooltip title={violatedMessage}>
          <ExclamationCircleOutlined style={{ color: token.colorError, marginLeft: 8 }} />
        </Tooltip>
      )}
    </div>
  );
};
