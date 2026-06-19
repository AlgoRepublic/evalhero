import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Row, Spin, Alert, Empty, message, Grid, Card, List, Button, Tag, Space } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { PATH_COURSES } from '../../../../constants/routes';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  useGetCourseProgressQuery,
  useGetCoursePagesQuery,
  useGetCoursePageQuery,
  useGetCourseQuery,
} from '../../../../services/coursesApi';
import { useTiptapInstance } from '../../../../hooks/useTiptapInstance';
import { extensions } from '../../../../pages/CanvasBuilderPage/Editor/extensions';
import { useCourseProgress } from '../../../../hooks/useCourseProgress';
import { StatCard } from './StatCard';
import { StartResumeBanner } from './StartResumeBanner';
import { CompletionBanner } from './CompletionBanner';
import { PageViewer } from './PageViewer';
import { PagesDrawer } from './PagesDrawer';
// import { FormSubmissions } from './FormSubmissions';
import { GRADIENT_STYLES, MIN_READ_DURATION } from './constants';
import { parseCanvasContent } from './utils';
import { PageTableData } from './types';

interface EnrollmentProgressTabProps {
  courseId: string;
  courseEnrolmentId: string;
}

const EnrollmentProgressTab: React.FC<EnrollmentProgressTabProps> = ({
  courseId,
  courseEnrolmentId,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get selected page from URL
  const urlPageId = searchParams.get('page');
  
  // Update selectedPageId when URL changes
  const [selectedPageId, setSelectedPageId] = useState<string | null>(urlPageId);
  
  // Sync state with URL when URL changes
  useEffect(() => {
    setSelectedPageId(urlPageId);
  }, [urlPageId]);

  // Helper to update page in URL
  const updatePageInUrl = useCallback((pageId: string | null) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (pageId) {
      newSearchParams.set('page', pageId);
    } else {
      newSearchParams.delete('page');
    }
    setSearchParams(newSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isTrackingPage, setIsTrackingPage] = useState(false);

  const { data, isLoading, error, refetch } = useGetCourseProgressQuery(
    {
      courseId,
      courseEnrolmentId,
    },
    {
      // Disable caching - always fetch fresh data
      refetchOnMountOrArgChange: true,
    }
  );
  const { data: pagesData } = useGetCoursePagesQuery(courseId);
  const { data: courseData } = useGetCourseQuery(courseId);
  const { trackPageRead } = useCourseProgress(courseId, courseEnrolmentId);

  const { data: pageData, isLoading: loadingPage } = useGetCoursePageQuery(
    {
      courseId,
      pageId: selectedPageId || '',
    },
    { skip: !selectedPageId }
  );

  const instance = useTiptapInstance({
    extensions,
    initialContent: '',
    mode: 'readonly',
  });

  const pageViewStartTime = useRef<number | null>(null);
  const hasMarkedAsRead = useRef(false);
  const isProcessingRead = useRef(false);
  const lastProcessedPageId = useRef<string | null>(null);
  const apiCallInitiated = useRef(false);

  const screens = Grid.useBreakpoint();
  const isMobile = screens.xs === true;

  const pages = useMemo(() => pagesData?.data?.pages || [], [pagesData?.data?.pages]);
  const progress = data?.data?.progress;
  const course = courseData?.data?.course;
  
  // Determine sequencing mode - only apply if sequencing is enabled
  const isSequencingEnabled = course?.sequencing?.enabled;
  const sequencingMode = isSequencingEnabled ? course?.sequencing?.mode : undefined;
  const isLinearSoft = isSequencingEnabled && sequencingMode === 'linearSoft';
  const isLinearStrict = isSequencingEnabled && sequencingMode === 'linearStrict';
  const isStrictMode = isSequencingEnabled && course?.sequencing?.strict;

  const currentPageIndex = useMemo(() => {
    if (!selectedPageId || !pages.length) return -1;
    return pages.findIndex((p) => p._id === selectedPageId);
  }, [selectedPageId, pages]);

  const currentPageProgress = useMemo(() => {
    if (!selectedPageId || !progress) return null;
    return progress.pages.find((p) => p.pageId === selectedPageId) || null;
  }, [selectedPageId, progress]);

  const firstUnreadPage = useMemo(() => {
    if (!progress) return null;
    
    // Find the first page that is:
    // 1. Unlocked
    // 2. Not read (or in-progress but not completed)
    // 3. Ordered by orderIndex
    const sortedPages = [...progress.pages].sort((a, b) => a.orderIndex - b.orderIndex);
    
    // If no pages completed, find first unlocked unread page
    if (progress.completedPages === 0) {
      return (
        sortedPages.find((p) => p.isUnlocked && !p.isRead && p.status !== 'passed') ||
        sortedPages.find((p) => p.isUnlocked && p.status === 'in-progress') ||
        sortedPages.find((p) => p.orderIndex === 0) ||
        null
      );
    }
    
    // Otherwise, find first unread page (regardless of unlock status for resume)
    return (
      sortedPages.find((p) => !p.isRead && p.status !== 'passed') ||
      sortedPages.find((p) => p.status === 'in-progress') ||
      null
    );
  }, [progress]);

  const hasStartedCourse = useMemo(() => {
    if (!progress) return false;
    // Course is started if:
    // 1. Any pages are completed
    // 2. Any pages are read
    // 3. Any pages have been started (have startedAt)
    // 4. Any pages are in-progress
    return (
      progress.completedPages > 0 ||
      progress.pages.some((p) => p.isRead) ||
      progress.pages.some((p) => p.startedAt !== null) ||
      progress.pages.some((p) => p.status === 'in-progress' || p.status === 'passed')
    );
  }, [progress]);

  const handleStartOrResumeClick = useCallback(() => {
    if (!progress) return;

    if (progress.completedPages === 0) {
      const firstPage =
        progress.pages.find((p) => p.orderIndex === 0) || progress.pages[0];
      if (firstPage) {
        updatePageInUrl(firstPage.pageId);
        hasMarkedAsRead.current = false;
        return;
      }
    }

    if (firstUnreadPage) {
      updatePageInUrl(firstUnreadPage.pageId);
      hasMarkedAsRead.current = false;
    }
  }, [progress, firstUnreadPage, updatePageInUrl]);


  const handleViewFirstPage = useCallback(() => {
    if (!progress || progress.pages.length === 0) return;
    const sorted = [...progress.pages].sort((a, b) => a.orderIndex - b.orderIndex);
    const firstPage = sorted[0];
    if (firstPage) {
      updatePageInUrl(firstPage.pageId);
      hasMarkedAsRead.current = false;
    }
  }, [progress, updatePageInUrl]);

  // Track page view time and mark as read
  // Always update pages with status "not-started" to "in-progress" when visited, regardless of sequencing mode
  useEffect(() => {
    if (!selectedPageId) return;

    // Reset flags when page changes
    if (lastProcessedPageId.current !== selectedPageId) {
      hasMarkedAsRead.current = false;
      isProcessingRead.current = false;
      apiCallInitiated.current = false;
      lastProcessedPageId.current = selectedPageId;
      pageViewStartTime.current = null;
    }

    // If we've already processed this page or are currently processing, don't process again
    if (hasMarkedAsRead.current || isProcessingRead.current || apiCallInitiated.current) return;

    const pageProgress = progress?.pages.find((p) => p.pageId === selectedPageId);
    
    // If page is already in-progress or completed, mark as read (no API call needed)
    if (pageProgress?.status !== 'not-started') {
      hasMarkedAsRead.current = true;
      return;
    }

    // Always mark not-started pages as in-progress when visited, regardless of sequencing mode
    pageViewStartTime.current = Date.now();
    apiCallInitiated.current = true;
    isProcessingRead.current = true;
    
    const markAsInProgress = async () => {
      try {
        setIsTrackingPage(true);
        const readDuration = Math.max(
          MIN_READ_DURATION,
          Math.floor(
            (Date.now() - (pageViewStartTime.current || Date.now())) / 1000
          )
        );

        await trackPageRead(selectedPageId, readDuration, 'in-progress');
        hasMarkedAsRead.current = true;
        await refetch();
      } catch (error) {
        console.error('Failed to mark page as in-progress:', error);
        // Reset flags on error so it can retry if needed
        apiCallInitiated.current = false;
        isProcessingRead.current = false;
      } finally {
        setIsTrackingPage(false);
        isProcessingRead.current = false;
      }
    };

    // Mark as in-progress immediately (for all modes)
    markAsInProgress();
    
    return () => {
      // Cleanup: don't reset flags here as we want to prevent duplicate calls
    };
    // We intentionally don't include progress in dependencies to prevent duplicate API calls
    // when progress updates after refetch. The guards (hasMarkedAsRead, isProcessingRead, apiCallInitiated)
    // ensure we only process each page once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId, trackPageRead, refetch]);

  // Load page content (builder pages only; document pages use CoursePageDocumentViewer)
  useEffect(() => {
    const page = pageData?.data?.page;
    if (!page || page.pageType === 'document') return;
    if (page.canvasDocId) {
      const content = parseCanvasContent(page.canvasDocId);
      if (content) {
        instance.setJSON(content);
      }
    }
  }, [pageData, instance]);

  const tableData = useMemo((): PageTableData[] => {
    if (!progress) return [];
    return progress.pages
      .map((page) => ({
        key: page.pageId,
        pageId: page.pageId,
        title: page.title,
        order: page.orderIndex,
        status: page.status,
        isUnlocked: page.isUnlocked,
        isRead: page.isRead,
        timeOnTask: page.timeOnTask,
        inlineForms: page.inlineForms,
      }))
      .sort((a, b) => a.order - b.order);
  }, [progress]);

  const filteredTableData = useMemo(() => {
    let filtered = tableData;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((page) => page.title.toLowerCase().includes(query));
    }

    if (statusFilter) {
      filtered = filtered.filter((page) => page.status === statusFilter);
    }

    return filtered;
  }, [tableData, searchQuery, statusFilter]);

  // Calculate navigation state - must be before early returns
  const canGoBack = useMemo(() => currentPageIndex > 0, [currentPageIndex]);
  const canGoNext = useMemo(
    () => currentPageIndex >= 0 && currentPageIndex < pages.length - 1,
    [currentPageIndex, pages.length]
  );
  const isLastPage = useMemo(
    () => currentPageIndex >= 0 && currentPageIndex === pages.length - 1,
    [currentPageIndex, pages.length]
  );
  const nextDisabled = useMemo(
    () => {
      // If course is completed, allow free navigation
      if (progress?.isCourseCompleted) {
        return !canGoNext;
      }
      // Don't disable on last page - allow tracking progress
      if (isLastPage) return false;
      // In linearSoft mode (only if sequencing is enabled), allow navigation to any page (preview next, submit locked)
      if (isLinearSoft) return !canGoNext;
      // For linearStrict (only if sequencing is enabled), disable if can't go next or current page is locked
      if (isLinearStrict) {
        return !canGoNext || !!(currentPageProgress && !currentPageProgress.isUnlocked);
      }
      // If sequencing is disabled, allow free navigation
      return !canGoNext;
    },
    [canGoNext, currentPageProgress, isLastPage, isLinearSoft, isLinearStrict, progress]
  );
  
  // Determine if we need to show "Mark as Completed" button and what action to take
  const getNextButtonConfig = useMemo(() => {
    if (!currentPageProgress) {
      return { showMarkAsCompleted: false, buttonText: 'Next' };
    }

    // Only show "Mark as Completed" if current page status is 'in-progress'
    if (currentPageProgress.status !== 'in-progress') {
      return { showMarkAsCompleted: false, buttonText: isLastPage ? 'Complete' : 'Next' };
    }

    // When sequencing is disabled: show "Mark as Completed" for any in-progress page
    if (!isSequencingEnabled) {
      return { showMarkAsCompleted: true, buttonText: 'Mark as Completed' };
    }

    // linearStrict mode: show "Mark as Completed" for in-progress pages
    if (isLinearStrict) {
      return { showMarkAsCompleted: true, buttonText: 'Mark as Completed' };
    }

    // linearSoft mode
    if (isLinearSoft) {
      // If strict is true, only show if current page is the first in-progress page
      if (isStrictMode) {
        const sortedPages = [...(progress?.pages || [])].sort((a, b) => a.orderIndex - b.orderIndex);
        const firstInProgressIndex = sortedPages.findIndex((p) => p.status === 'in-progress');
        const currentPageIndexInSorted = sortedPages.findIndex((p) => p.pageId === selectedPageId);
        
        if (firstInProgressIndex === currentPageIndexInSorted && firstInProgressIndex !== -1) {
          return { showMarkAsCompleted: true, buttonText: 'Mark as Completed' };
        }
        return { showMarkAsCompleted: false, buttonText: 'Next' };
      }
      
      // If strict is false, show "Mark as Completed" for any in-progress page
      return { showMarkAsCompleted: true, buttonText: 'Mark as Completed' };
    }

    return { showMarkAsCompleted: false, buttonText: isLastPage ? 'Complete' : 'Next' };
  }, [
    isSequencingEnabled,
    isLinearStrict,
    isLinearSoft,
    isStrictMode,
    currentPageProgress,
    progress,
    selectedPageId,
    isLastPage,
  ]);

  const shouldShowMarkAsCompleted = getNextButtonConfig.showMarkAsCompleted;

  // All useCallback hooks must be before early returns
  const handlePreviousPage = useCallback(() => {
    if (canGoBack && pages.length > 0 && currentPageIndex > 0) {
      const prevPage = pages[currentPageIndex - 1];
      if (prevPage) {
        updatePageInUrl(prevPage._id);
        hasMarkedAsRead.current = false;
      }
    }
  }, [canGoBack, currentPageIndex, pages, updatePageInUrl]);

  const handleNextPage = useCallback(async () => {
    if (!pages.length) return;
    
    const isLastPage = currentPageIndex >= 0 && currentPageIndex === pages.length - 1;
    
    // Only call API if current page status is 'in-progress'
    if (!selectedPageId || !currentPageProgress || currentPageProgress.status !== 'in-progress') {
      // Just navigate without calling API
      if (!isLastPage && canGoNext) {
        const nextPage = pages[currentPageIndex + 1];
        if (nextPage) {
          updatePageInUrl(nextPage._id);
          hasMarkedAsRead.current = false;
          pageViewStartTime.current = null;
        }
      } else if (isLastPage) {
        message.success('You have reached the end of the course!');
      }
      return;
    }

    // Determine if we should call API to mark as completed
    let shouldCallApi = false;

    // When sequencing is disabled: always call API for in-progress pages
    if (!isSequencingEnabled) {
      shouldCallApi = true;
    } else if (isLinearStrict) {
      // linearStrict: always call API for in-progress pages
      shouldCallApi = true;
    } else if (isLinearSoft) {
      if (isStrictMode) {
        // linearSoft + strict=true: only call if current page is first in-progress page
        const sortedPages = [...(progress?.pages || [])].sort((a, b) => a.orderIndex - b.orderIndex);
        const firstInProgressIndex = sortedPages.findIndex((p) => p.status === 'in-progress');
        const currentPageIndexInSorted = sortedPages.findIndex((p) => p.pageId === selectedPageId);
        shouldCallApi = firstInProgressIndex === currentPageIndexInSorted && firstInProgressIndex !== -1;
      } else {
        // linearSoft + strict=false: always call API for in-progress pages
        shouldCallApi = true;
      }
    }

    // Call API to mark as completed if needed
    if (shouldCallApi) {
      try {
        setIsTrackingPage(true);
        // Calculate time spent on current page
        const timeSpent = pageViewStartTime.current
          ? Math.max(
              MIN_READ_DURATION,
              Math.floor((Date.now() - pageViewStartTime.current) / 1000)
            )
          : MIN_READ_DURATION;

        // Mark as completed (call read API without status parameter to mark as completed)
        await trackPageRead(selectedPageId, timeSpent);
        hasMarkedAsRead.current = true;
        await refetch(); // Refresh progress data
      } catch (error) {
        console.error('Failed to mark page as completed:', error);
      } finally {
        setIsTrackingPage(false);
      }
    }

    // Navigate to next page if available
    if (!isLastPage && canGoNext) {
      const nextPage = pages[currentPageIndex + 1];
      if (nextPage) {
        updatePageInUrl(nextPage._id);
        hasMarkedAsRead.current = false;
        pageViewStartTime.current = null;
      }
    } else if (isLastPage) {
      message.success('You have reached the end of the course!');
    }
  }, [
    canGoNext,
    currentPageIndex,
    pages,
    updatePageInUrl,
    selectedPageId,
    currentPageProgress,
    trackPageRead,
    refetch,
    isSequencingEnabled,
    isLinearStrict,
    isLinearSoft,
    isStrictMode,
    progress,
  ]);

  const handlePageClick = useCallback(
    (pageId: string) => {
      if (!progress) return;
      const pageProgress = progress.pages.find((p) => p.pageId === pageId);
      
      if (!pageProgress) return;

      // If course is completed, allow viewing any page
      if (progress.isCourseCompleted) {
        updatePageInUrl(pageId);
        hasMarkedAsRead.current = false;
        setDrawerOpen(false);
        return;
      }

      // In linearSoft mode (only if sequencing is enabled), allow visiting any page
      if (isSequencingEnabled && isLinearSoft) {
        // Allow visiting any page in linearSoft mode
        updatePageInUrl(pageId);
        hasMarkedAsRead.current = false;
        setDrawerOpen(false);
        return;
      }

      // In linearStrict mode (only if sequencing is enabled), only allow visiting pages if status is not 'not-started'
      if (isSequencingEnabled && isLinearStrict) {
        if (pageProgress.status === 'not-started') {
          message.warning('This page is not started. Complete previous pages to access it.');
          return;
        }
        updatePageInUrl(pageId);
        hasMarkedAsRead.current = false;
        setDrawerOpen(false);
        return;
      }

      // For other cases (sequencing disabled), check unlock status
      if (!pageProgress.isUnlocked) {
        message.warning('This page is locked. Complete previous pages to unlock it.');
        return;
      }

      updatePageInUrl(pageId);
      hasMarkedAsRead.current = false;
      setDrawerOpen(false);
    },
    [progress, updatePageInUrl, isSequencingEnabled, isLinearSoft, isLinearStrict]
  );

  const totalTimeSpent = useMemo(
    () => (progress?.pages || []).reduce((sum, page) => sum + page.readDuration, 0),
    [progress?.pages]
  );

  const currentPage = useMemo(
    () => pages.find((p) => p._id === selectedPageId),
    [pages, selectedPageId]
  );

  // Early returns after all hooks
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load progress"
        description={
          (error as { data?: { message?: string } })?.data?.message ||
          'Please try again later'
        }
      />
    );
  }

  if (!progress) {
    return <Empty description="No progress data available" />;
  }


  return (
    <div style={{ width: '100%' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <StatCard
          title="Completion"
          value={progress.completionPercentage}
          suffix="%"
          prefix={<TrophyOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />}
          gradient={GRADIENT_STYLES.primary}
          progress={progress.completionPercentage}
        />
        <StatCard
          title="Pages Completed"
          value={progress.completedPages}
          suffix={`/ ${progress.totalPages}`}
          prefix={<CheckCircleOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />}
          gradient={GRADIENT_STYLES.pages}
        />
        <StatCard
          title="Time Spent"
          value={Math.floor(totalTimeSpent / 60)}
          suffix="min"
          prefix={<ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />}
          gradient={GRADIENT_STYLES.time}
        />
        <StatCard
          title="Status"
          value={progress.isCourseCompleted ? 'Completed' : 'In Progress'}
          prefix={
            progress.isCourseCompleted ? (
              <CheckCircleOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />
            ) : (
              <ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />
            )
          }
          gradient={
            progress.isCourseCompleted
              ? GRADIENT_STYLES.completion
              : GRADIENT_STYLES.inProgress
          }
        />
      </Row>

      {!selectedPageId && progress && progress.pages.length > 0 && (
        <>
          {!progress.isCourseCompleted && (
            <StartResumeBanner
              hasStarted={hasStartedCourse}
              firstUnreadPage={firstUnreadPage}
              progress={progress}
              onView={handleStartOrResumeClick}
              isMobile={isMobile}
            />
          )}
          {progress.isCourseCompleted && (
            <CompletionBanner
              progress={progress}
              onView={handleViewFirstPage}
              onReviewPages={() => setDrawerOpen(true)}
              isMobile={isMobile}
            />
          )}
        </>
      )}

      {selectedPageId && currentPage && (
        <>
          <PageViewer
            pageId={selectedPageId}
            currentPage={currentPage}
            currentPageIndex={currentPageIndex}
            totalPages={pages.length}
            currentPageProgress={currentPageProgress}
            canGoBack={canGoBack}
            canGoNext={!nextDisabled}
            isLastPage={isLastPage}
            onPrevious={handlePreviousPage}
            onNext={handleNextPage}
            onOpenDrawer={() => setDrawerOpen(true)}
            instance={instance}
            loadingPage={loadingPage}
            isTrackingPage={isTrackingPage}
            shouldShowMarkAsCompleted={shouldShowMarkAsCompleted}
            nextButtonText={getNextButtonConfig.buttonText}
            pageType={pageData?.data?.page?.pageType ?? 'builder'}
            document={pageData?.data?.page?.document ?? null}
          />

          {pageData?.data?.page?.inlineForms && pageData.data.page.inlineForms.length > 0 && (
            <Card title="Inline forms" style={{ marginTop: 24 }}>
              <List
                dataSource={pageData.data.page.inlineForms}
                renderItem={(block) => {
                  const formProgress = currentPageProgress?.inlineForms?.find(
                    (f: { formBlockId: string }) => f.formBlockId === block.formBlockId
                  );
                  const isFilled = formProgress?.isFilled === true;
                  const formUrl = PATH_COURSES.enrollmentProgressForm(
                    courseEnrolmentId,
                    selectedPageId,
                    block.formBlockId,
                    courseId
                  );

                  const formTemplate = block.formTemplate;
                  const formTemplateName =
                    typeof formTemplate === 'object' && formTemplate?.name
                      ? formTemplate.name
                      : typeof formTemplate === 'string'
                        ? formTemplate
                        : (formTemplate as { _id?: string })?._id ?? block.formBlockId;
                  const buttonSize = isMobile ? 'small' : 'large';
                  return (
                    <List.Item
                      actions={[
                        <div
                          key="actions"
                          style={{
                            display: 'flex',
                            gap: 8,
                            width: isMobile ? '100%' : 'auto',
                          }}
                        >
                          <Button
                            onClick={() => refetch()}
                            size={buttonSize}
                            variant="solid"
                            color="purple"
                            style={{ width: isMobile ? '100%' : '80px' }}
                          >
                            Refresh
                          </Button>
                          <Button
                            type="primary"
                            onClick={() => window.open(formUrl, '_blank')}
                            size={buttonSize}
                            style={{ width: isMobile ? '100%' : '80px' }}
                          >
                            {isFilled ? 'View' : 'Submit'}
                          </Button>
                        </div>,
                      ]}
                    >
                      <List.Item.Meta
                        title={formTemplateName}
                        description={
                          <Space>
                            <Tag color={isFilled ? 'success' : 'default'}>
                              {isFilled ? 'Filled' : 'Not filled'}
                            </Tag>
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </Card>
          )}
        </>
      )}

      <PagesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        progress={progress}
        filteredPages={filteredTableData}
        selectedPageId={selectedPageId}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onPageClick={handlePageClick}
        isLoading={isLoading}
        isMobile={isMobile}
        isLinearSoft={isLinearSoft}
        isLinearStrict={isLinearStrict}
        isSequencingEnabled={isSequencingEnabled}
      />

      {/* <FormSubmissions pages={progress.pages} /> */}
    </div>
  );
};

export { EnrollmentProgressTab };
export default EnrollmentProgressTab;
