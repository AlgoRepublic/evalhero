import React from 'react';
import {
  Drawer,
  Space,
  Typography,
  Button,
  Row,
  Col,
  Progress,
  Input,
  Tag,
  Empty,
  List,
  theme,
} from 'antd';
import {
  FileTextOutlined,
  CloseOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { CourseProgress, PageTableData } from './types';
import { GRADIENT_STYLES } from './constants';
import { PageListItem } from './PageListItem';

const { Title, Text } = Typography;

interface PagesDrawerProps {
  open: boolean;
  onClose: () => void;
  progress: CourseProgress;
  filteredPages: PageTableData[];
  selectedPageId: string | null;
  searchQuery: string;
  statusFilter: string | null;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string | null) => void;
  onPageClick: (pageId: string) => void;
  isLoading: boolean;
  isMobile: boolean;
  isLinearSoft?: boolean;
  isLinearStrict?: boolean;
  isSequencingEnabled?: boolean;
}

export const PagesDrawer: React.FC<PagesDrawerProps> = ({
  open,
  onClose,
  progress,
  filteredPages,
  selectedPageId,
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onPageClick,
  isLoading,
  isMobile,
  isLinearSoft = false,
  isLinearStrict = false,
  isSequencingEnabled = false,
}) => {
  const { token } = theme.useToken();

  const bodyBg = token.colorBgLayout;
  const sectionBg = token.colorBgContainer;
  const borderColor = token.colorBorder;
  const textColor = token.colorText;
  const textSecondary = token.colorTextSecondary;

  const handleClose = () => {
    onClose();
    onSearchChange('');
    onStatusFilterChange(null);
  };

  return (
    <Drawer
      title={
        <div
          style={{
            background: GRADIENT_STYLES.primary,
            margin: '0px 0px 0 -32px',
            padding: '20px 24px',
            borderRadius: '0',
          }}
        >
          <Space
            style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Space>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileTextOutlined style={{ fontSize: 20, color: '#fff' }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, fontSize: 18, color: '#fff' }}>
                  Course Pages
                </Title>
                <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 12 }}>
                  {progress?.totalPages || 0} pages total
                </Text>
              </div>
            </Space>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={handleClose}
              style={{ color: '#fff' }}
              size="small"
            />
          </Space>
        </div>
      }
      placement="right"
      onClose={handleClose}
      open={open}
      width={isMobile ? '100%' : 520}
      maskClosable
      destroyOnHidden={false}
      styles={{
        body: {
          padding: 0,
          background: bodyBg,
          overflow: 'hidden',
        },
        header: {
          padding: 0,
          border: 'none',
        },
        wrapper: {
          zIndex: 1000,
        },
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px',
            background: sectionBg,
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text strong style={{ fontSize: 14, color: textColor }}>
                    Progress
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13, color: textSecondary }}>
                    {progress?.completedPages || 0} / {progress?.totalPages || 0}
                  </Text>
                </div>
                <Progress
                  percent={progress?.completionPercentage || 0}
                  strokeColor={{
                    '0%': '#667eea',
                    '100%': '#764ba2',
                  }}
                  showInfo={false}
                  size="default"
                  style={{ marginTop: 4 }}
                />
              </Space>
            </Col>
          </Row>
        </div>

        <div
          style={{
            padding: '16px 20px',
            background: sectionBg,
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Input
              placeholder="Search pages..."
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              allowClear
              style={{
                borderRadius: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag
                style={{
                  cursor: 'pointer',
                  margin: 0,
                  padding: '4px 12px',
                  borderRadius: 6,
                }}
                color={statusFilter === null ? 'blue' : 'default'}
                onClick={() => onStatusFilterChange(null)}
              >
                All
              </Tag>
              <Tag
                style={{
                  cursor: 'pointer',
                  margin: 0,
                  padding: '4px 12px',
                  borderRadius: 6,
                }}
                color={statusFilter === 'completed' ? 'green' : 'default'}
                onClick={() => onStatusFilterChange('completed')}
              >
                Completed
              </Tag>
              <Tag
                style={{
                  cursor: 'pointer',
                  margin: 0,
                  padding: '4px 12px',
                  borderRadius: 6,
                }}
                color={statusFilter === 'in-progress' ? 'processing' : 'default'}
                onClick={() => onStatusFilterChange('in-progress')}
              >
                In Progress
              </Tag>
              <Tag
                style={{
                  cursor: 'pointer',
                  margin: 0,
                  padding: '4px 12px',
                  borderRadius: 6,
                }}
                color={statusFilter === 'not-started' ? 'default' : 'default'}
                onClick={() => onStatusFilterChange('not-started')}
              >
                Not Started
              </Tag>
            </div>
          </Space>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px',
            background: bodyBg,
          }}
        >
          {filteredPages.length === 0 ? (
            <Empty
              description={
                <Text type="secondary">
                  {searchQuery || statusFilter
                    ? 'No pages match your filters'
                    : 'No pages available'}
                </Text>
              }
              style={{ marginTop: 60 }}
            />
          ) : (
            <List
              dataSource={filteredPages}
              loading={isLoading}
              renderItem={(page) => {
                // If course is completed, all pages are clickable
                if (progress.isCourseCompleted) {
                  return (
                    <PageListItem
                      key={page.pageId}
                      page={page}
                      isSelected={page.pageId === selectedPageId}
                      onClick={() => onPageClick(page.pageId)}
                      isClickable={true}
                    />
                  );
                }

                // Determine if page is clickable based on sequencing mode
                let isClickable = true;
                if (isSequencingEnabled && isLinearStrict) {
                  // In linearStrict, only allow visiting pages if status is not 'not-started'
                  isClickable = page.status !== 'not-started';
                } else if (isSequencingEnabled && isLinearSoft) {
                  // In linearSoft, all pages are clickable
                  isClickable = true;
                } else {
                  // For other cases, use unlock status
                  isClickable = page.isUnlocked;
                }

                return (
                  <PageListItem
                    key={page.pageId}
                    page={page}
                    isSelected={page.pageId === selectedPageId}
                    onClick={() => onPageClick(page.pageId)}
                    isClickable={isClickable}
                  />
                );
              }}
            />
          )}
        </div>
      </div>
    </Drawer>
  );
};
