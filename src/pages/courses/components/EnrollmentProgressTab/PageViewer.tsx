import React from 'react';
import { Card, Affix, Row, Col, Space, Typography, Button, Tag, Divider, Grid, Tooltip, Spin } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  BookOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { PageProgress } from './types';
import { PageRef } from './types';
import { GRADIENT_STYLES, PAGE_VIEWER_MIN_HEIGHT, STATUS_COLOR_MAP } from './constants';
import { ModuleStatus } from '../../../../types/course';
import type { CoursePageType, CoursePageDocument } from '../../../../types/course';
import { TemplateEditor } from '../../../../pages/CanvasBuilderPage';
import CoursePageDocumentViewer from '../CoursePageDocumentViewer';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

interface PageViewerProps {
  pageId: string;
  currentPage: PageRef;
  currentPageIndex: number;
  totalPages: number;
  currentPageProgress: PageProgress | null;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastPage?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onOpenDrawer: () => void;
  instance: any; // TiptapEditor instance (used for builder pages)
  loadingPage: boolean;
  isTrackingPage?: boolean;
  shouldShowMarkAsCompleted?: boolean;
  nextButtonText?: string;
  /** Page type: builder (rich text) or document (file). Defaults to 'builder'. */
  pageType?: CoursePageType;
  /** Document metadata + url for document-type pages. */
  document?: CoursePageDocument | null;
}

export const PageViewer: React.FC<PageViewerProps> = ({
  currentPage,
  currentPageIndex,
  totalPages,
  currentPageProgress,
  canGoBack,
  canGoNext,
  isLastPage = false,
  onPrevious,
  onNext,
  onOpenDrawer,
  instance,
  loadingPage,
  isTrackingPage = false,
  shouldShowMarkAsCompleted = false,
  nextButtonText,
  pageType = 'builder',
  document: pageDocument,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isDocumentPage = pageType === 'document' && pageDocument?.url;

  return (
  <Card
    variant="borderless"
    style={{
      borderRadius: 16,
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      marginBottom: 24,
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 300px)',
      minHeight: PAGE_VIEWER_MIN_HEIGHT,
    }}
    styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
  >
    <Affix offsetTop={isMobile ? 56 : 64}>
      <div
        style={{
          background: GRADIENT_STYLES.primary,
          padding: isMobile ? '12px 16px' : '20px 24px',
          borderRadius: '16px 16px 0 0',
          zIndex: 10,
        }}
      >
        <Row align="middle" justify="space-between" gutter={[8, 8]} wrap>
          <Col xs={24} md={{ flex: '1 1 0' }} style={{ minWidth: 0, order: 1 }}>
            <Space align="center" size={isMobile ? 8 : 12} wrap style={{ width: isMobile ? '100%' : undefined }}>
              <BookOutlined style={{ color: '#fff', fontSize: isMobile ? 18 : 20, flexShrink: 0 }} />
              <Tooltip title={currentPage.title} placement="topLeft">
                <Title
                  level={4}
                  ellipsis={{ rows: 1 }}
                  style={{
                    color: '#fff',
                    margin: 0,
                    fontWeight: 600,
                    fontSize: isMobile ? 16 : undefined,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  {currentPage.title}
                </Title>
              </Tooltip>
              {currentPageProgress && (
                <Tag
                  color={
                    (STATUS_COLOR_MAP[currentPageProgress.status as ModuleStatus] ??
                      'default') as string
                  }
                  style={{
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: 600,
                    padding: isMobile ? '2px 8px' : '4px 12px',
                    borderRadius: 6,
                    margin: 0,
                    flexShrink: 0,
                  }}
                >
                  {currentPageProgress.status.replace('-', ' ').toUpperCase()}
                </Tag>
              )}
            </Space>
          </Col>
          <Col xs={24} md={{ flex: '0 0 auto' }} style={{ order: 2 }}>
            <Space size={isMobile ? 4 : 8} wrap align="center" style={{ justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
              <Button
                type="text"
                icon={<LeftOutlined />}
                onClick={onPrevious}
                disabled={!canGoBack}
                style={{ color: '#fff' }}
                size={isMobile ? 'small' : 'middle'}
                title="Previous"
              >
                {isMobile ? null : 'Previous'}
              </Button>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: isMobile ? 12 : 14, whiteSpace: 'nowrap' }}>
                {currentPageIndex + 1} / {totalPages}
              </Text>
              <Button
                type="text"
                icon={<RightOutlined />}
                onClick={onNext}
                disabled={(canGoNext === false && !isLastPage && !shouldShowMarkAsCompleted) || isTrackingPage}
                loading={isTrackingPage}
                style={{ color: '#fff' }}
                size={isMobile ? 'small' : 'middle'}
                title={nextButtonText}
              >
                {isMobile ? null : nextButtonText}
              </Button>
              <Divider type="vertical" style={{ borderColor: 'rgba(255,255,255,0.3)', margin: isMobile ? '0 4px' : undefined }} />
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={onOpenDrawer}
                style={{ color: '#fff' }}
                title="View all pages"
                size={isMobile ? 'small' : 'middle'}
              >
                {isMobile ? null : 'Pages'}
              </Button>
            </Space>
          </Col>
        </Row>
      </div>
    </Affix>

    <div
      style={{
        padding: isMobile ? 16 : 24,
        overflowY: 'auto',
        flex: 1,
        height: '100%',
        position: 'relative',
      }}
    >
      {loadingPage ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {isTrackingPage && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: GRADIENT_STYLES.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: '0 0 16px 16px',
              }}
            >
              <Spin size="large" tip="Saving progress..." />
            </div>
          )}
          {isDocumentPage ? (
            <CoursePageDocumentViewer document={pageDocument} />
          ) : pageType === 'document' ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Text type="secondary">This document is not available to view at the moment.</Text>
            </div>
          ) : (
            <TemplateEditor instance={instance} />
          )}
        </>
      )}
    </div>
  </Card>
  );
};
