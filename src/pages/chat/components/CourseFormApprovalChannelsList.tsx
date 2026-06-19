/**
 * Channel list for course_form_question_approval (course inline form) approval tab.
 * Uses course_form_question_approval socket/API types only.
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Typography, theme, Empty, Collapse, Tag } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Channel } from '../types';
import {
  type CourseFormApprovalChannelRecord,
  transformCourseFormApprovalChannelToChannel,
} from '../../../services/queueApi';

const { Panel } = Collapse;
const { Text } = Typography;

export interface CourseFormApprovalChannelsListProps {
  records: CourseFormApprovalChannelRecord[];
  onChannelSelect: (channel: Channel) => void;
  selectedChannelId?: string | null;
}

export const CourseFormApprovalChannelsList: React.FC<CourseFormApprovalChannelsListProps> = ({
  records,
  onChannelSelect,
  selectedChannelId,
}) => {
  const { token } = theme.useToken();
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set());

  const recordsWithChannels = useMemo(() => {
    if (!records?.length) return [];
    return records.map((record, index) => {
      const enrolleeName = record.courseEnrolment?.enrollee?.user?.name ?? 'Enrollee';
      const courseTitle = record.course?.title ?? 'Course';
      const pageTitle = record.coursePage?.title ?? 'Page';
      const formName =
        courseTitle && pageTitle ? `${courseTitle} · ${pageTitle}` : courseTitle || pageTitle || 'Course form';
      const channels: Channel[] = [];
      if (record.channels?.length) {
        record.channels.forEach((channelItem) => {
          try {
            channels.push(transformCourseFormApprovalChannelToChannel(channelItem, record));
          } catch (error) {
            console.error('[CourseFormApprovalChannelsList] Error transforming channel:', error, channelItem);
          }
        });
      }
      return {
        assigneeName: enrolleeName,
        formName,
        channels,
        panelKey: `${record.courseEnrolmentId}-${record.formBlockId}-${index}`,
      };
    });
  }, [records]);

  useEffect(() => {
    if (recordsWithChannels.length > 0 && openPanels.size === 0) {
      setOpenPanels(new Set([recordsWithChannels[0].panelKey]));
    }
  }, [recordsWithChannels.length, openPanels.size]);

  const handlePanelChange = useCallback((keys: string | string[]) => {
    setOpenPanels(new Set(Array.isArray(keys) ? keys : [keys]));
  }, []);

  if (recordsWithChannels.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Empty description="No course approval records" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      <Collapse activeKey={Array.from(openPanels)} onChange={handlePanelChange} ghost style={{ background: 'transparent' }}>
        {recordsWithChannels.map((item) => (
          <Panel
            key={item.panelKey}
            header={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                {/* <UserOutlined style={{ color: token.colorPrimary, fontSize: '14px' }} /> */}
                <Text strong style={{ fontSize: '14px', color: token.colorText }}>
                  {item.formName} · {item.assigneeName} ({item.channels.length})
                </Text>
              </div>
            }
            style={{
              marginBottom: '8px',
              background: token.colorBgContainer,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorder}`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {item.channels.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', color: token.colorTextSecondary, fontSize: '12px' }}>
                  No channels available
                </div>
              ) : (
                item.channels.map((channel) => {
                  const isSelected = selectedChannelId === channel.id;
                  return (
                    <div
                      key={channel.id}
                      onClick={() => onChannelSelect(channel)}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? token.colorPrimaryBg : 'transparent',
                        borderRadius: token.borderRadius,
                        border: `1px solid ${isSelected ? token.colorPrimaryBorder : 'transparent'}`,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* <MessageOutlined
                        style={{
                          color: isSelected ? token.colorPrimary : token.colorTextSecondary,
                          fontSize: '16px',
                          marginTop: '2px',
                          flexShrink: 0,
                        }}
                      /> */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <Text
                            strong={isSelected}
                            style={{
                              fontSize: '13px',
                              color: isSelected ? token.colorPrimary : token.colorText,
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                            }}
                          >
                            {channel.friendlyTitle || channel.name}
                          </Text>
                          {channel.questionApprovalStatus && (
                            <Tag
                              icon={
                                channel.questionApprovalStatus === 'approved' ? (
                                  <CheckCircleOutlined />
                                ) : channel.questionApprovalStatus === 'rejected' ? (
                                  <CloseCircleOutlined />
                                ) : channel.questionApprovalStatus === 'requested' ? (
                                  <ClockCircleOutlined />
                                ) : null
                              }
                              color={
                                channel.questionApprovalStatus === 'approved'
                                  ? 'success'
                                  : channel.questionApprovalStatus === 'rejected'
                                    ? 'error'
                                    : channel.questionApprovalStatus === 'requested'
                                      ? 'processing'
                                      : 'default'
                              }
                              style={{ margin: 0, flexShrink: 0, fontSize: '10px', padding: '2px 6px', lineHeight: '16px' }}
                            >
                              {channel.questionApprovalStatus.charAt(0).toUpperCase() + channel.questionApprovalStatus.slice(1)}
                            </Tag>
                          )}
                        </div>
                        {/* {channel.questionInfo && (
                          <Text type="secondary" style={{ fontSize: '11px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {channel.questionInfo}
                          </Text>
                        )} */}
                        {channel.subjectNames && (
                          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Subjects: {channel.subjectNames}
                          </Text>
                        )}
                        {channel.lastActivityAt && (
                          <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginTop: '2px' }}>
                            {new Date(channel.lastActivityAt).toLocaleDateString()}
                          </Text>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
        ))}
      </Collapse>
    </div>
  );
};
