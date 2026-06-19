/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Client comment (commented out for now):
 * "The new Matrix layout includes single/multiple-choice options and tags. Complex features like
 * row-based approval requests are temporarily skipped to keep the initial rollout simple"
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  Table,
  Button,
  Space,
  Modal,
  Tag,
  // Select,
  Input,
  theme,
  Tooltip,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useMediaQuery } from 'react-responsive';
import CellModal from './CellModal';
import ColumnEditor from './ColumnEditor';
import RowEditor from './RowEditor';
import RulesBuilder from './RulesBuilder';
import { evaluateVisibility, getQueryParam, extractNodeLabel } from '../../utils';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { normalizeColumnAttributes, normalizeValue, getColumnMinWidth, getMatrixSummary } from './utils';
import { buildTableColumns } from './tableColumns';
import { GroupingTables } from './grouping';
import './matrix-table.css';

const MatrixComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { token } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });
  // Modes (aligned with SingleChoice/MultipleChoice/other fields): edit = builder, submit = fill form, readonly = view only
  const mode = (editor as any)?.storage?.formBuilder?.mode ?? 'readonly';
  const isEditMode = mode === 'edit';
  const isSubmitMode = mode === 'submit' || mode === 'submissions';
  const isReadonlyMode = mode === 'readonly';
  const submitted = (editor as any)?.storage?.formBuilder?.submitted === true;
  // Disable cell inputs in readonly, or in submit mode after form is submitted
  const isInputDisabled = isReadonlyMode || (isSubmitMode && submitted);
  
  // Normalize columns and rows
  const columns = useMemo(() => {
    const cols = Array.isArray(node.attrs.columns) ? node.attrs.columns : [];
    return cols.map(normalizeColumnAttributes);
  }, [node.attrs.columns]);
  
  const rows = useMemo(() => {
    const rowsArray = Array.isArray(node.attrs.rows) ? node.attrs.rows : [];
    return rowsArray.map((row: any) => ({
      ...row,
      tooltip: row.tooltip !== undefined && row.tooltip !== null ? String(row.tooltip) : '',
    }));
  }, [node.attrs.rows]);
  
  // Grouping support
  const globalGroups = (editor as any)?.storage?.formBuilder?.globalGroups || [];
  const availableSubjects = (editor as any)?.storage?.formBuilder?.availableSubjects || [];
  const subjectsOptions = (editor as any)?.storage?.formBuilder?.subjects || [];
  const isAllLocked = (editor as any)?.storage?.formBuilder?.isAllLocked || false;
  
  const enableGrouping = node.attrs.enableGrouping === true || node.attrs.enableGrouping === 'true';
  const nodeGroups = Array.isArray(node.attrs.nodeGroups) ? node.attrs.nodeGroups : [];
  const nodeGroupValues = node.attrs.nodeGroupValues && typeof node.attrs.nodeGroupValues === 'object' 
    ? node.attrs.nodeGroupValues 
    : {};
  
  const groupsToUse = enableGrouping && nodeGroups.length > 0 ? nodeGroups : globalGroups;
  
  const usedSubjectIds = new Set<string>();
  if (enableGrouping && nodeGroups.length > 0) {
    nodeGroups.forEach((g: any) => {
      (g.subjectIds || []).forEach((id: string) => usedSubjectIds.add(id));
    });
  }
  const ungroupedSubjects = enableGrouping && nodeGroups.length > 0
    ? subjectsOptions.filter((s: any) => !usedSubjectIds.has(s.value))
    : availableSubjects;
  
  const shouldShowGrouping =
    (isSubmitMode || isReadonlyMode) &&
    (isSubmitMode ? isAllLocked : true) &&
    (groupsToUse.length > 0 || ungroupedSubjects.length > 0);
  
  const cells = useMemo(() => {
    return node.attrs.cells && typeof node.attrs.cells === 'object' ? node.attrs.cells : {};
  }, [node.attrs.cells]);
  const rules = Array.isArray(node.attrs.rules) ? node.attrs.rules : [];
  const visibility = node.attrs.visibility || { match: 'all', rules: [] };
  const queryParam = node.attrs.queryParam;

  // Compute and persist matrix summary (total points, pass/fail, critical fail) for template evaluation
  const matrixSummary = useMemo(() => {
    return getMatrixSummary(cells, columns, rows, rules);
  }, [cells, columns, rows, rules]);

  const hasScoringColumns = useMemo(
    () => columns.some((c: any) => (c.type === 'choice' || c.type === 'multiple') && (c.enablePoints || c.enablePassFail)),
    [columns]
  );
  const hasAnyFailCritical = useMemo(
    () => columns.some((c: any) => (c.type === 'choice' || c.type === 'multiple') && c.failCritical),
    [columns]
  );
  const required = node.attrs.required === true || node.attrs.required === 'true';
  // Show scoring badges/summary in edit (builder) and readonly (evaluator); hide in submit (respondent)
  const showScoringInCell = isEditMode || isReadonlyMode;
  useEffect(() => {
    if (!hasScoringColumns) return;
    updateAttributes({ matrixSummary: { ...matrixSummary } });
  }, [
    hasScoringColumns,
    matrixSummary.totalPoints,
    matrixSummary.totalMaxPoints,
    matrixSummary.totalScore,
    matrixSummary.passCount,
    matrixSummary.failCount,
    matrixSummary.totalPassFail,
    matrixSummary.hasCriticalFail,
    updateAttributes,
  ]);

  const [cellModal, setCellModal] = useState<{
    visible: boolean;
    row?: any;
    col?: any;
    value?: any;
    viewOnly?: boolean;
    writeFn?: (rowId: string, colId: string, value: any) => void;
  }>({ visible: false });
  const [showEditor, setShowEditor] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);

  // Query parameter handling
  useEffect(() => {
    if (queryParam && isSubmitMode) {
      const paramValue = getQueryParam(queryParam);
      if (paramValue) {
        try {
          const parsed = JSON.parse(paramValue);
          if (typeof parsed === 'object' && parsed !== null) {
            updateAttributes({ cells: parsed });
          }
        } catch {
          // If not JSON, ignore
        }
      }
    }
  }, [queryParam, isSubmitMode, updateAttributes]);

  // Visibility evaluation (same pattern as SingleChoice/MultipleChoice/ShortTextField)
  const formState = useMemo(() => {
    const json = editor.getJSON();
    const state: Record<string, any> = {};
    const walk = (node: any) => {
      if (node.attrs && node.attrs.name) {
        // Matrix field uses cells; other fields use value
        if (node.type === 'matrixField') {
          state[node.attrs.name] = node.attrs.cells != null ? node.attrs.cells : null;
        } else {
          state[node.attrs.name] = node.attrs.value ?? null;
        }
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(walk);
      }
    };
    if (json.content) json.content.forEach(walk);
    return state;
  }, [editor]);

  // Cell read/write helpers
  const readCell = useCallback((rowId: string, colId: string) => {
    const val = (cells[rowId] && cells[rowId][colId]) ?? null;
    const col = columns.find((c: any) => c.id === colId);
    if (col && val !== null) {
      return normalizeValue(val, col.type);
    }
    return val;
  }, [cells, columns]);
  
  const writeCell = useCallback((rowId: string, colId: string, value: any) => {
    const col = columns.find((c: any) => c.id === colId);
    const normalizedValue = col ? normalizeValue(value, col.type) : value;
    
    const next = { ...(cells as any) };
    if (!next[rowId]) next[rowId] = {};
    next[rowId] = { ...next[rowId], [colId]: normalizedValue };
    updateAttributes({ cells: next });
  }, [cells, columns, updateAttributes]);

  const isVisible = useMemo(() => {
    return evaluateVisibility(visibility.rules || [], formState, visibility.match || 'all');
  }, [visibility, formState]);

  // HOT PATCH: First column - 80px on mobile, 100px desktop (can shrink to 50px with many columns)
  // Mobile uses smaller first column to give more space to answer columns
  const baseWidth = isMobile ? 80 : 100;
  const leftColWidth = Math.max(150, baseWidth - Math.max(0, columns.length - 3) * 10);
  const rowLabel = node.attrs.rowLabel || 'Item';

  const getAdjustedColumnWidth = useCallback((col: any): number => {
    const colMinWidth = getColumnMinWidth(col);
    return isMobile ? Math.max(colMinWidth * 0.7, 80) : colMinWidth;
  }, [isMobile]);

  // Calculate scroll.x width - HOT PATCH: removed 2000px minimum
  // Only add small buffer for visual spacing, not artificial inflation
  const scrollXWidth = useMemo(() => {
    if (columns.length === 0) return leftColWidth + 50;
    
    // Calculate total width: fixed left column + all other columns
    const totalTableWidth = leftColWidth + columns.reduce((sum, col) => {
      return sum + getAdjustedColumnWidth(col);
    }, 0);
    
    // Small buffer for visual spacing - no artificial inflation
    return totalTableWidth + 20;
  }, [columns, leftColWidth, getAdjustedColumnWidth]);

  // Build table columns (pass showScoringInCell so cells show points/pass-fail only in edit/readonly)
  const tableColumns = useMemo(() => {
    return buildTableColumns({
      columns,
      rows,
      rowLabel,
      leftColWidth,
      isMobile,
      isEditMode,
      isInputDisabled,
      showScoringInCell,
      showBulkSetAll: isEditMode || isSubmitMode,
      readCellFn: readCell,
      writeCellFn: writeCell,
      cells,
      rules,
      getAdjustedColumnWidth,
      setCellModal,
      updateAttributes,
      token,
    });
  }, [columns, rows, rowLabel, leftColWidth, isMobile, isEditMode, isSubmitMode, isInputDisabled, showScoringInCell, readCell, writeCell, cells, rules, getAdjustedColumnWidth, setCellModal, updateAttributes, token]);

  // Table dataSource (include per-row critical fail for row-based indicator)
  const dataSource = useMemo(() => rows.map((r: any) => ({
    key: r.id,
    id: r.id,
    label: r.label,
    tooltip: r.tooltip || '',
    criticalFail: matrixSummary.perRow?.find((p: any) => p.rowId === r.id)?.criticalFail ?? false,
  })), [rows, matrixSummary.perRow]);

  // Badges row: align with SingleChoice/MultipleChoice - hide scoring badges in submit mode
  const renderBadgesRow = () => {
    const tags: React.ReactNode[] = [];
    if (required) {
      tags.push(<Tag key="req" color="red">Required</Tag>);
    }
    if (!isSubmitMode && hasScoringColumns) {
      if (columns.some((c: any) => (c.type === 'choice' || c.type === 'multiple') && c.enablePassFail)) {
        tags.push(<Tag key="pf" color="green">Pass/Fail</Tag>);
      }
      if (columns.some((c: any) => (c.type === 'choice' || c.type === 'multiple') && c.enablePoints)) {
        tags.push(<Tag key="pts" color="geekblue">Points</Tag>);
      }
      if (hasAnyFailCritical) {
        tags.push(<Tag key="fc" color="orange">Fail Critical</Tag>);
      }
    }
    if (tags.length === 0) return null;
    return (
      <Space size={4} style={{ marginBottom: 8 }} wrap>
        {tags}
      </Space>
    );
  };

  if (!isVisible && !isEditMode) {
    return null;
  }

  return (
    <NodeViewWrapper
      className="matrix-node-wrapper"
      style={{
        padding: isMobile ? 6 : 8,
        border: `1px dashed ${token.colorBorder}`,
        margin: isMobile ? '6px 0' : '8px 0',
        background: token.colorBgContainer,
        borderRadius: 8,
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="matrix-node-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          marginBottom: isMobile ? 6 : 8,
          flexWrap: 'wrap',
          gap: 8,
          rowGap: isMobile ? 4 : 8,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: isMobile ? 14 : undefined, minWidth: 0, flex: isMobile ? '1 1 100%' : undefined }}>
          {node.attrs.label ?? 'Matrix'}
        </div>
        {/* Show points/pass-fail/critical summary in edit (builder) and readonly (evaluator); hide in submit (respondent) - align with SingleChoice/MultipleChoice */}
        {/* {(isEditMode || isReadonlyMode) && (matrixSummary.totalMaxPoints > 0 || matrixSummary.passCount > 0 || matrixSummary.failCount > 0 || matrixSummary.hasCriticalFail) && (
          <div style={{ fontSize: 12, color: token.colorTextSecondary, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {matrixSummary.totalMaxPoints > 0 && (
              <span>Points: {matrixSummary.totalPoints} / {matrixSummary.totalMaxPoints}</span>
            )}
            {(matrixSummary.passCount > 0 || matrixSummary.failCount > 0) && (
              <span>Pass: {matrixSummary.passCount} | Fail: {matrixSummary.failCount}</span>
            )}
            {matrixSummary.hasCriticalFail && (
              <span style={{ color: token.colorError, fontWeight: 500 }}>Critical Fail</span>
            )}
          </div>
        )} */}
        {isEditMode && (
          <Space>
             <Tooltip title="Edit field settings">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setShowEditor(true)}
              />
            </Tooltip>
            <Tooltip title="Delete field">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={deleteNode}
              />
            </Tooltip>
          </Space>
        )}
      </div>
      {renderBadgesRow()}
      {isSubmitMode && shouldShowGrouping && (
        <div style={{ marginBottom: 8, textAlign: isMobile ? 'left' : 'right' }}>
          <Button
            size="small"
            type="default"
            icon={<SettingOutlined />}
            variant='solid'
            color='blue'
            onClick={() => setShowGroupingModal(true)}
            style={isMobile ? { width: '100%' } : undefined}
          >
            Subject Group Settings
          </Button>
        </div>
      )}

      {isSubmitMode && (
        <Modal
          open={showGroupingModal}
          title="Configure Groups for This Field"
          onCancel={() => setShowGroupingModal(false)}
          footer={null}
          destroyOnHidden
        >
          <NodeGroupingManager
            value={{
              enableGrouping: enableGrouping,
              nodeGroups: nodeGroups || [],
            }}
            onChange={(value) => {
              updateAttributes({
                enableGrouping: value.enableGrouping,
                nodeGroups: value.nodeGroups,
              });
            }}
            subjectsOptions={
              (editor.storage as any)?.formBuilder?.subjects || []
            }
            globalGroups={
              (editor.storage as any)?.formBuilder?.globalGroups || []
            }
            fieldLabel={extractNodeLabel(node)}
          />
        </Modal>
      )}

      {shouldShowGrouping ? (
        <GroupingTables
          groups={groupsToUse}
          ungroupedSubjects={ungroupedSubjects}
          availableSubjects={availableSubjects}
          enableGrouping={enableGrouping}
          nodeGroupValues={nodeGroupValues}
          columns={columns}
          rows={rows}
          dataSource={dataSource}
          rowLabel={rowLabel}
          leftColWidth={leftColWidth}
          isMobile={isMobile}
          isInputDisabled={isInputDisabled}
          scrollXWidth={scrollXWidth}
          getAdjustedColumnWidth={getAdjustedColumnWidth}
          rules={rules}
          setCellModal={setCellModal}
          updateAttributes={updateAttributes}
          subjectsOptions={subjectsOptions}
          showScoringInCell={isReadonlyMode}
          showBulkSetAll={isEditMode || isSubmitMode}
        />
      ) : (
        <div className="matrix-table-wrapper">
          <Table
            dataSource={dataSource}
            columns={tableColumns}
            rowKey="id"
            pagination={false}
            bordered
            tableLayout="fixed"
            scroll={{ 
              x: scrollXWidth,
              y: rows.length > 10 ? (isMobile ? 300 : 500) :  (isMobile ? 400 : 600)
            }}
            size="small"
          />
        </div>
      )}

      <CellModal
        visible={cellModal.visible}
        row={cellModal.row}
        column={cellModal.col}
        initialValue={cellModal.value}
        viewOnly={cellModal.viewOnly === true}
        onSave={(v: any) => {
          if (cellModal.row && cellModal.col) {
            const writeFn = cellModal.writeFn || writeCell;
            writeFn(cellModal.row.id, cellModal.col.id, v);
          }
          setCellModal({ visible: false });
        }}
        onCancel={() => setCellModal({ visible: false })}
      />

      <Modal
        open={showEditor}
        title="Edit Matrix"
        onCancel={() => setShowEditor(false)}
        footer={null}
        width={isMobile ? '100%' : '90%'}
        style={isMobile ? { maxWidth: '100%', top: 8, paddingBottom: 8, margin: '0 8px' } : undefined}
        styles={isMobile ? { body: { maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' } } : undefined}
      >
        <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Matrix Type</div>
            <Select
              value={node.attrs.matrixType || 'mixed'}
              onChange={(value) => updateAttributes({ matrixType: value })}
              style={{ width: '100%' }}
            >
              <Select.Option value="single">
                Single Choice per Row (5.1) - Radio buttons, one selection per row
              </Select.Option>
              <Select.Option value="multiple">
                Multiple Choice per Row (5.2) - Checkboxes, multiple selections per row
              </Select.Option>
              <Select.Option value="mixed">
                Mixed Input Columns (5.3) - Any combination of field types
              </Select.Option>
            </Select>
            <div style={{ marginTop: 4, fontSize: 12, color: token.colorTextTertiary }}>
              {node.attrs.matrixType === 'single' && 'Use for: Skills table (Pass/Fail/N/A), uniform scales (1-5, Y/N)'}
              {node.attrs.matrixType === 'multiple' && 'Use for: Multiple applicable protocols per skill, checkbox grid'}
              {node.attrs.matrixType === 'mixed' && 'Use for: Per-skill scores, notes, dates, files, signatures, computed values'}
            </div>
          </div> */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Row Label (Column Header)</div>
            <Input
              value={node.attrs.rowLabel ?? 'Item'}
              onChange={(e) => {
                const value = e.target.value.trim();
                updateAttributes({ rowLabel: value || 'Item' });
              }}
              placeholder="e.g., Skill / Learning Outcome, Item, Row Name"
              style={{ width: '100%' }}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: token.colorTextTertiary }}>
              Label for the first column (row names column)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ flex: 1, minWidth: isMobile ? undefined : 0 }}>
            <h4>Columns</h4>
            <ColumnEditor
              value={columns}
              onChange={(cols: any[]) => updateAttributes({ columns: cols })}
            />
          </div>
          <div style={{ flex: 1, minWidth: isMobile ? undefined : 0 }}>
            <h4>Rows</h4>
            <RowEditor
              value={rows}
              onChange={(rowsArr: any[]) => updateAttributes({ rows: rowsArr })}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h4>Rules</h4>
          <RulesBuilder
            columns={columns}
            rows={rows}
            value={rules}
            onChange={(r: any[]) => updateAttributes({ rules: r })}
          />
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <Button onClick={() => setShowEditor(false)}>Close</Button>
        </div>
      </Modal>
    </NodeViewWrapper>
  );
};

export default MatrixComponent;
