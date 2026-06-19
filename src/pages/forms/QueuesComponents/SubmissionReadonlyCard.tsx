/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Card, Descriptions, Space, Tag, Typography, Divider, Empty, theme, Button } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  NumberOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  RadiusSettingOutlined,
  StarOutlined,
  EnvironmentOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileOutlined,
  EditOutlined,
  MessageOutlined,
  DownOutlined,
} from '@ant-design/icons';
// import { TemplateEditor } from '../../CanvasBuilderPage';
// import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
// import { extensions as allExtensions } from '../../CanvasBuilderPage/Editor/extensions';
import { JSONContent } from '@tiptap/core';
import { extractFieldRows } from './submissionUtils';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { SubmissionChat } from './SubmissionChat';

const { Title, Text, Paragraph } = Typography;

interface SubmissionReadonlyCardProps {
  submission: any;
  assignmentId?: string;
  formTemplate?: {
    hasApproval?: boolean;
    hasDisputes?: boolean;
    signatureRequired?: boolean;
  };
}

export const SubmissionReadonlyCard: React.FC<SubmissionReadonlyCardProps> = ({ submission, assignmentId, formTemplate }) => {
  const { token } = theme.useToken();
  const { mytheme } = useSelector((state: RootState) => state.theme);
  const { user } = useSelector((state: RootState) => state.auth);
  const isDark = mytheme === 'dark';
  const getFieldIcon = (type?: string) => {
    switch (type) {
      case 'shortText':
      case 'longText':
        return <FileTextOutlined />;
      case 'richText':
        return <EditOutlined />;
      case 'numberField':
        return <NumberOutlined />;
      case 'dateField':
      case 'dateTimeField':
        return <CalendarOutlined />;
      case 'singleChoice':
        return <RadiusSettingOutlined />;
      case 'multipleChoice':
        return <CheckSquareOutlined />;
      case 'ratingField':
        return <StarOutlined />;
      case 'sliderField':
        return <NumberOutlined />;
      case 'addressNode':
        return <EnvironmentOutlined />;
      case 'ranking':
        return <StarOutlined />;
      case 'fileField':
        return <FileOutlined />;
      default:
        return <FileTextOutlined />;
    }
  };

  const formatValue = (value: any, type?: string): React.ReactNode => {
    if (value === null || value === undefined || value === '') {
      return <Text type="secondary" italic>No answer provided</Text>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <Text type="secondary" italic>No selections</Text>;
      }
      
      // Special handling for ranking field - show as numbered list
      if (type === 'ranking') {
        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {value.map((v, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag color="purple" style={{ margin: 0, minWidth: 32, textAlign: 'center' }}>
                  #{i + 1}
                </Tag>
                <Text>{String(v)}</Text>
              </div>
            ))}
          </Space>
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

    if (type === 'richText' && typeof value === 'string') {
      // Strip HTML tags for display
      const textOnly = value.replace(/<[^>]+>/g, '').trim();
      if (!textOnly) {
        return <Text type="secondary" italic>No content</Text>;
      }
      return (
        <Paragraph
          ellipsis={{ rows: 3, expandable: true, symbol: 'Show more' }}
          style={{ margin: 0, whiteSpace: 'pre-wrap' }}
        >
          {textOnly}
        </Paragraph>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <Tag color={value ? 'green' : 'default'} icon={value ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {value ? 'Yes' : 'No'}
        </Tag>
      );
    }

    if (typeof value === 'number') {
      return <Text strong>{value.toLocaleString()}</Text>;
    }

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

  const rows = extractFieldRows(submission?.answers as JSONContent);
  const totalPoints = rows.reduce((sum, r) => sum + (r.points || 0), 0);
  const maxPoints = rows.reduce((sum, r) => sum + (r.maxPoints || 0), 0);
  const correctCount = rows.filter((r) => r.isCorrect === true).length;
  const totalQuestions = rows.length;
  const chatRef = React.useRef<HTMLDivElement>(null);

  const scrollToChat = () => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
    <Card
      size="small"
      style={{
        borderRadius: 12,
        boxShadow: token.boxShadowSecondary,
        background: token.colorBgContainer,
        borderColor: token.colorBorderSecondary,
      }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Header Section - Compact */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileTextOutlined />
              Submission Summary
            </Title>
            <Space>
              {submission?._id && user && (
                <Button
                  type="text"
                  size="small"
                  icon={<MessageOutlined />}
                  onClick={scrollToChat}
                  style={{
                    fontSize: 12,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Chat
                  <DownOutlined style={{ fontSize: 10 }} />
                </Button>
              )}
              <Tag color={getStatusColor(submission?.status)} style={{ fontSize: 11, padding: '2px 8px' }}>
                {submission?.status?.toUpperCase() || 'UNKNOWN'}
              </Tag>
            </Space>
          </div>
          <Space size={12} wrap style={{ fontSize: 12 }}>
            {submission?.updatedAt && (
              <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <ClockCircleOutlined />
                Updated: {new Date(submission.updatedAt).toLocaleString()}
              </Text>
            )}
            {submission?.fieldMetadata?.type?.submittedAt && (
              <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <CheckCircleOutlined />
                Submitted: {new Date(submission.fieldMetadata.type.submittedAt).toLocaleString()}
              </Text>
            )}
          </Space>
        </div>

        <Divider style={{ margin: '4px 0' }} />

        {/* Metadata Section - Compact */}
        <Card
          size="small"
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${token.colorFillSecondary} 0%, ${token.colorFillTertiary} 100%)`
              : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            borderRadius: 6,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
          styles={{ body: { padding: 10 } }}
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
                children: submission?.assignee?.user?.name || <Text type="secondary">Not assigned</Text>,
              },
              {
                key: 'subject',
                label: (
                  <Space size={4}>
                    <UserOutlined />
                    Subject
                  </Space>
                ),
                children: submission?.subject?.user?.name || <Text type="secondary">Not specified</Text>,
              },
              {
                key: 'location',
                label: (
                  <Space size={4}>
                    <EnvironmentOutlined />
                    Location
                  </Space>
                ),
                children: submission?.location?.address || <Text type="secondary">Not provided</Text>,
              },
            ]}
          />
        </Card>

        {/* Scoring Summary (if applicable) - Compact */}
        {(totalPoints > 0 || correctCount > 0) && (
          <Card
            size="small"
            style={{
              background: isDark
                ? `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryHover} 100%)`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 6,
              border: 'none',
              color: isDark ? token.colorTextLightSolid : 'white',
            }}
            styles={{ body: { padding: 10 } }}
          >
            <Space size={12} wrap style={{ width: '100%', justifyContent: 'space-around' }}>
              {totalPoints > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                    {totalPoints}
                    {maxPoints > 0 && ` / ${maxPoints}`}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.9 }}>Points</div>
                </div>
              )}
              {correctCount > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                    {correctCount} / {totalQuestions}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.9 }}>Correct</div>
                </div>
              )}
            </Space>
          </Card>
        )}

        {/* Answers Section */}
        <div>
          <Title level={5} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckSquareOutlined />
            Form Responses
          </Title>
          {rows.length === 0 ? (
            <Empty
              description={<Text type="secondary">No responses recorded</Text>}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '20px 0' }}
            />
          ) : (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {rows.map((r, idx) => {
                const isChoiceField = r.type === 'singleChoice' || r.type === 'multipleChoice';

                return (
                  <Card
                    key={idx}
                    size="small"
                    style={{
                      borderRadius: 6,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      transition: 'all 0.2s',
                      background: token.colorBgContainer,
                    }}
                    styles={{ body: { padding: 12 } }}
                    hoverable
                  >
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      {/* Field Label - Compact */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: token.colorPrimary, fontSize: 14 }}>
                          {getFieldIcon(r.type)}
                        </span>
                        <Text strong style={{ fontSize: 13, color: token.colorText }}>
                          {r.label || r.name || r.type || 'Untitled Field'}
                        </Text>
                        {(r.name || r.variant) && (
                          <Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>
                            ({r.name || ''}
                            {r.variant ? ` • ${r.variant}` : ''})
                          </Text>
                        )}
                        {/* Scoring Info - Inline with label */}
                        {(typeof r.points === 'number' || typeof r.isCorrect === 'boolean') && (
                          <Space size={4} style={{ marginLeft: 'auto' }}>
                            {typeof r.points === 'number' && (
                              <Tag color="purple" icon={<StarOutlined />} style={{ margin: 0, fontSize: 11 }}>
                                {r.points}
                                {typeof r.maxPoints === 'number' ? `/${r.maxPoints}` : ''}
                              </Tag>
                            )}
                            {typeof r.isCorrect === 'boolean' && (
                              <Tag
                                color={r.isCorrect ? 'success' : 'error'}
                                icon={r.isCorrect ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                                style={{ margin: 0, fontSize: 11 }}
                              >
                                {r.isCorrect ? '✓' : '✗'}
                              </Tag>
                            )}
                          </Space>
                        )}
                      </div>

                      {/* Choice Field - Show all options */}
                      {isChoiceField && r.options && r.options.length > 0 ? (
                        <div
                          style={{
                            padding: '8px 12px',
                            background: token.colorFillAlter,
                            borderRadius: 4,
                            border: `1px solid ${token.colorBorderSecondary}`,
                          }}
                        >
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            {r.options.map((opt, optIdx) => {
                              const isOtherOption = opt.value === '__other__';
                              const showOtherValue = isOtherOption && opt.selected && r.otherValue;

                              return (
                                <div key={optIdx}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '4px 8px',
                                      background: opt.selected ? token.colorPrimaryBg : 'transparent',
                                      borderRadius: 4,
                                      border: opt.selected ? `1px solid ${token.colorPrimary}` : '1px solid transparent',
                                    }}
                                  >
                                    <span style={{ fontSize: 14, color: opt.selected ? token.colorPrimary : token.colorTextSecondary, width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {r.type === 'singleChoice' ? (opt.selected ? '●' : '○') : (opt.selected ? '☑' : '☐')}
                                    </span>
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        color: opt.selected ? token.colorText : token.colorTextSecondary,
                                        fontWeight: opt.selected ? 500 : 400,
                                        flex: 1,
                                      }}
                                    >
                                      {opt.label}
                                    </Text>
                                    {(typeof opt.points === 'number' || typeof opt.isCorrect === 'boolean') && (
                                      <Space size={4}>
                                        {typeof opt.points === 'number' && (
                                          <Tag color="blue" style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
                                            {opt.points}pt
                                          </Tag>
                                        )}
                                        {typeof opt.isCorrect === 'boolean' && (
                                          <Tag
                                            color={opt.isCorrect ? 'success' : 'default'}
                                            style={{ margin: 0, fontSize: 10, padding: '0 4px' }}
                                          >
                                            {opt.isCorrect ? '✓' : '✗'}
                                          </Tag>
                                        )}
                                      </Space>
                                    )}
                                  </div>
                                  {showOtherValue && (
                                    <div
                                      style={{
                                        marginTop: 2,
                                        marginLeft: 22,
                                        padding: '4px 8px',
                                        background: token.colorFillAlter,
                                        borderRadius: 4,
                                        fontSize: 11,
                                        color: token.colorText,
                                        border: `1px solid ${token.colorBorderSecondary}`,
                                      }}
                                    >
                                      <Text style={{ fontSize: 11, color: token.colorText }}>
                                        <strong style={{ color: token.colorPrimary }}>Entered:</strong>{' '}
                                        <span style={{ color: token.colorTextSecondary }}>{r.otherValue}</span>
                                      </Text>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </Space>
                        </div>
                      ) : (
                        /* Regular Field Value */
                        <div
                          style={{
                            padding: '8px 12px',
                            background: token.colorFillAlter,
                            borderRadius: 4,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            minHeight: 32,
                          }}
                        >
                          {formatValue(r.value, r.type)}
                        </div>
                      )}
                    </Space>
                  </Card>
                );
              })}
            </Space>
          )}
        </div>
      </Space>
    </Card>

    {/* Chat Section - Separate Card */}
    {submission?._id && user && (
      <div ref={chatRef} style={{ marginTop: 16 }}>
        <SubmissionChat
          submissionId={submission._id}
          assignmentId={assignmentId || submission?.assignment?._id || submission?.assignmentId || ''}
          currentUserId={user._id}
          currentUserName={user.name || user.email || user.phone || ''}
          otherUserId={submission?.subject?.user?._id || submission?.assignee?.user?._id || 'other'}
          otherUserName={
            submission?.subject?.user?.name ||
            submission?.subject?.user?.email ||
            submission?.subject?.user?.phone ||
            submission?.assignee?.user?.name ||
            submission?.assignee?.user?.email ||
            submission?.assignee?.user?.phone ||
            'Other User'
          }
          hasApproval={formTemplate?.hasApproval}
          hasDisputes={formTemplate?.hasDisputes}
          signatureRequired={formTemplate?.signatureRequired}
          assignment={submission?.assignment}
        />
      </div>
    )}
  </>
  );
};

