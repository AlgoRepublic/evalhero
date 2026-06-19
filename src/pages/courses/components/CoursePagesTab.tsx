import React, { useMemo } from 'react';
import {
  Button,
  Table,
  Space,
  message,
  Popconfirm,
  Typography,
  Card,
} from 'antd';
import {
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileOutlined,
} from '@ant-design/icons';
import {
  useGetCoursePagesQuery,
  useDeleteCoursePageMutation,
  useReorderCoursePagesMutation,
  useGetCourseQuery,
} from '../../../services/coursesApi';
import type { CoursePage } from '../../../types/course';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { useSelector } from 'react-redux';
import type { ColumnsType } from 'antd/es/table';
import { RootState } from '../../../store';
import { usePermission } from '../../../hooks/usePermission';
import { PATH_COURSES } from '../../../constants/routes';
import { getCoursePageDocumentIcon } from '../../../constants/coursePageDocument';

const { Title } = Typography;

function PageTypeIcon({ page }: { page: CoursePage }) {
  if (page.pageType === 'document' && page.document) {
    const icon = getCoursePageDocumentIcon(page.document.mimeType);
    const sizeMb = (page.document.size / 1024 / 1024).toFixed(2);
    const iconMap = {
      video: <VideoCameraOutlined style={{ marginRight: 6, color: '#1890ff' }} />,
      audio: <SoundOutlined style={{ marginRight: 6, color: '#52c41a' }} />,
      image: <FileImageOutlined style={{ marginRight: 6, color: '#eb2f96' }} />,
      pdf: <FilePdfOutlined style={{ marginRight: 6, color: '#ff4d4f' }} />,
      text: <FileTextOutlined style={{ marginRight: 6 }} />,
      spreadsheet: <FileTextOutlined style={{ marginRight: 6 }} />,
      presentation: <FileTextOutlined style={{ marginRight: 6 }} />,
      document: <FileTextOutlined style={{ marginRight: 6 }} />,
      file: <FileOutlined style={{ marginRight: 6 }} />,
    };
    return (
      <span>
        {iconMap[icon as keyof typeof iconMap] ?? <FileOutlined style={{ marginRight: 6 }} />}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>({sizeMb} MB)</Typography.Text>
      </span>
    );
  }
  return <FileTextOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />;
}

interface CoursePagesTabProps {
  courseId: string;
}

