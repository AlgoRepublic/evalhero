/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Button, Dropdown, Tooltip, Tag, Space } from 'antd';
import { DownOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { renderCellContent } from './cellRenderers';
import { evalRowViolationsForCells } from './rules';

interface BuildTableColumnsParams {
  columns: any[];
  rows: any[];
  rowLabel: string;
  leftColWidth: number;
  isMobile: boolean;
  isEditMode: boolean;
  isInputDisabled: boolean;
  /** When true, show points/pass-fail badges inside choice/multiple cells (edit + readonly). Hide in submit. */
  showScoringInCell?: boolean;
  /** When true, show "Set all" bulk dropdown on choice/boolean/multiple columns (edit + submit). */
  showBulkSetAll?: boolean;
  readCellFn: (rowId: string, colId: string) => any;
  writeCellFn: (rowId: string, colId: string, value: any) => void;
  cells: Record<string, Record<string, any>>;
  rules: any[];
  getAdjustedColumnWidth: (col: any) => number;
  setCellModal: (modal: {
    visible: boolean;
    row?: any;
    col?: any;
    value?: any;
    viewOnly?: boolean;
    writeFn?: (rowId: string, colId: string, value: any) => void;
  }) => void;
  updateAttributes?: (attrs: any) => void;
  token: ReturnType<typeof import('antd').theme.useToken>['token'];
}

export const buildTableColumns = ({
  columns,
  rows,
  rowLabel,
  leftColWidth,
  isMobile,
  isEditMode,
  isInputDisabled,
  showScoringInCell = true,
  showBulkSetAll = false,
  readCellFn,
  writeCellFn,
  cells,
  rules,
  getAdjustedColumnWidth,
  setCellModal,
  updateAttributes,
  token,
}: BuildTableColumnsParams) => {

  const leftCol = {
    title: rowLabel,
    dataIndex: 'label',
    key: 'label',
    fixed: 'left' as const,
    width: leftColWidth,
    render: (_: any, record: any) => (
      <div
        className="matrix-row-label-cell"
        style={{
          padding: isMobile ? 4 : 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'normal',
        }}
      >
        <div style={{ fontSize: isMobile ? 12 : 14, flex: 1, minWidth: 0 }}>{record.label}</div>
        {record.criticalFail && (
          <Tooltip title="This row has a wrong answer in a Critical Fail column (single/multiple choice)">
            <Tag color="error" style={{ margin: 0, flexShrink: 0 }}>
              <WarningOutlined /> Critical Fail
            </Tag>
          </Tooltip>
        )}
        {record.tooltip && (
          <Tooltip title={record.tooltip}>
            <InfoCircleOutlined style={{ color: token.colorTextTertiary, fontSize: isMobile ? 10 : 12, cursor: 'help', flexShrink: 0 }} />
          </Tooltip>
        )}
      </div>
    ),
  };

  const cols = columns.map((col: any) => {
    const colKey = col.id;
    const adjustedMinWidth = getAdjustedColumnWidth(col);
    return {
      title: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: isMobile ? 4 : 8,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 12 : 14, flexWrap: 'wrap' }}>
              {col.label}
              {col.required && <span style={{ color: token.colorError }}>*</span>}
              {col.tooltip && (
                <Tooltip title={col.tooltip}>
                  <InfoCircleOutlined style={{ color: token.colorTextTertiary, fontSize: isMobile ? 10 : 12, marginLeft: 4, flexShrink: 0 }} />
                </Tooltip>
              )}
              {/* In edit mode show Points / Pass/Fail / Fail Critical tags per column (align with SingleChoice/MultipleChoice) */}
              {isEditMode && (col.type === 'choice' || col.type === 'multiple') && (
                <Space size={4} wrap style={{ marginLeft: 4 }}>
                  {col.enablePoints && <Tag color="geekblue" style={{ margin: 0, fontSize: 10 }}>Points</Tag>}
                  {col.enablePassFail && <Tag color="green" style={{ margin: 0, fontSize: 10 }}>Pass/Fail</Tag>}
                  {col.failCritical && <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>Fail Critical</Tag>}
                </Space>
              )}
            </div>
            {col.tooltip && !isMobile && (
              <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>{col.tooltip}</div>
            )}
          </div>

          {/* Bulk select dropdown for applicable column types - in edit and submit mode */}
          {showBulkSetAll && (col.type === 'choice' || col.type === 'boolean' || col.type === 'multiple') && !isMobile && updateAttributes && (
            <Dropdown
              menu={{
                items: [
                  ...(col.type === 'choice' && Array.isArray(col.options) && col.options.length > 0
                    ? col.options.map((opt: string) => ({
                        key: `bulk-${colKey}-${opt}`,
                        label: `Set all → ${opt}`,
                        onClick: () => {
                          const next = { ...(cells as any) };
                          rows.forEach((r: any) => {
                            next[r.id] = { ...(next[r.id] || {}), [colKey]: opt };
                          });
                          updateAttributes({ cells: next });
                          message.success(`Applied "${opt}" to all rows`);
                        },
                      }))
                    : []),
                  ...(col.type === 'boolean'
                    ? [
                        {
                          key: 'bulk-true',
                          label: 'Set all True',
                          onClick: () => {
                            const next = { ...(cells as any) };
                            rows.forEach((r: any) => {
                              next[r.id] = { ...(next[r.id] || {}), [colKey]: true };
                            });
                            updateAttributes({ cells: next });
                            message.success('Set all true');
                          },
                        },
                        {
                          key: 'bulk-false',
                          label: 'Set all False',
                          onClick: () => {
                            const next = { ...(cells as any) };
                            rows.forEach((r: any) => {
                              next[r.id] = { ...(next[r.id] || {}), [colKey]: false };
                            });
                            updateAttributes({ cells: next });
                            message.success('Set all false');
                          },
                        },
                      ]
                    : []),
                  ...(col.type === 'multiple' && Array.isArray(col.options) && col.options.length > 0
                    ? col.options.map((opt: string) => ({
                        key: `bulk-${colKey}-${opt}`,
                        label: `Set all → ${opt}`,
                        onClick: () => {
                          const next = { ...(cells as any) };
                          rows.forEach((r: any) => {
                            next[r.id] = { ...(next[r.id] || {}), [colKey]: [opt] };
                          });
                          updateAttributes({ cells: next });
                          message.success(`Applied "${opt}" to all rows`);
                        },
                      }))
                    : []),
                  {
                    key: 'clear',
                    label: 'Clear column',
                    onClick: () => {
                      const next = { ...(cells as any) };
                      rows.forEach((r: any) => {
                        next[r.id] = { ...(next[r.id] || {}), [colKey]: col.type === 'multiple' ? [] : null };
                      });
                      updateAttributes({ cells: next });
                      message.success('Cleared column');
                    },
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button size="small" type="text" icon={<DownOutlined />} />
            </Dropdown>
          )}
        </div>
      ),
      dataIndex: colKey,
      key: colKey,
      width: adjustedMinWidth,
      ellipsis: col.type === 'anchors' ? false : true,
      render: (_: any, record: any) => {
        const rowId = record.id;
        const val = readCellFn(rowId, colKey);
        const violations = evalRowViolationsForCells(rowId, cells, rules, columns);
        const violatedMessage = violations[colKey];
        const commonStyle: React.CSSProperties = violatedMessage
          ? { border: `1px solid ${token.colorError}`, background: token.colorErrorBg, padding: isMobile ? 4 : 8, borderRadius: 6 }
          : { padding: isMobile ? 4 : 8 };
        
        return renderCellContent({
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
          showScoringInCell,
          isMobile,
          columns,
          setCellModal,
          token,
        });
      },
    };
  });

  return [leftCol, ...cols];
};

// Simplified version for group/subject tables; can optionally show bulk "Set all" dropdown when onBulkSetAll provided
export const buildSimpleTableColumns = ({
  columns,
  rowLabel,
  leftColWidth,
  isMobile,
  isInputDisabled,
  showScoringInCell = false,
  showBulkSetAll = false,
  rows: rowsParam = [],
  /** When provided, bulk "Set all" uses this single callback so all rows are updated in one state update (fixes group/subject tables). */
  onBulkSetAll,
  readCellFn,
  writeCellFn,
  cells,
  rules,
  getAdjustedColumnWidth,
  setCellModal,
  token,
}: Omit<BuildTableColumnsParams, 'rows' | 'isEditMode' | 'updateAttributes'> & {
  rows?: any[];
  onBulkSetAll?: (colKey: string, value: any) => void;
}) => {
  const rows = rowsParam;

  const leftCol = {
    title: rowLabel,
    dataIndex: 'label',
    key: 'label',
    fixed: 'left' as const,
    width: leftColWidth,
    render: (_: any, record: any) => (
      <div
        className="matrix-row-label-cell"
        style={{
          padding: isMobile ? 4 : 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'normal',
        }}
      >
        <div style={{ fontSize: isMobile ? 12 : 14, flex: 1, minWidth: 0 }}>{record.label}</div>
        {record.criticalFail && (
          <Tooltip title="This row has a wrong answer in a Critical Fail column (single/multiple choice)">
            <Tag color="error" style={{ margin: 0, flexShrink: 0 }}>
              <WarningOutlined /> Critical Fail
            </Tag>
          </Tooltip>
        )}
        {record.tooltip && (
          <Tooltip title={record.tooltip}>
            <InfoCircleOutlined style={{ color: token.colorTextTertiary, fontSize: isMobile ? 10 : 12, cursor: 'help', flexShrink: 0 }} />
          </Tooltip>
        )}
      </div>
    ),
  };

  const cols = columns.map((col: any) => {
    const colKey = col.id;
    const adjustedMinWidth = getAdjustedColumnWidth(col);
    const canBulkSetAll = showBulkSetAll && (onBulkSetAll || rows.length > 0) && (col.type === 'choice' || col.type === 'boolean' || col.type === 'multiple') && !isMobile;
    const bulkValue = (val: any) => {
      if (onBulkSetAll) {
        onBulkSetAll(colKey, val);
      } else {
        rows.forEach((r: any) => writeCellFn(r.id, colKey, val));
      }
    };
    return {
      title: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 12 : 14 }}>
              {col.label}
              {col.required && <span style={{ color: token.colorError }}>*</span>}
              {col.tooltip && (
                <Tooltip title={col.tooltip}>
                  <InfoCircleOutlined style={{ color: token.colorTextTertiary, fontSize: isMobile ? 10 : 12, marginLeft: 4, flexShrink: 0 }} />
                </Tooltip>
              )}
            </div>
          </div>
          {canBulkSetAll && (
            <Dropdown
              menu={{
                items: [
                  ...(col.type === 'choice' && Array.isArray(col.options) && col.options.length > 0
                    ? col.options.map((opt: string) => ({
                        key: `bulk-${colKey}-${opt}`,
                        label: `Set all → ${opt}`,
                        onClick: () => {
                          bulkValue(opt);
                          message.success(`Applied "${opt}" to all rows`);
                        },
                      }))
                    : []),
                  ...(col.type === 'boolean'
                    ? [
                        { key: 'bulk-true', label: 'Set all True', onClick: () => { bulkValue(true); message.success('Set all true'); } },
                        { key: 'bulk-false', label: 'Set all False', onClick: () => { bulkValue(false); message.success('Set all false'); } },
                      ]
                    : []),
                  ...(col.type === 'multiple' && Array.isArray(col.options) && col.options.length > 0
                    ? col.options.map((opt: string) => ({
                        key: `bulk-${colKey}-${opt}`,
                        label: `Set all → ${opt}`,
                        onClick: () => {
                          bulkValue([opt]);
                          message.success(`Applied "${opt}" to all rows`);
                        },
                      }))
                    : []),
                  {
                    key: 'clear',
                    label: 'Clear column',
                    onClick: () => {
                      bulkValue(col.type === 'multiple' ? [] : null);
                      message.success('Cleared column');
                    },
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button size="small" type="text" icon={<DownOutlined />} />
            </Dropdown>
          )}
        </div>
      ),
      dataIndex: colKey,
      key: colKey,
      width: adjustedMinWidth,
      ellipsis: col.type === 'anchors' ? false : true,
      render: (_: any, record: any) => {
        const rowId = record.id;
        const val = readCellFn(rowId, colKey);
        const violations = evalRowViolationsForCells(rowId, cells, rules, columns);
        const violatedMessage = violations[colKey];
        const commonStyle: React.CSSProperties = violatedMessage
          ? { border: `1px solid ${token.colorError}`, background: token.colorErrorBg, padding: isMobile ? 4 : 8, borderRadius: 6 }
          : { padding: isMobile ? 4 : 8 };
        
        return renderCellContent({
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
          showScoringInCell,
          isMobile,
          columns,
          setCellModal,
          token,
        });
      },
    };
  });

  return [leftCol, ...cols];
};
