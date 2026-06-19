/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Table, Card, Tag, Space } from 'antd';
import { theme } from 'antd';
import { buildSimpleTableColumns } from './tableColumns';
import { normalizeValue } from './utils';
import './matrix-table.css';

interface GroupingTablesProps {
  groups: any[];
  ungroupedSubjects: any[];
  availableSubjects: any[];
  enableGrouping: boolean;
  nodeGroupValues: Record<string, Record<string, Record<string, any>>>;
  columns: any[];
  rows: any[];
  dataSource: any[];
  rowLabel: string;
  leftColWidth: number;
  isMobile: boolean;
  isInputDisabled: boolean;
  scrollXWidth: number;
  getAdjustedColumnWidth: (col: any) => number;
  rules: any[];
  setCellModal: (modal: {
    visible: boolean;
    row?: any;
    col?: any;
    value?: any;
    viewOnly?: boolean;
    writeFn?: (rowId: string, colId: string, value: any) => void;
  }) => void;
  updateAttributes: (attrs: any) => void;
  subjectsOptions: any[];
  /** When true, show points/pass-fail in cells (e.g. readonly). Hide in submit. */
  showScoringInCell?: boolean;
  /** When true, show "Set all" bulk dropdown on choice/boolean/multiple columns (edit + submit). */
  showBulkSetAll?: boolean;
}

