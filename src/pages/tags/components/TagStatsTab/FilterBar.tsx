import { Card, Select, Button, DatePicker, Flex, Space, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import { Profile, User } from '../../../../features/auth/authSlice';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

interface FilterBarProps {
  selectedSubjectIds: string[];
  onSubjectIdsChange: (ids: string[]) => void;
  dateRange: [Dayjs | null, Dayjs | null];
  onDateRangeChange: (dates: [Dayjs | null, Dayjs | null]) => void;
  onApply: () => void;
  subjects: Profile[];
  subjectsLoading: boolean;
  isLoading: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export const FilterBar = ({
  selectedSubjectIds,
  onSubjectIdsChange,
  dateRange,
  onDateRangeChange,
  onApply,
  subjects,
  subjectsLoading,
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
            <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>Filter by Subject(s):</Text>
          </Space>
          <Select
            mode="multiple"
            placeholder="Select subjects"
            allowClear
            showSearch
            style={{ 
              minWidth: isMobile ? '100%' : 320, 
              maxWidth: isMobile ? '100%' : 420,
              width: isMobile ? '100%' : undefined,
            }}
            loading={subjectsLoading}
            value={selectedSubjectIds}
            onChange={onSubjectIdsChange}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={subjects.map((profile) => ({
              label: (profile.user as User)?.name || 'Unknown',
              value: profile._id,
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
