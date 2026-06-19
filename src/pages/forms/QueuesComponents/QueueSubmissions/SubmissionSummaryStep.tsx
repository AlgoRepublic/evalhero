import React, { useMemo } from 'react';
import {
  Card,
  Empty,
  Flex,
  Space,
  Typography,
  Descriptions,
  Divider,
  Tag,
  Table,
  GlobalToken,
} from 'antd';
import {
  FileTextOutlined,
  CheckSquareOutlined,
  UserOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  StarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TagsOutlined,
  TableOutlined,
  WarningOutlined,
  PaperClipOutlined,
  DownloadOutlined,
  FileImageOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { extractFieldRows, FieldRow } from '../submissionUtils';
import { JSONContent } from '@tiptap/core';
import { useGetTagsByIdsQuery } from '../../../../services/tagsApi';

const { Text, Title, Paragraph } = Typography;

interface SubmissionSummaryStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submission: any;
  token: GlobalToken;
  /** Optional assignment for passing thresholds (passingScore, passingPassFailCount). */
  assignment?: { 
    passingScore?: number; 
    passingPassFailCount?: number;
    maxPointsPossible?: number;
    totalPassFail?: number;
  };
}

export const SubmissionSummaryStep: React.FC<SubmissionSummaryStepProps> = ({
  submission,
  token,
  assignment,
}) => {
  const rows = extractFieldRows(submission?.answers as JSONContent);
  const enablePointsTruthy = (r: { enablePoints?: boolean | string }) =>
    r.enablePoints === true || r.enablePoints === 'true';
  const enablePassFailTruthy = (r: { enablePassFail?: boolean | string }) =>
    r.enablePassFail === true || r.enablePassFail === 'true';
  const isCorrectTruthy = (r: { isCorrect?: boolean }) => r.isCorrect === true;
  const failCriticalTruthy = (r: { failCritical?: boolean | string }) =>
    r.failCritical === true || r.failCritical === 'true';

  const rowsWithPointsScoring = rows.filter(enablePointsTruthy);
  const totalScore = rowsWithPointsScoring.reduce(
    (sum, r) => sum + (typeof r.points === 'number' ? r.points : Number(r.points) || 0),
    0
  );
  const maxPointsPossible = assignment?.maxPointsPossible || 0;

  // Total pass/fail: match computeScoringFromSchema — single/multiple choice count as 1 each;
  // matrix: total = totalPassFail (number of pass/fail cells), passing = passedCellCount (cells that are correct)
  const { totalPassFail, passingPassFailCount } = useMemo(() => {
    let total = 0;
    let passing = 0;
    rows.forEach((r) => {
      if (!enablePassFailTruthy(r)) return;
      if (r.type === 'matrixField' && r.matrixSummarySnapshot) {
        const snap = r.matrixSummarySnapshot;
        total += snap.totalPassFail;
        passing += snap.passedCellCount ?? snap.passCount;
      } else {
        total += 1;
        if (isCorrectTruthy(r)) passing += 1;
      }
    });
    return { totalPassFail: total, passingPassFailCount: passing };
  }, [rows]);

  const totalQuestions = rows.length;

  const hasCriticalFail = rows.some(
    (r) => failCriticalTruthy(r) && r.isCorrect === false
  );
  // Overall fail if: score below passing, pass/fail count below required, or any critical fail
  const scoreFail =
    typeof assignment?.passingScore === 'number' &&
    totalScore < assignment.passingScore;
  const passFailCountFail =
    typeof assignment?.passingPassFailCount === 'number' &&
    passingPassFailCount < assignment.passingPassFailCount;
  const overallFail =
    hasCriticalFail || scoreFail || passFailCountFail;
  const overallPass = !overallFail;

  // Collect all unique tag IDs from all field rows
  const allTagIds = useMemo(() => {
    const tagIdsSet = new Set<string>();
    rows.forEach((row) => {
      if (row.tags && Array.isArray(row.tags)) {
        row.tags.forEach((tagId) => {
          if (tagId && typeof tagId === 'string') {
            tagIdsSet.add(tagId);
          }
        });
      }
    });
    return Array.from(tagIdsSet);
  }, [rows]);

  // Fetch tags by IDs
  const { data: tagsResponse } = useGetTagsByIdsQuery(
    { tagIds: allTagIds },
    { skip: allTagIds.length === 0 }
  );

  // Create a map of tag ID to tag name for quick lookup
  const tagsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (tagsResponse?.data?.tags) {
      tagsResponse.data.tags.forEach((tag) => {
        map.set(tag._id, tag.name);
      });
    }
    return map;
  }, [tagsResponse]);

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'submitted':
        return 'green';
      case 'draft':
        return 'orange';
      case 'pending':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getFieldIcon = (type?: string) => {
    switch (type) {
      case 'shortText':
      case 'longText':
        return <FileTextOutlined />;
      case 'numberField':
        return <FileTextOutlined />;
      case 'dateField':
      case 'dateTimeField':
        return <ClockCircleOutlined />;
      case 'singleChoice':
      case 'multipleChoice':
        return <CheckSquareOutlined />;
      case 'matrixField':
        return <TableOutlined />;
      case 'ratingField':
        return <StarOutlined />;
      case 'addressNode':
      case 'addressField':
        return <EnvironmentOutlined />;
      default:
        return <FileTextOutlined />;
    }
  };

  const formatValue = (row: FieldRow): React.ReactNode => {
    const {
      value,
      type,
      addressComponents,
      rawDateValue,
      options,
      otherValue,
      matrixSummarySnapshot,
      matrixColumns,
      matrixRows,
    } = row;

    const formatFileSize = (bytes?: number) => {
      if (!bytes || Number.isNaN(bytes)) return '—';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Helper: parse optionPoints entry (tiptap may store as strings)
    const parseOpt = (entry: any) => {
      if (!entry || typeof entry !== 'object') return { points: 0, isCorrect: false };
      const points = entry.points !== undefined && entry.points !== null && entry.points !== ''
        ? (typeof entry.points === 'number' ? entry.points : Number(entry.points) || 0)
        : 0;
      const isCorrect = entry.isCorrect === true || entry.isCorrect === 'true';
      return { points, isCorrect };
    };

    // Handle matrix field: summary, per-row breakdown, and detailed cell table
    if (type === 'matrixField') {
      const snap = matrixSummarySnapshot;
      const cells = value && typeof value === 'object' ? value : {};
      const cols = matrixColumns ?? [];
      const rws = matrixRows ?? [];

      if (!snap) {
        return (
          <Text type="secondary" italic>
            No summary available
          </Text>
        );
      }

      return (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {/* Summary block */}
          <Card size="small" style={{ background: token.colorFillAlter, border: `1px solid ${token.colorBorderSecondary}` }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text strong style={{ fontSize: 13 }}>Summary</Text>
              <Flex wrap="wrap" gap={16} align="center">
                {snap.totalMaxPoints > 0 && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Points</Text>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {snap.totalPoints} / {snap.totalMaxPoints}
                    </div>
                  </div>
                )}
                {(snap.totalPassFail > 0 || (snap.passedCellCount ?? snap.passCount) > 0 || (snap.failedCellCount ?? snap.failCount) > 0) && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Pass / Fail</Text>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      <Tag color="success" style={{ margin: 0 }}>Pass: {snap.passedCellCount ?? snap.passCount}</Tag>
                      <Tag color="error" style={{ margin: 0, marginLeft: 4 }}>Fail: {snap.failedCellCount ?? snap.failCount}</Tag>
                      {snap.totalPassFail > 0 && (
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>(of {snap.totalPassFail} cells)</Text>
                      )}
                    </div>
                  </div>
                )}
                {snap.hasCriticalFail && (
                  <Tag color="error" icon={<WarningOutlined />}>
                    Critical Fail
                  </Tag>
                )}
              </Flex>
            </Space>
          </Card>

          {/* Per-row breakdown */}
          {snap.perRow && snap.perRow.length > 0 && (
            <div>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Per row</Text>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {snap.perRow.map((pr) => (
                  <div
                    key={pr.rowId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      padding: '8px 10px',
                      background: token.colorFillAlter,
                      borderRadius: 6,
                      borderLeft: pr.criticalFail ? `4px solid ${token.colorError}` : undefined,
                    }}
                  >
                    <Text strong style={{ minWidth: 100 }}>{pr.label ?? pr.rowId}</Text>
                    {pr.maxPoints > 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {pr.points} / {pr.maxPoints} pts
                      </Text>
                    )}
                    {(pr.pass || pr.fail) && (
                      <Tag color={pr.pass ? 'success' : 'error'} style={{ margin: 0 }}>
                        {pr.pass ? 'Pass' : 'Fail'}
                      </Tag>
                    )}
                    {pr.criticalFail && (
                      <Tag color="error" icon={<WarningOutlined />} style={{ margin: 0 }}>Critical Fail</Tag>
                    )}
                  </div>
                ))}
              </Space>
            </div>
          )}

          {/* Detailed cell table */}
          {rws.length > 0 && cols.length > 0 && (
            <div>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Responses by row and column</Text>
              <div style={{ overflowX: 'auto' }}>
                <Table
                  rowKey="key"
                  size="small"
                  pagination={false}
                  bordered
                  dataSource={rws.map((r) => {
                    const rowCells: Record<string, React.ReactNode> = { key: r.id, _rowLabel: r.label };
                    cols.forEach((c) => {
                      const val = cells[r.id] && cells[r.id][c.id];
                      const displayVal = val === null || val === undefined || val === ''
                        ? '—'
                        : Array.isArray(val)
                          ? val.join(', ')
                          : String(val);
                      if (c.enablePoints || c.enablePassFail) {
                        const optionPoints = c.optionPoints || {};
                        if (c.type === 'choice' && typeof val === 'string') {
                          const entry = parseOpt(optionPoints[val]);
                          rowCells[c.id] = (
                            <Space size={4} wrap>
                              <span>{displayVal}</span>
                              {c.enablePoints && <Tag color="blue" style={{ margin: 0 }}>{entry.points} pts</Tag>}
                              {c.enablePassFail && (
                                <Tag color={entry.isCorrect ? 'success' : 'error'} style={{ margin: 0 }}>
                                  {entry.isCorrect ? '✓' : '✗'}
                                </Tag>
                              )}
                            </Space>
                          );
                        } else if (c.type === 'multiple' && Array.isArray(val)) {
                          const arr = val as string[];
                          let pts = 0;
                          let allCorrect = arr.length > 0;
                          arr.forEach((v) => {
                            const e = parseOpt(optionPoints[v]);
                            if (e.isCorrect && e.points >= 0) pts += e.points;
                            if (!e.isCorrect) allCorrect = false;
                          });
                          rowCells[c.id] = (
                            <Space size={4} wrap>
                              <span>{displayVal}</span>
                              {c.enablePoints && <Tag color="blue" style={{ margin: 0 }}>{pts} pts</Tag>}
                              {c.enablePassFail && (
                                <Tag color={allCorrect ? 'success' : 'error'} style={{ margin: 0 }}>
                                  {allCorrect ? '✓' : '✗'}
                                </Tag>
                              )}
                            </Space>
                          );
                        } else {
                          rowCells[c.id] = displayVal;
                        }
                      } else {
                        rowCells[c.id] = displayVal;
                      }
                    });
                    return rowCells;
                  })}
                  columns={[
                    { title: 'Row', dataIndex: '_rowLabel', key: '_rowLabel', fixed: 'left' as const, width: 120, render: (t: string) => <Text strong>{t}</Text> },
                    ...cols.map((c) => ({
                      title: c.label,
                      dataIndex: c.id,
                      key: c.id,
                      render: (node: React.ReactNode) => node ?? '—',
                      width: 180,
                    })),
                  ]}
                  scroll={{ x: cols.length * 180 + 120 }}
                  style={{ fontSize: 12 }}
                />
              </div>
            </div>
          )}
        </Space>
      );
    }

    // File upload: show list with size/status/download.
    if (type === 'fileField') {
      const files = Array.isArray(row.fileItems)
        ? row.fileItems
        : Array.isArray(value)
          ? value
          : [];
      if (!files.length) {
        return (
          <Text type="secondary" italic>
            No files uploaded
          </Text>
        );
      }
      return (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {files.map((file: any, idx: number) => {
            const fileName = file?.name || `File ${idx + 1}`;
            const fileUrl = file?.url;
            const isImage = typeof file?.mime === 'string' && file.mime.startsWith('image/');
            return (
              <Card
                key={`${fileName}-${idx}`}
                size="small"
                style={{ background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}
              >
                <Flex justify="space-between" align="center" gap={8} wrap>
                  <Space size={8} style={{ minWidth: 0 }}>
                    {isImage ? <FileImageOutlined /> : <PaperClipOutlined />}
                    <Text strong ellipsis style={{ maxWidth: 280 }}>
                      {fileName}
                    </Text>
                  </Space>
                  {fileUrl ? (
                    <a href={String(fileUrl)} target="_blank" rel="noopener noreferrer">
                      <Space size={4}>
                        <DownloadOutlined />
                        <span>Open</span>
                      </Space>
                    </a>
                  ) : (
                    <Text type="secondary">No URL</Text>
                  )}
                </Flex>
                <Space size={10} wrap style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Size: {formatFileSize(typeof file?.size === 'number' ? file.size : Number(file?.size))}
                  </Text>
                  {file?.mime && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Type: {String(file.mime)}
                    </Text>
                  )}
                  {/* {file?.scanStatus && (
                    <Tag style={{ margin: 0 }} color={String(file.scanStatus).toLowerCase() === 'clean' ? 'success' : 'default'}>
                      {String(file.scanStatus)}
                    </Tag>
                  )} */}
                </Space>
              </Card>
            );
          })}
        </Space>
      );
    }

    // Signature: show signer metadata + preview/link.
    if (type === 'signatureField') {
      const sig = row.signatureInfo || (value && typeof value === 'object' ? value : null);
      if (!sig) {
        return (
          <Text type="secondary" italic>
            No signature captured
          </Text>
        );
      }
      const signatureUrl = sig.uploadedUrl || sig.dataUrl || null;
      return (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space size={8}>
            <FormOutlined />
            <Text strong>{sig.signerName || 'Unknown signer'}</Text>
            {sig.timestamp && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(sig.timestamp).toLocaleString()}
              </Text>
            )}
          </Space>
          {signatureUrl ? (
            <div>
              <img
                src={String(signatureUrl)}
                alt="signature"
                style={{
                  maxWidth: 320,
                  maxHeight: 140,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 6,
                  background: token.colorBgContainer,
                  display: 'block',
                }}
              />
              <div style={{ marginTop: 6 }}>
                <a href={String(signatureUrl)} target="_blank" rel="noopener noreferrer">
                  <Space size={4}>
                    <DownloadOutlined />
                    <span>Open full signature</span>
                  </Space>
                </a>
              </div>
            </div>
          ) : (
            <Text type="secondary" italic>
              Signature image not available
            </Text>
          )}
        </Space>
      );
    }

    // Handle singleChoice and multipleChoice fields - show actual option labels
    if ((type === 'singleChoice' || type === 'multipleChoice') && options) {
      if (type === 'singleChoice') {
        // For single choice, find the selected option
        const selectedOption = options.find(
          (opt) => opt.selected || opt.value === value
        );
        if (selectedOption) {
          // If it's the "Other" option, show the otherValue if available
          if (selectedOption.value === '__other__' && otherValue) {
            return (
              <Space size={4}>
                <Text strong>{selectedOption.label}:</Text>
                <Text>{otherValue}</Text>
              </Space>
            );
          }
          return <Text strong>{selectedOption.label}</Text>;
        }
        // Fallback to value if option not found
        return <Text strong>{String(value)}</Text>;
      } else {
        // For multiple choice, show all selected options
        const selectedOptions = options.filter(
          (opt) =>
            opt.selected || (Array.isArray(value) && value.includes(opt.value))
        );
        if (selectedOptions.length === 0) {
          return (
            <Text type="secondary" italic>
              No selections
            </Text>
          );
        }
        return (
          <Space size={4} wrap>
            {selectedOptions.map((opt, i) => {
              // Handle "Other" option
              if (opt.value === '__other__' && otherValue) {
                return (
                  <Tag key={i} color="blue" style={{ margin: 0 }}>
                    {opt.label}: {otherValue}
                  </Tag>
                );
              }
              return (
                <Tag key={i} color="blue" style={{ margin: 0 }}>
                  {opt.label}
                </Tag>
              );
            })}
          </Space>
        );
      }
    }

    // Handle address fields with detailed components
    if (
      (type === 'addressNode' || type === 'addressField') &&
      addressComponents
    ) {
      const components = addressComponents;
      const hasAnyValue = Object.entries(components).some(
        ([key, val]) =>
          key !== 'lat' &&
          key !== 'lng' &&
          val !== null &&
          val !== undefined &&
          val !== '' &&
          (typeof val !== 'string' || val.trim().length > 0)
      );

      if (!hasAnyValue) {
        return (
          <Text type="secondary" italic>
            No address provided
          </Text>
        );
      }

      return (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {components.street && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Street:
              </Text>{' '}
              <Text>{components.street}</Text>
            </div>
          )}
          {components.apartment && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Apartment:
              </Text>{' '}
              <Text>{components.apartment}</Text>
            </div>
          )}
          <Space size={16} wrap>
            {components.city && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  City:
                </Text>{' '}
                <Text>{components.city}</Text>
              </div>
            )}
            {components.state && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  State:
                </Text>{' '}
                <Text>{components.state}</Text>
              </div>
            )}
            {components.postalCode && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Postal Code:
                </Text>{' '}
                <Text>{components.postalCode}</Text>
              </div>
            )}
          </Space>
          {components.country && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Country:
              </Text>{' '}
              <Text>{components.country}</Text>
            </div>
          )}
          {components.lat !== null &&
            components.lat !== undefined &&
            components.lng !== null &&
            components.lng !== undefined && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Coordinates:
                </Text>{' '}
                <Text code style={{ fontSize: 11 }}>
                  {components.lat.toFixed(6)}, {components.lng.toFixed(6)}
                </Text>
              </div>
            )}
          {components.formatted && components.formatted.trim() && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                Formatted Address:
              </Text>
              <div style={{ marginTop: 4 }}>
                <Text>{components.formatted}</Text>
              </div>
            </div>
          )}
        </Space>
      );
    }

    // Handle date and dateTime fields with improved formatting
    if ((type === 'dateField' || type === 'dateTimeField') && rawDateValue) {
      try {
        const date = new Date(rawDateValue);
        if (!isNaN(date.getTime())) {
          if (type === 'dateTimeField') {
            return (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong>
                  {date.toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {date.toLocaleDateString(undefined, { weekday: 'long' })}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ISO: {rawDateValue}
                </Text>
              </Space>
            );
          } else {
            return (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong>
                  {date.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {date.toLocaleDateString(undefined, { weekday: 'long' })}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ISO: {rawDateValue}
                </Text>
              </Space>
            );
          }
        }
      } catch {
        // Fall through to default formatting
      }
    }

    // Handle null/undefined/empty values
    if (value === null || value === undefined || value === '') {
      return (
        <Text type="secondary" italic>
          No answer provided
        </Text>
      );
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return (
          <Text type="secondary" italic>
            No selections
          </Text>
        );
      }
      return (
        <Space size={4} wrap>
          {value.map((v, i) => (
            <Tag key={i} color="blue" style={{ margin: 0 }}>
              {String(v)}
            </Tag>
          ))}
        </Space>
      );
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return (
        <Tag
          color={value ? 'green' : 'default'}
          icon={value ? <CheckCircleOutlined /> : null}
        >
          {value ? 'Yes' : 'No'}
        </Tag>
      );
    }

    // Handle numbers
    if (typeof value === 'number') {
      return <Text strong>{value.toLocaleString()}</Text>;
    }

    // Handle strings
    const strValue = String(value);
    if (strValue.length > 200) {
      return (
        <Paragraph
          ellipsis={{ rows: 2, expandable: true, symbol: 'Show more' }}
          style={{ margin: 0, whiteSpace: 'pre-wrap' }}
        >
          {strValue}
        </Paragraph>
      );
    }

    return <Text style={{ whiteSpace: 'pre-wrap' }}>{strValue}</Text>;
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Header */}
      <div>
        <Flex
          justify="space-between"
          align="center"
          style={{ marginBottom: 12 }}
        >
          <Title
            level={4}
            style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FileTextOutlined />
            Submission Summary
          </Title>
          {submission?.status && (
            <Tag
              color={getStatusColor(submission.status)}
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              {submission.status.toUpperCase()}
            </Tag>
          )}
        </Flex>
        <Space size={16} wrap>
          {submission?.updatedAt && (
            <Text
              type="secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <ClockCircleOutlined />
              Updated: {new Date(submission.updatedAt).toLocaleString()}
            </Text>
          )}
          {submission?.createdAt && (
            <Text
              type="secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <ClockCircleOutlined />
              Created: {new Date(submission.createdAt).toLocaleString()}
            </Text>
          )}
        </Space>
      </div>

      <Divider />

      {/* Metadata */}
      <Card
        size="small"
        style={{
          background: token.colorFillAlter,
          borderRadius: 8,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2, md: 3 }}
          items={[
            {
              key: 'assignee',
              label: (
                <Space size={4}>
                  <UserOutlined />
                  Assignee
                </Space>
              ),
              children: submission?.assignee?.user?.name || (
                <Text type="secondary">Not assigned</Text>
              ),
            },
            {
              key: 'subject',
              label: (
                <Space size={4}>
                  <UserOutlined />
                  Subject
                </Space>
              ),
              children: submission?.subject?.user?.name || (
                <Text type="secondary">Not specified</Text>
              ),
            },
            // {
            //   key: 'location',
            //   label: (
            //     <Space size={4}>
            //       <EnvironmentOutlined />
            //       Location
            //     </Space>
            //   ),
            //   children: submission?.location?.address || <Text type="secondary">Not provided</Text>,
            // },
          ]}
        />
      </Card>

      {/* Result — result slip / report card vibes */}
      <Card
        size="small"
        style={{
          background: token.colorBgContainer,
          borderRadius: token.borderRadius,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderLeft: `4px solid ${overallPass ? token.colorSuccess : token.colorError}`,
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: token.paddingMD }}>
          <Flex align="center" gap={token.marginSM} style={{ marginBottom: token.marginMD }}>
            {overallPass ? (
              <CheckCircleOutlined style={{ fontSize: 28, color: token.colorSuccess }} />
            ) : (
              <CloseCircleOutlined style={{ fontSize: 28, color: token.colorError }} />
            )}
            <div>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block' }}>
                Result
              </Text>
              <Text
                strong
                style={{
                  fontSize: 22,
                  color: overallPass ? token.colorSuccess : token.colorError,
                  letterSpacing: '0.02em',
                }}
              >
                {overallPass ? 'Passed' : 'Failed'}
              </Text>
            </div>
            {overallFail && hasCriticalFail && (
              <Text type="secondary" style={{ fontSize: token.fontSizeSM, marginLeft: 'auto' }}>
                Critical question failed
              </Text>
            )}
          </Flex>
          <Divider style={{ margin: `${token.marginSM}px 0` }} />
          <Flex wrap="wrap" gap={token.marginLG} style={{ rowGap: token.marginSM }}>
            {rowsWithPointsScoring.length > 0 && (
              <div>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Score</Text>
                <div style={{ fontSize: token.fontSizeLG, fontWeight: 600 }}>
                  {totalScore}{maxPointsPossible > 0 ? ` / ${maxPointsPossible}` : ''}
                  {typeof assignment?.passingScore === 'number' && (
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, fontWeight: 400, marginLeft: 6 }}>
                      (min {assignment.passingScore})
                      {totalScore >= assignment.passingScore ? ' ✓' : ''}
                    </Text>
                  )}
                </div>
              </div>
            )}
            {totalPassFail > 0 && (
              <div>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Pass / Fail</Text>
                <div style={{ fontSize: token.fontSizeLG, fontWeight: 600 }}>
                  {passingPassFailCount} / {totalPassFail}
                  {typeof assignment?.passingPassFailCount === 'number' && (
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, fontWeight: 400, marginLeft: 6 }}>
                      (min {assignment.passingPassFailCount})
                      {passingPassFailCount >= assignment.passingPassFailCount ? ' ✓' : ''}
                    </Text>
                  )}
                </div>
              </div>
            )}
            {totalQuestions > 0 && (
              <div>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Questions</Text>
                <div style={{ fontSize: token.fontSizeLG, fontWeight: 600 }}>{totalQuestions}</div>
              </div>
            )}
          </Flex>
        </div>
      </Card>

      {/* Form Responses */}
      <div>
        <Title
          level={5}
          style={{
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckSquareOutlined />
          Form Responses
        </Title>
        {rows.length === 0 ? (
          <Empty
            description={<Text type="secondary">No responses recorded</Text>}
          />
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {rows.map((r, idx) => (
              <Card
                key={idx}
                size="small"
                style={{
                  borderRadius: 8,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorBgContainer,
                }}
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Flex align="center" gap={8} wrap>
                    <span style={{ color: token.colorPrimary, fontSize: 16 }}>
                      {getFieldIcon(r.type)}
                    </span>
                    <Text strong style={{ fontSize: 14 }}>
                      {r.label || r.name || r.type || 'Untitled Field'}
                    </Text>
                    {r.tags && r.tags.length > 0 && (
                      <Space size={4} wrap>
                        {r.tags.map((tagId) => {
                          const tagName = tagsMap.get(tagId);
                          return tagName ? (
                            <Tag
                              key={tagId}
                              color="cyan"
                              icon={<TagsOutlined />}
                              style={{ margin: 0 }}
                            >
                              {tagName}
                            </Tag>
                          ) : null;
                        })}
                      </Space>
                    )}
                    {failCriticalTruthy(r) && (
                      <Tag color="red" style={{ margin: 0 }}>
                        Critical fail enabled
                      </Tag>
                    )}
                    {(enablePointsTruthy(r) && (typeof r.points === 'number' || r.points != null)) ||
                    (enablePassFailTruthy(r) && (typeof r.isCorrect === 'boolean' || r.isCorrect != null)) ? (
                      <Space size={4} style={{ marginLeft: 'auto' }}>
                        {enablePointsTruthy(r) && (r.points != null || r.maxPoints != null) && (
                          <Tag color="purple" icon={<StarOutlined />}>
                            {typeof r.points === 'number' ? r.points : Number(r.points) ?? 0}
                            {r.maxPoints != null
                              ? `/${typeof r.maxPoints === 'number' ? r.maxPoints : Number(r.maxPoints) ?? 0}`
                              : ''}
                          </Tag>
                        )}
                        {enablePassFailTruthy(r) && (
                          <Tag color={r.isCorrect === true ? 'success' : 'error'}>
                            {r.isCorrect === true ? '✓' : '✗'}
                          </Tag>
                        )}
                      </Space>
                    ) : null}
                  </Flex>
                  <div
                    style={{
                      padding: '12px',
                      background: token.colorFillAlter,
                      borderRadius: 6,
                      border: `1px solid ${token.colorBorderSecondary}`,
                    }}
                  >
                    {formatValue(r)}
                  </div>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </div>
    </Space>
  );
};