export const GroupingTables: React.FC<GroupingTablesProps> = ({
  groups,
  ungroupedSubjects,
  availableSubjects,
  enableGrouping,
  nodeGroupValues,
  columns,
  rows,
  dataSource,
  rowLabel,
  leftColWidth,
  isMobile,
  isInputDisabled,
  scrollXWidth,
  getAdjustedColumnWidth,
  rules,
  setCellModal,
  updateAttributes,
  subjectsOptions,
  showScoringInCell = false,
  showBulkSetAll = false,
}) => {
  const { token } = theme.useToken();

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {/* Per-group matrices */}
      {groups.map((group: any) => {
        const entityId = `group-${group.id}`;
        const groupCells = (nodeGroupValues[entityId] && typeof nodeGroupValues[entityId] === 'object') 
          ? nodeGroupValues[entityId] 
          : {};
        const groupSubjects = (group.subjectIds || [])
          .map((id: string) =>
            subjectsOptions.find((s: any) => s.value === id),
          )
          .filter(Boolean)
          .map((s: any) => s.label)
          .join(', ');
        
        // Helper to read/write cells for this specific group
        const readCellForGroup = (rowId: string, colId: string) => {
          const val = (groupCells[rowId] && groupCells[rowId][colId]) ?? null;
          const col = columns.find((c: any) => c.id === colId);
          if (col && val !== null) {
            return normalizeValue(val, col.type);
          }
          return val;
        };
        
        const writeCellForGroup = (rowId: string, colId: string, value: any) => {
          const col = columns.find((c: any) => c.id === colId);
          const normalizedValue = col ? normalizeValue(value, col.type) : value;
          
          const currentGroupCells = groupCells || {};
          const next = { ...currentGroupCells };
          if (!next[rowId]) next[rowId] = {};
          next[rowId] = { ...next[rowId], [colId]: normalizedValue };
          
          // Update nodeGroupValues for this group
          const updatedNodeGroupValues = { ...nodeGroupValues, [entityId]: next };
          updateAttributes({ nodeGroupValues: updatedNodeGroupValues });
        };

        const onBulkSetAllForGroup = (colKey: string, value: any) => {
          const col = columns.find((c: any) => c.id === colKey);
          const normalizedValue = col ? normalizeValue(value, col.type) : value;
          const next = { ...(groupCells || {}) };
          dataSource.forEach((r: any) => {
            next[r.id] = { ...(next[r.id] || {}), [colKey]: normalizedValue };
          });
          updateAttributes({ nodeGroupValues: { ...nodeGroupValues, [entityId]: next } });
        };
        
        const groupTableColumns = buildSimpleTableColumns({
          columns,
          rowLabel,
          leftColWidth,
          isMobile,
          isInputDisabled,
          showScoringInCell,
          showBulkSetAll,
          rows: dataSource.map((r: any) => ({ id: r.id, label: r.label, tooltip: r.tooltip })),
          onBulkSetAll: onBulkSetAllForGroup,
          readCellFn: readCellForGroup,
          writeCellFn: writeCellForGroup,
          cells: groupCells,
          rules,
          getAdjustedColumnWidth,
          setCellModal,
          token,
        });
        
        return (
          <Card
            key={entityId}
            size="small"
            style={{ background: token.colorFillAlter, width: '100%', maxWidth: '100%' }}
            styles={{ body: { padding: 0, overflow: 'visible' }, header: { padding: isMobile ? '8px 12px' : undefined } }}
            title={
              <Space wrap size="small">
                <Tag color="blue">Group</Tag>
                <span style={{ wordBreak: 'break-word' }}>{group.name}</span>
                {groupSubjects && !isMobile && (
                  <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                    ({groupSubjects})
                  </span>
                )}
              </Space>
            }
          >
            <div className="matrix-table-wrapper">
              <Table
                dataSource={dataSource}
                columns={groupTableColumns}
                rowKey="id"
                pagination={false}
                bordered
                tableLayout="fixed"
                scroll={{ 
                  x: scrollXWidth,
                  y: rows.length > 10 ? (isMobile ? 300 : 500) : (isMobile ? 400 : 600)
                }}
                size="small"
              />
            </div>
          </Card>
        );
      })}

      {/* Per-ungrouped-subject matrices */}
      {(enableGrouping ? ungroupedSubjects : availableSubjects).length > 0 && (
        <Card
          size="small"
          style={{ background: token.colorFillAlter, width: '100%', maxWidth: '100%' }}
          styles={{ body: { padding: 0, overflow: 'visible' }, header: { padding: isMobile ? '8px 12px' : undefined } }}
          title={
            <Space>
              <Tag>Ungrouped Subjects</Tag>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {(enableGrouping ? ungroupedSubjects : availableSubjects).map((subject: any) => {
              const entityId = `ungrouped-${subject.value}`;
              const subjectCells = (nodeGroupValues[entityId] && typeof nodeGroupValues[entityId] === 'object') 
                ? nodeGroupValues[entityId] 
                : {};
              
              // Helper to read/write cells for this specific subject
              const readCellForSubject = (rowId: string, colId: string) => {
                const val = (subjectCells[rowId] && subjectCells[rowId][colId]) ?? null;
                const col = columns.find((c: any) => c.id === colId);
                if (col && val !== null) {
                  return normalizeValue(val, col.type);
                }
                return val;
              };
              
              const writeCellForSubject = (rowId: string, colId: string, value: any) => {
                const col = columns.find((c: any) => c.id === colId);
                const normalizedValue = col ? normalizeValue(value, col.type) : value;
                
                const currentSubjectCells = subjectCells || {};
                const next = { ...currentSubjectCells };
                if (!next[rowId]) next[rowId] = {};
                next[rowId] = { ...next[rowId], [colId]: normalizedValue };
                
                // Update nodeGroupValues for this subject
                const updatedNodeGroupValues = { ...nodeGroupValues, [entityId]: next };
                updateAttributes({ nodeGroupValues: updatedNodeGroupValues });
              };

              const onBulkSetAllForSubject = (colKey: string, value: any) => {
                const col = columns.find((c: any) => c.id === colKey);
                const normalizedValue = col ? normalizeValue(value, col.type) : value;
                const next = { ...(subjectCells || {}) };
                dataSource.forEach((r: any) => {
                  next[r.id] = { ...(next[r.id] || {}), [colKey]: normalizedValue };
                });
                updateAttributes({ nodeGroupValues: { ...nodeGroupValues, [entityId]: next } });
              };
              
              const subjectTableColumns = buildSimpleTableColumns({
                columns,
                rowLabel,
                leftColWidth,
                isMobile,
                isInputDisabled,
                showScoringInCell,
                showBulkSetAll,
                rows: dataSource.map((r: any) => ({ id: r.id, label: r.label, tooltip: r.tooltip })),
                onBulkSetAll: onBulkSetAllForSubject,
                readCellFn: readCellForSubject,
                writeCellFn: writeCellForSubject,
                cells: subjectCells,
                rules,
                getAdjustedColumnWidth,
                setCellModal,
                token,
              });
              
              return (
                <div key={entityId}>
                  <div style={{ marginBottom: 8 }}>
                    <Tag>{subject.label}</Tag>
                  </div>
                  <div className="matrix-table-wrapper">
                    <Table
                      dataSource={dataSource}
                      columns={subjectTableColumns}
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
                </div>
              );
            })}
          </Space>
        </Card>
      )}
    </Space>
  );
};
