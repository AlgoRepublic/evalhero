import { Card, Select, DatePicker, Flex, Space, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import { Profile, User } from '../../../../features/auth/authSlice';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

interface SubjectFilterBarProps {
  selectedSubjectId: string | undefined;
  onSubjectIdChange: (id: string | undefined) => void;
  dateRange: [Dayjs | null, Dayjs | null];
  onDateRangeChange: (dates: [Dayjs | null, Dayjs | null]) => void;
  subjects: Profile[];
  subjectsLoading: boolean;
}

export const SubjectFilterBar = ({
  selectedSubjectId,
  onSubjectIdChange,
  dateRange,
  onDateRangeChange,
  subjects,
  subjectsLoading,
}: SubjectFilterBarProps) => {
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
          style={{ flex: 1, minWidth: isMobile ? '100%' : 300 }}
        >
          <Space size={isMobile ? 'small' : 'middle'}>
            <FilterOutlined style={{ fontSize: isMobile ? 14 : 16, color: token.colorTextSecondary }} />
            <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>Subject:</Text>
          </Space>
          <Select
            placeholder="Select a subject"
            allowClear
            showSearch
            style={{ 
              minWidth: isMobile ? '100%' : 250, 
              maxWidth: isMobile ? '100%' : 400,
              width: isMobile ? '100%' : undefined,
            }}
            loading={subjectsLoading}
            value={selectedSubjectId}
            onChange={onSubjectIdChange}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={subjects.map((profile) => ({
              label: (profile.user as User)?.name || 'Unknown',
              value: profile._id,
            }))}
            size={isMobile ? 'small' : 'middle'}
          />
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
            size="small"
            style={{ width: isMobile ? '100%' : undefined }}
          />
        </Flex>
      </Flex>
    </Card>
  );
};
