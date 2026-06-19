import { Card, Select, Button, DatePicker, Flex, Space, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

interface FilterBarProps {
  selectedTagIds: string[];
  onTagIdsChange: (ids: string[]) => void;
  dateRange: [Dayjs | null, Dayjs | null];
  onDateRangeChange: (dates: [Dayjs | null, Dayjs | null]) => void;
  onApply: () => void;
  tags: Array<{ _id: string; name: string }>;
  tagsLoading: boolean;
  isLoading: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export const FilterBar = ({
  selectedTagIds,
  onTagIdsChange,
  dateRange,
  onDateRangeChange,
  onApply,
  tags,
  tagsLoading,
  isLoading,
  onSelectAll,
  onClearAll,
}: FilterBarProps) => {
  const { token } = useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  return (
    <Card
      style={{
        marginTop: isMobile ? 16 : 24,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Flex 
        vertical={isMobile}
        align={isMobile ? 'stretch' : 'center'} 
        gap={isMobile ? 'small' : 'middle'} 
        wrap="wrap" 
        justify="space-between"
      >
        <Flex 
          vertical={isMobile}
          align={isMobile ? 'stretch' : 'center'} 
          gap={isMobile ? 'small' : 'middle'} 
          wrap="wrap" 
          style={{ flex: 1, minWidth: isMobile ? '100%' : 420 }}
        >
          <Space size={isMobile ? 'small' : 'middle'}>
            <FilterOutlined style={{ fontSize: isMobile ? 14 : 16, color: token.colorTextSecondary }} />
            <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>Filter by Tag(s):</Text>
          </Space>
          <Select
            mode="multiple"
            placeholder="Select tags (optional)"
            allowClear
            showSearch
            style={{ 
              minWidth: isMobile ? '100%' : 320, 
              maxWidth: isMobile ? '100%' : 420,
              width: isMobile ? '100%' : undefined,
            }}
            loading={tagsLoading}
            value={selectedTagIds}
            onChange={onTagIdsChange}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={tags.map((tag) => ({
              label: tag.name,
              value: tag._id,
            }))}
            size={isMobile ? 'small' : 'middle'}
          />
          <Space size="small" wrap>
            <Button onClick={onSelectAll} size={isMobile ? 'small' : 'small'}>
              Select All
            </Button>
            <Button onClick={onClearAll} size={isMobile ? 'small' : 'small'}>
              Clear
            </Button>
          </Space>
        </Flex>
        <Flex 
          vertical={isMobile}
          align={isMobile ? 'stretch' : 'center'} 
          gap={isMobile ? 'small' : 'middle'} 
          wrap="wrap"
        >
          <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Date range</Text>
          <RangePicker
            value={dateRange}
            onChange={(dates) => onDateRangeChange(dates as [Dayjs | null, Dayjs | null])}
            format="YYYY-MM-DD"
            size={isMobile ? 'small' : 'small'}
            style={{ width: isMobile ? '100%' : undefined }}
            allowClear
          />
          <Button 
            type="primary" 
            onClick={onApply} 
            loading={isLoading} 
            size={isMobile ? 'small' : 'small'}
            block={isMobile}
          >
            Apply
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
};
