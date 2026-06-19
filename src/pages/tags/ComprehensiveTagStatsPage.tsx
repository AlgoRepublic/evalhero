import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import {
  TagsOutlined,
  BarChartOutlined,
  UserOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { Tabs, Button, message, Spin, Alert } from 'antd';
import { Typography } from 'antd';
import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { TagStatsTab } from './components/TagStatsTab';
import { SubjectDeepDiveTab } from './components/SubjectDeepDiveTab';
import { generateStatsPDF } from '../../utils/pdfExport';
import type { ComprehensiveTagStatsData } from '../../services/tagsApi';
import { useGetTagQuery } from '../../services/tagsApi';
import type { Profile } from '../../features/auth/authSlice';
import { useAppSelector } from '../../hooks';

const { Text } = Typography;

const ComprehensiveTagStatsPage = () => {
  const { tagId: urlTagId } = useParams<{ tagId?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tag');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const { selectedProfile } = useAppSelector((state) => state.auth);
  const tagStatsDataRef = useRef<ComprehensiveTagStatsData | null>(null);
  const subjectStatsDataRef = useRef<ComprehensiveTagStatsData | null>(null);
  const tagDateRangeRef = useRef<{ startDate?: string; endDate?: string } | null>(null);
  const subjectDateRangeRef = useRef<{ startDate?: string; endDate?: string } | null>(null);

  // Fetch tag data to verify and get tag name
  const {
    data: tagResponse,
    isLoading: tagLoading,
    isError: tagError,
    error: tagErrorData,
    isFetching: tagFetching,
  } = useGetTagQuery(urlTagId || '', {
    skip: !urlTagId,
  });

  const tag = tagResponse?.data?.tag;
  const tagName = tag?.name;

  // Determine if we should show loading state
  const isLoading = tagLoading || tagFetching;
  
  // Determine if we should show error state
  const hasError = tagError || (urlTagId && tagResponse && !tag);
  
  // Determine if tag is missing from URL
  const isMissingTagId = !urlTagId;

  const tagFilterInfoRef = useRef<{ selectedSubjectIds: string[]; subjects: Profile[]; selectedTagId?: string } | null>(null);
  const subjectFilterInfoRef = useRef<{ selectedSubjectId?: string; subjects: Profile[] } | null>(null);

  // Callback to receive stats data from TagStatsTab
  const handleTagStatsData = useCallback((
    data: ComprehensiveTagStatsData | null, 
    dateRange?: { startDate?: string; endDate?: string },
    filterInfo?: { selectedSubjectIds: string[]; subjects: Profile[]; selectedTagId?: string }
  ) => {
    tagStatsDataRef.current = data;
    if (dateRange) {
      tagDateRangeRef.current = dateRange;
    }
    if (filterInfo) {
      tagFilterInfoRef.current = filterInfo;
    }
  }, []);

  // Callback to receive stats data from SubjectDeepDiveTab
  const handleSubjectStatsData = useCallback((
    data: ComprehensiveTagStatsData | null, 
    dateRange?: { startDate?: string; endDate?: string },
    filterInfo?: { selectedSubjectId?: string; subjects: Profile[] }
  ) => {
    subjectStatsDataRef.current = data;
    if (dateRange) {
      subjectDateRangeRef.current = dateRange;
    }
    if (filterInfo) {
      subjectFilterInfoRef.current = filterInfo;
    }
  }, []);

  const handleExportPDF = async () => {
    // Prevent PDF export if tag is not loaded or has error
    if (hasError || isLoading || !tag) {
      message.warning('Tag information is not available. Please wait for data to load.');
      return;
    }

    const currentStats = activeTab === 'tag' ? tagStatsDataRef.current : subjectStatsDataRef.current;
    const currentDateRange = activeTab === 'tag' ? tagDateRangeRef.current : subjectDateRangeRef.current;
    const currentFilterInfo = activeTab === 'tag' ? tagFilterInfoRef.current : subjectFilterInfoRef.current;

    if (!currentStats) {
      message.warning('No statistics data available. Please wait for data to load.');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const tabName = activeTab === 'tag' 
        ? 'Tag Stats (Multi-Subject)' 
        : 'Subject Deep Dive';
      
      await generateStatsPDF(currentStats, {
        title: `${tabName} - Eval Hero`,
        filename: `tag-statistics-${activeTab}-${new Date().toISOString().split('T')[0]}.pdf`,
        dateRange: currentDateRange || undefined,
        tagName: tagName || undefined,
        filterInfo: currentFilterInfo || undefined,
        organization: selectedProfile?.organization || undefined,
      });
      
      message.success('PDF generated successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      message.error(
        error instanceof Error 
          ? error.message 
          : 'Failed to generate PDF. Please try again.'
      );
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const tabItems = [
    {
      key: 'tag',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
          <TagsOutlined />
          {!isMobile && <span>Tag Stats (Multi-Subject)</span>}
          {isMobile && <span>Tag Stats</span>}
        </span>
      ),
    },
    {
      key: 'subject',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
          <UserOutlined />
          {!isMobile && <span>Subject Deep Dive</span>}
          {isMobile && <span>Subject Dive</span>}
        </span>
      ),
    },
  ];

  // Show full-page loading state
  if (isLoading && urlTagId) {
    return (
      <div 
        style={{ 
          paddingBottom: isMobile ? 16 : 24,
          paddingLeft: isMobile ? 8 : 0,
          paddingRight: isMobile ? 8 : 0,
        }}
      >
        <Helmet>
          <title>Loading Tag Statistics - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Tag Statistics"
          breadcrumbs={[
            {
              title: (
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
                  <TagsOutlined />
                  <span>Tags</span>
                </span>
              ),
              path: '/tags',
            },
            {
              title: (
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
                  <BarChartOutlined />
                  <span>Statistics</span>
                </span>
              ),
            },
          ]}
        />
        <div style={{ 
          textAlign: 'center', 
          padding: '80px 20px',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Spin size="large" />
          <div style={{ marginTop: 24 }}>
            <Text type="secondary" style={{ fontSize: 16 }}>
              Loading tag information...
            </Text>
          </div>
        </div>
      </div>
    );
  }

  // Show full-page error state
  if (hasError && urlTagId) {
    const errorMessage = (tagErrorData as { data?: { message?: string } })?.data?.message ||
      'The requested tag could not be found or you do not have permission to view it.';
    
    return (
      <div 
        style={{ 
          paddingBottom: isMobile ? 16 : 24,
          paddingLeft: isMobile ? 8 : 0,
          paddingRight: isMobile ? 8 : 0,
        }}
      >
        <Helmet>
          <title>Tag Not Found - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Tag Statistics"
          breadcrumbs={[
            {
              title: (
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
                  <TagsOutlined />
                  <span>Tags</span>
                </span>
              ),
              path: '/tags',
            },
            {
              title: (
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
                  <BarChartOutlined />
                  <span>Statistics</span>
                </span>
              ),
            },
          ]}
        />
        <Alert
          message="Tag Not Found"
          description={
            <div>
              <Text>{errorMessage}</Text>
              <div style={{ marginTop: 16 }}>
                <Button 
                  type="primary" 
                  onClick={() => navigate('/tags')}
                  style={{ marginRight: 8 }}
                >
                  Go to Tags
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            </div>
          }
          type="error"
          showIcon
          style={{ 
            marginTop: 24,
            marginBottom: 16,
          }}
        />
      </div>
    );
  }

  // Show message when tagId is missing
  if (isMissingTagId) {
    return (
      <div 
        style={{ 
          paddingBottom: isMobile ? 16 : 24,
          paddingLeft: isMobile ? 8 : 0,
          paddingRight: isMobile ? 8 : 0,
        }}
      >
        <Helmet>
          <title>Tag Statistics - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Tag Statistics"
          breadcrumbs={[
            {
              title: (
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
                  <TagsOutlined />
                  <span>Tags</span>
                </span>
              ),
              path: '/tags',
            },
            {
              title: (
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
                  <BarChartOutlined />
                  <span>Statistics</span>
                </span>
              ),
            },
          ]}
        />
        <Alert
          message="Tag ID Required"
          description={
            <div>
              <Text>Please provide a tag ID in the URL to view statistics.</Text>
              <div style={{ marginTop: 16 }}>
                <Button 
                  type="primary" 
                  onClick={() => navigate('/tags')}
                >
                  Go to Tags
                </Button>
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ 
            marginTop: 24,
            marginBottom: 16,
          }}
        />
      </div>
    );
  }

  return (
    <div 
      style={{ 
        paddingBottom: isMobile ? 16 : 24,
        paddingLeft: isMobile ? 8 : 0,
        paddingRight: isMobile ? 8 : 0,
      }}
    >
      <Helmet>
        <title>{tagName ? `${tagName} - Statistics` : 'Tag Statistics'} - Eval Hero</title>
      </Helmet>

      <PageHeader
        title={
          tagName 
            ? `Tag Statistics: ${tagName}`
            : 'Tag Statistics'
        }
        breadcrumbs={(() => {
          const breadcrumbs: Array<{ title: React.ReactNode; path?: string }> = [
            {
              title: (
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
                  <TagsOutlined />
                  <span>Tags</span>
                </span>
              ),
              path: '/tags',
            },
            {
              title: (
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
                  <BarChartOutlined />
                  <span>Statistics</span>
                </span>
              ),
            },
          ];
          
          if (tagName) {
            breadcrumbs.push({
              title: <span>{tagName}</span>,
            });
          }
          
          return breadcrumbs;
        })()}
      />
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: isMobile ? 8 : 0 }}>
        <Button
          type="primary"
          icon={<FilePdfOutlined />}
          onClick={handleExportPDF}
          loading={isGeneratingPDF}
          disabled={isGeneratingPDF || hasError || isLoading || !tag}
          size={isMobile ? 'small' : 'middle'}
          style={{
            marginTop: isMobile ? 0 : 8,
            marginLeft: isMobile ? 8 : 16,
            flexShrink: 0,
          }}
        >
          {isMobile ? 'PDF' : 'Export PDF'}
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ 
          marginTop: isMobile ? 16 : 24,
        }}
        size={isMobile ? 'small' : 'middle'}
        centered={isMobile}
        tabBarStyle={{
          marginBottom: isMobile ? 8 : 16,
        }}
      />

      <div
        id="tag-stats-content"
        style={{
          marginTop: isMobile ? 8 : 0,
          // backgroundColor: '#ffffff',
          padding: isMobile ? '8px' : '16px',
          borderRadius: '8px',
        }}
      >
        {activeTab === 'tag' && (
          <TagStatsTab 
            initialTagId={urlTagId}
            onStatsDataChange={handleTagStatsData}
          />
        )}

        {activeTab === 'subject' && (
          <SubjectDeepDiveTab 
            onStatsDataChange={handleSubjectStatsData}
          />
        )}
      </div>
    </div>
  );
};

export { ComprehensiveTagStatsPage };