const CoursePagesTab: React.FC<CoursePagesTabProps> = ({ courseId }) => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery({ maxWidth: 769 });
  const isTablet = useMediaQuery({ maxWidth: 992 });
  const { data, isLoading, refetch } = useGetCoursePagesQuery(courseId);
  const { data: courseData } = useGetCourseQuery(courseId);
  const [deletePage] = useDeleteCoursePageMutation();
  const [reorderPages, { isLoading: isReordering }] =
    useReorderCoursePagesMutation();
  const { selectedProfile } = useSelector((state: RootState) => state.auth);
  const hasEditPermission = usePermission('course::edit');

  const pages = data?.data?.pages || [];
  const course = courseData?.data?.course;

  // Check if user can edit/delete pages (must be course creator and have permission)
  const canEditPages = useMemo(() => {
    return course?.createdBy === selectedProfile?._id && hasEditPermission;
  }, [course?.createdBy, selectedProfile?._id, hasEditPermission]);

  interface ApiError {
    data?: {
      message?: string;
    };
  }

  const handleDelete = async (pageId: string) => {
    try {
      await deletePage({ courseId, pageId }).unwrap();
      message.success('Page deleted successfully');
      refetch();
    } catch (err: unknown) {
      const apiError = err as ApiError;
      message.error(apiError?.data?.message || 'Failed to delete page');
    }
  };

  const handleMove = async (pageId: string, direction: 'up' | 'down') => {
    const sortedPages = [...pages].sort((a, b) => a.orderIndex - b.orderIndex);
    const currentIndex = sortedPages.findIndex((p) => p._id === pageId);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === sortedPages.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newPages = [...sortedPages];
    [newPages[currentIndex], newPages[newIndex]] = [
      newPages[newIndex],
      newPages[currentIndex],
    ];

    try {
      const pageOrders = newPages.map((page, index) => ({
        _id: page._id,
        orderIndex: index,
      }));
      await reorderPages({ courseId, pageOrders }).unwrap();
      message.success('Page moved successfully');
      refetch();
    } catch (err: unknown) {
      const apiError = err as ApiError;
      message.error(apiError?.data?.message || 'Failed to reorder pages');
    }
  };

  const columns: ColumnsType<CoursePage> = [
    {
      title: 'Order',
      dataIndex: 'orderIndex',
      key: 'orderIndex',
      width: isMobile ? 80 : 120,
      sorter: (a, b) => a.orderIndex - b.orderIndex,
      render: (orderIndex: number, record: CoursePage) => (
        <Space size="small">
          <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 500 }}>{orderIndex}</span>
          <Space size="small">
            {canEditPages && (
              <>
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  onClick={() => handleMove(record._id, 'up')}
                  disabled={orderIndex === 0 || isReordering}
                  title="Move up"
                  style={{ padding: '4px' }}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  onClick={() => handleMove(record._id, 'down')}
                  disabled={orderIndex === (pages.length - 1) || isReordering}
                  title="Move down"
                  style={{ padding: '4px' }}
                />
              </>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: isMobile ? 150 : isTablet ? '30%' : '40%',
      ellipsis: isMobile,
      render: (text: string, record: CoursePage) => (
        <span
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          onClick={() => navigate(PATH_COURSES.pageView(courseId, record._id))}
        >
          <PageTypeIcon page={record} />
          <Typography.Text strong style={{ fontSize: isMobile ? 12 : 14 }}>
            {text}
          </Typography.Text>
        </span>
      ),
    },
    {
      title: 'Inline Forms',
      key: 'inlineForms',
      width: isTablet ? 100 : 120,
      align: 'center' as const,
      responsive: ['md'],
      render: (_: unknown, record: CoursePage) => (
        <span style={{ fontSize: isTablet ? 12 : 14 }}>
          {record.inlineForms?.length || 0}
        </span>
      ),
    },
    {
      title: 'Completion Required',
      key: 'completionRequired',
      width: isTablet ? 120 : 150,
      align: 'center' as const,
      responsive: ['md'],
      render: (_: unknown, record: CoursePage) => (
        <span style={{ fontSize: isTablet ? 12 : 14 }}>
          {record.completionCriteria?.required ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 70 : 200,
      fixed: 'right' as const,
      render: (_: unknown, record: CoursePage) => (
        <Space 
          size={isMobile ? 'small' : 'middle'} 
          direction={isMobile ? 'vertical' : 'horizontal'} 
          style={{ width: '100%' }}
        >
          {canEditPages && (
            <>
              <Button
                type="primary"
                size={isMobile ? 'small' : 'middle'}
                onClick={() =>
                  navigate(PATH_COURSES.pageEdit(courseId, record._id))
                }
                style={{ width: isMobile ? '100%' : '80px' }}
              >
                Edit
              </Button>
              <Popconfirm
                title="Are you sure you want to delete this page?"
                onConfirm={() => handleDelete(record._id)}
                okText="Yes"
                cancelText="No"
              >
                <Button 
                  type="primary" 
                  danger 
                  size={isMobile ? 'small' : 'middle'}
                  style={{ width: isMobile ? '100%' : '80px' }}
                >
                  Delete
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: isMobile ? 12 : 0,
        }}>
          <Title level={4} style={{ margin: 0 }}>Course Pages/Modules</Title>
          {canEditPages && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(PATH_COURSES.pageAdd(courseId))}
              size={isMobile ? 'small' : 'middle'}
            >
              Add Page
            </Button>
          )}
        </div>
        <Table
          columns={columns}
          dataSource={[...pages].sort((a, b) => a.orderIndex - b.orderIndex)}
          rowKey="_id"
          loading={isLoading || isReordering}
          pagination={false}
          size={isMobile ? 'small' : 'middle'}
          scroll={{ 
            x: isMobile ? 'max-content' : isTablet ? 800 : 1000,
          }}
        />
      </Space>
    </Card>
  );
};

export default CoursePagesTab;
