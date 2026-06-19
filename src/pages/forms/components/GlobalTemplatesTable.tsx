import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { MenuProps, TableColumnsType, TablePaginationConfig } from 'antd';
import {
  Button,
  Card,
  Dropdown,
  Col,
  Grid,
  Input,
  message,
  Popconfirm,
  Row,
  Space,
  Table,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import {
  MoreOutlined,
  EyeOutlined,
  DeleteOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { FilterValue, SorterResult } from 'antd/es/table/interface';
import {
  GlobalFormTemplate,
  useListGlobalFormTemplatesQuery,
  useDeleteGlobalFormTemplateMutation,
} from '../../../services/globalFormTemplatesApi';
import { ResponsivePagination } from '../../../components/ResponsivePagination';
import { PATH_FORMS } from '../../../constants/routes';
import { setCopiedGlobalTemplate } from '../utils/copiedGlobalTemplateStorage';

const { useBreakpoint } = Grid;
const SEARCH_DEBOUNCE_MS = 500;

const GlobalTemplatesTable: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchTerm.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isFetching } = useListGlobalFormTemplatesQuery({
    page,
    perPage,
    sortBy,
    order,
    ...(debouncedSearch && { name: debouncedSearch }),
  });

  const [deleteTemplate] = useDeleteGlobalFormTemplateMutation();

  const handleCopy = useCallback(async (record: GlobalFormTemplate) => {
    try {
      const t = record;
      if (!t) {
        message.error('Could not load template to copy');
        return;
      }
      const schema = t.currentGlobalFormTemplateSchema;
      setCopiedGlobalTemplate({
        name: t.name ?? '',
        description: t.description ?? undefined,
        formSchema: schema?.formSchema,
      });
      message.success(
        'Template copied. Switch to another org and paste in Edit Global Template.'
      );
    } catch {
      message.error('Failed to copy template');
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTemplate(id).unwrap();
        message.success('Global template deleted successfully');
      } catch {
        message.error('Failed to delete global template');
      }
    },
    [deleteTemplate]
  );

  const handleTableChange = useCallback(
    (
      _pagination: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      sorter:
        | SorterResult<GlobalFormTemplate>
        | SorterResult<GlobalFormTemplate>[]
    ) => {
      if (!Array.isArray(sorter) && sorter.field && sorter.order) {
        setSortBy((sorter.field as string) ?? 'createdAt');
        setOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
      } else {
        setSortBy('createdAt');
        setOrder('asc');
      }
    },
    []
  );

  const columns: TableColumnsType<GlobalFormTemplate> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
        width: isMobile ? '70%' : '25%',
        render: (text: string) => (
          <Tooltip title={text} placement="topLeft">
            <Typography.Text
              style={{ fontSize: isMobile ? '13px' : undefined }}
              ellipsis
            >
              {text}
            </Typography.Text>
          </Tooltip>
        ),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        width: isMobile ? '30%' : '30%',
        responsive: ['md'],
        render: (text: string | null | undefined) => (
          <Tooltip title={text || '-'} placement="topLeft">
            <Typography.Text
              style={{ fontSize: isMobile ? '12px' : undefined }}
              ellipsis
            >
              {text ?? '-'}
            </Typography.Text>
          </Tooltip>
        ),
      },
      {
        title: 'Actions',
        key: 'operation',
        width: isMobile ? 'auto' : '25%',
        render: (_: unknown, record: GlobalFormTemplate) => (
          <Space
            size={isMobile ? 'small' : 'middle'}
            direction={isMobile ? 'vertical' : 'horizontal'}
            wrap={!isMobile}
          >
            <Tooltip title="Copy template to paste in another organization">
              <Button
                variant="solid"
                color="green"
                size={isMobile ? 'small' : 'middle'}
                onClick={() => handleCopy(record)}
              >
                Copy
              </Button>
            </Tooltip>
            <Button
              type="primary"
              size={isMobile ? 'small' : 'middle'}
              onClick={() =>
                navigate(`${PATH_FORMS.globalTemplates}/edit/${record._id}`)
              }
            >
              Edit
            </Button>
            <Popconfirm
              title="Are you sure you want to delete this global template?"
              onConfirm={() => handleDelete(record._id)}
            >
              <Button
                type="primary"
                danger
                size={isMobile ? 'small' : 'middle'}
              >
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [isMobile, navigate, handleDelete, handleCopy]
  );

  const total = data?.data?.metadata?.count ?? 0;
  const records = data?.data?.records ?? [];

  return (
    <div style={{ padding: isMobile ? token.paddingSM : token.paddingMD }}>
      {isMobile && (
        <div style={{ paddingBottom: 80 }}>
          {records.length === 0 && !isFetching ? (
            <Typography.Text
              type="secondary"
              style={{
                textAlign: 'center',
                display: 'block',
                padding: '40px 0',
              }}
            >
              No global templates yet
            </Typography.Text>
          ) : (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {records.map((record) => {
                const menuItems: MenuProps['items'] = [
                  {
                    key: 'copy',
                    icon: <CopyOutlined />,
                    label: 'Copy',
                    onClick: () => handleCopy(record),
                  },
                  {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    danger: true,
                    label: 'Delete',
                    onClick: () => handleDelete(record._id),
                  },
                ];

                return (
                  <Card
                    key={record._id}
                    size="small"
                    styles={{ body: { padding: 12 } }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Typography.Text
                          strong
                          ellipsis
                          style={{
                            display: 'block',
                            fontSize: 15,
                            lineHeight: '22px',
                          }}
                        >
                          {record.name}
                        </Typography.Text>
                        {record.description && (
                          <Typography.Text
                            type="secondary"
                            ellipsis
                            style={{
                              display: 'block',
                              fontSize: 13,
                              marginTop: 4,
                            }}
                          >
                            {record.description}
                          </Typography.Text>
                        )}
                      </div>
                      <Dropdown
                        menu={{ items: menuItems }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          type="text"
                          icon={<MoreOutlined />}
                          size="small"
                          style={{ flexShrink: 0 }}
                        />
                      </Dropdown>
                    </div>
                    <Button
                      type="primary"
                      block
                      icon={<EyeOutlined />}
                      onClick={() =>
                        navigate(
                          `${PATH_FORMS.globalTemplates}/edit/${record._id}`
                        )
                      }
                      style={{ marginTop: 12 }}
                    >
                      Edit
                    </Button>
                  </Card>
                );
              })}
            </Space>
          )}
        </div>
      )}
      {!isMobile && (
        <>
        <Row gutter={[12, 12]} style={{ marginBottom: token.marginMD }}>
        <Col xs={24} sm={16} md={12} lg={10} xl={8}>
          <Input
            allowClear
            placeholder="Search global templates by name"
            prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size={isMobile ? 'middle' : 'large'}
            style={{ width: '100%' }}
          />
        </Col>
      </Row>

      <Table<GlobalFormTemplate>
          scroll={{ x: true }}
          columns={columns}
          dataSource={records}
          loading={isFetching}
          rowKey="_id"
          pagination={false}
          onChange={handleTableChange}
          size="middle"
          locale={{ emptyText: 'No global templates yet' }}
          showSorterTooltip
        />
        </>
      )}
      <div style={{ marginTop: isMobile ? token.marginSM : token.marginMD }}>
        <ResponsivePagination
          page={page}
          perPage={perPage}
          total={total}
          onChange={(p, size) => {
            setPage(p);
            setPerPage(size);
          }}
          loading={isFetching}
        />
      </div>
    </div>
  );
};

export default GlobalTemplatesTable;
