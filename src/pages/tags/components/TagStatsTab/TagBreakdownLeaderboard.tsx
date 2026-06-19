import { Card, Table, Typography, Select, Space, Button } from 'antd';
import { TagsOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import { TagBreakdown, TagLeaderboardItem } from '../../../../services/tagsApi';
import { Profile, User } from '../../../../features/auth/authSlice';
import { Dayjs } from 'dayjs';
import { theme } from 'antd';
import { useState } from 'react';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { useToken } = theme;

interface TagBreakdownLeaderboardProps {
  tagBreakdown: TagBreakdown[];
  tagLeaderboard: TagLeaderboardItem[] | null;
  dateRange: [Dayjs | null, Dayjs | null];
  selectedTagId: string | undefined;
  subjects: Profile[];
}

export const TagBreakdownLeaderboard = ({
  tagBreakdown,
  tagLeaderboard,
  // dateRange,
  // selectedTagId,
  subjects,
}: TagBreakdownLeaderboardProps) => {
  const { token } = useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const [selectedBreakdownTagId, setSelectedBreakdownTagId] = useState<string | undefined>(undefined);
  const [leaderboardMetric, setLeaderboardMetric] = useState<'pointsPct' | 'passRate' | 'relSubs' | 'momentum'>('pointsPct');

  // Prepare tag breakdown table data
  const tagBreakdownData = tagBreakdown.map((tag) => ({
    key: tag.tagId,
    tagName: tag.tagName,
    relevantSubmissions: tag.relevantSubmissions,
    pointsPct: tag.pointsPct,
    passPct: tag.passPct,
  }));

  // Prepare leaderboard table data
  const leaderboardData = tagLeaderboard?.map((item, index) => {
    const subject = subjects.find((s) => s._id === item.subjectId);
    return {
      key: item.subjectId,
      rank: index + 1,
      subjectName: (subject?.user as User)?.name || 'Unknown',
      relSubs: item.relSubs,
      pointsPct: item.pointsPct,
      passPct: item.passPct,
      momentum: item.momentum,
    };
  }) || [];

  // Get selected tag data from tagBreakdown
  const selectedTagData = selectedBreakdownTagId
    ? tagBreakdownData.find((tag) => tag.key === selectedBreakdownTagId)
    : undefined;

  // Use existing tagLeaderboard if it matches the selected breakdown tag
  // const filteredLeaderboardData = 
  //   selectedBreakdownTagId && tagLeaderboard
  //     ? leaderboardData
  //     : [];

  // Leaderboard chart data
  const getLeaderboardChartData = () => {
    
    if (selectedTagData) {
      return [{
        tag: selectedTagData.tagName,
        value: leaderboardMetric === 'pointsPct' 
          ? selectedTagData.pointsPct
          : leaderboardMetric === 'passRate'
          ? selectedTagData.passPct
          : leaderboardMetric === 'relSubs'
          ? selectedTagData.relevantSubmissions
          : 0,
      }];
    }
    
    return [];
  };

  console.log("getLeaderboardChartData()", getLeaderboardChartData())

  const leaderboardChartConfig = {
    data: getLeaderboardChartData(),
    xField: 'tag',
    yField: 'value',
    color: token.colorPrimary,
  };

  const tagBreakdownColumns = [
    {
      title: 'Tag',
      dataIndex: 'tagName',
      key: 'tagName',
      width: isMobile ? 100 : undefined,
      render: (text: string, record: typeof tagBreakdownData[0]) => (
        <Button
          type={selectedBreakdownTagId === record.key ? 'primary' : 'link'}
          onClick={() => setSelectedBreakdownTagId(record.key)}
          style={{ padding: isMobile ? 2 : 4, height: 'auto', fontSize: isMobile ? 12 : 14 }}
        >
          {isMobile && text.length > 15 ? `${text.substring(0, 15)}...` : text}
        </Button>
      ),
    },
    {
      title: isMobile ? 'Subs' : 'Rel. Subs',
      dataIndex: 'relevantSubmissions',
      key: 'relevantSubmissions',
      align: 'right' as const,
      width: isMobile ? 60 : undefined,
      render: (value: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>{value}</Text>,
    },
    {
      title: isMobile ? 'Pts%' : 'Points %',
      dataIndex: 'pointsPct',
      key: 'pointsPct',
      align: 'right' as const,
      width: isMobile ? 70 : undefined,
      render: (value: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>{value.toFixed(1)}%</Text>
      ),
    },
    {
      title: isMobile ? 'P%' : 'Pass %',
      dataIndex: 'passPct',
      key: 'passPct',
      align: 'right' as const,
      width: isMobile ? 60 : undefined,
      render: (value: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>{value.toFixed(1)}%</Text>
      ),
    },
  ];

  const leaderboardColumns = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: isMobile ? 40 : 60,
      render: (value: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>{value}</Text>,
    },
    {
      title: 'Subject',
      dataIndex: 'subjectName',
      key: 'subjectName',
      width: isMobile ? 100 : undefined,
      ellipsis: isMobile,
      render: (text: string) => (
        <Text style={{ fontSize: isMobile ? 12 : 14 }}>
          {isMobile && text.length > 12 ? `${text.substring(0, 12)}...` : text}
        </Text>
      ),
    },
    {
      title: isMobile ? 'Subs' : 'Rel Subs',
      dataIndex: 'relSubs',
      key: 'relSubs',
      align: 'right' as const,
      width: isMobile ? 50 : undefined,
      render: (value: number) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>{value}</Text>,
    },
    {
      title: isMobile ? 'Pts%' : 'Points %',
      dataIndex: 'pointsPct',
      key: 'pointsPct',
      align: 'right' as const,
      width: isMobile ? 60 : undefined,
      render: (value: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>{value.toFixed(1)}%</Text>
      ),
    },
    {
      title: isMobile ? 'P%' : 'Pass %',
      dataIndex: 'passPct',
      key: 'passPct',
      align: 'right' as const,
      width: isMobile ? 50 : undefined,
      render: (value: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>{value.toFixed(1)}%</Text>
      ),
    },
    {
      title: '7d Δ',
      dataIndex: 'momentum',
      key: 'momentum',
      align: 'right' as const,
      width: isMobile ? 50 : undefined,
      render: (value: number | null) => {
        if (value === null) return <Text style={{ fontSize: isMobile ? 12 : 14 }}>-</Text>;
        const color = value > 0 ? token.colorSuccess : value < 0 ? token.colorError : token.colorTextSecondary;
        return (
          <Text style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: isMobile ? 12 : 14 }}>
            {value > 0 ? '+' : ''}{value.toFixed(1)}
          </Text>
        );
      },
    },
  ];

  return (
    <Card
      title={
        <Space size={isMobile ? 'small' : 'middle'}>
          <TagsOutlined style={{ fontSize: isMobile ? 14 : 16 }} />
          <span style={{ fontSize: isMobile ? 13 : 14 }}>Tag Breakdown + Leaderboard</span>
        </Space>
      }
      extra={
        <Select
          value={leaderboardMetric}
          onChange={setLeaderboardMetric}
          style={{ minWidth: isMobile ? '100%' : 190, width: isMobile ? '100%' : undefined }}
          size="small"
          options={[
            { label: isMobile ? 'Points %' : 'Leaderboard: Points %', value: 'pointsPct' },
            { label: isMobile ? 'Pass Rate' : 'Leaderboard: Pass Rate', value: 'passRate' },
            { label: isMobile ? 'Relevant Subs' : 'Leaderboard: Relevant Subs', value: 'relSubs' },
            // { label: 'Leaderboard: Momentum (7d Δ)', value: 'momentum' },
          ]}
        />
      }
      style={{
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Text type="secondary" style={{ marginBottom: isMobile ? 12 : 16, display: 'block', fontSize: isMobile ? 11 : 12 }}>
        Click a tag to view the subjects leaderboard (only subjects with evidence for that tag in range).
      </Text>
      <div style={{ overflowX: 'auto', marginBottom: isMobile ? 12 : 16 }}>
        <Table
          dataSource={tagBreakdownData}
          columns={tagBreakdownColumns}
          pagination={false}
          size="small"
          scroll={isMobile ? { x: 'max-content' } : undefined}
        />
      </div>

      {/* {selectedBreakdownTagId && selectedTagData && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ marginBottom: 8 }}>
            <Text strong>
              Selected Tag: {selectedTagData.tagName}
            </Text>
            {(() => {
              const subjectCount = filteredLeaderboardData.length || selectedTagData.relevantSubmissions;
              const dateRangeText = dateRange[0] && dateRange[1]
                ? `${dateRange[0].format('YYYY-MM-DD')} → ${dateRange[1].format('YYYY-MM-DD')}`
                : 'All dates';
              return (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {subjectCount} {filteredLeaderboardData.length > 0 ? 'subject(s)' : 'relevant submission(s)'} with evidence · {dateRangeText}
                </Text>
              );
            })()}
          </div>

          {filteredLeaderboardData.length > 0 ? (
            <>
              {getLeaderboardChartData().length > 0 && (
                <Card
                  variant="outlined"
                  style={{
                    borderRadius: token.borderRadius,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>
                      Top Subjects by {leaderboardMetric === 'pointsPct' ? 'Points (%)' : leaderboardMetric === 'passRate' ? 'Pass Rate (%)' : leaderboardMetric === 'relSubs' ? 'Relevant Submissions' : 'Momentum (7d Δ)'}
                    </Text>
                  </div>
                  <Column {...leaderboardChartConfig} height={220} />
                  <Text type="secondary" style={{ marginTop: 8, display: 'block', fontSize: 11 }}>
                    This chart is scoped to the selected date range and tag evidence only.
                  </Text>
                </Card>
              )}
              {filteredLeaderboardData.length > 0 && (
                <Text type="secondary" style={{ marginTop: 12, display: 'block', fontSize: 12 }}>
                  {filteredLeaderboardData[0].subjectName} leads on {leaderboardMetric === 'pointsPct' ? 'pointsPct' : leaderboardMetric === 'passRate' ? 'passRate' : leaderboardMetric === 'relSubs' ? 'relSubs' : 'momentum'} ({leaderboardMetric === 'pointsPct' ? filteredLeaderboardData[0].pointsPct.toFixed(1) + '%' : leaderboardMetric === 'passRate' ? filteredLeaderboardData[0].passPct.toFixed(1) + '%' : leaderboardMetric === 'relSubs' ? filteredLeaderboardData[0].relSubs : filteredLeaderboardData[0].momentum?.toFixed(1) || '0'}). {filteredLeaderboardData.length > 1 ? `Lowest: ${filteredLeaderboardData[filteredLeaderboardData.length - 1].subjectName}.` : ''}
                </Text>
              )}
            </>
          ) : (
            <>
              {getLeaderboardChartData().length > 0 && (
                <Card
                  variant="outlined"
                  style={{
                    borderRadius: token.borderRadius,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>
                      Tag Performance: {leaderboardMetric === 'pointsPct' ? 'Points (%)' : leaderboardMetric === 'passRate' ? 'Pass Rate (%)' : 'Relevant Submissions'}
                    </Text>
                  </div>
                  <Column {...leaderboardChartConfig} height={220} />
                  <Text type="secondary" style={{ marginTop: 8, display: 'block', fontSize: 11 }}>
                    This chart is scoped to the selected date range and tag evidence only.
                  </Text>
                </Card>
              )}
              
              <Card
                variant="outlined"
                style={{
                  borderRadius: token.borderRadius,
                  padding: 12,
                }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Points Percentage</Text>
                      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {selectedTagData.pointsPct.toFixed(1)}%
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Pass Percentage</Text>
                      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {selectedTagData.passPct.toFixed(1)}%
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Relevant Submissions</Text>
                      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {selectedTagData.relevantSubmissions}
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            </>
          )}
        </>
      )} */}

      {getLeaderboardChartData().length > 0 && (
        <Card
          variant="outlined"
          style={{
            borderRadius: token.borderRadius,
            padding: isMobile ? 8 : 12,
            marginBottom: isMobile ? 8 : 10,
          }}
        >
          <div style={{ marginBottom: isMobile ? 6 : 8 }}>
            <Text strong style={{ fontSize: isMobile ? 12 : 13 }}>
              Tag Performance: {leaderboardMetric === 'pointsPct' ? 'Points (%)' : leaderboardMetric === 'passRate' ? 'Pass Rate (%)' : 'Relevant Submissions'}
            </Text>
          </div>
          <Column {...leaderboardChartConfig} height={isMobile ? 180 : 220} />
          <Text type="secondary" style={{ marginTop: isMobile ? 6 : 8, display: 'block', fontSize: isMobile ? 10 : 11 }}>
            This chart is scoped to the selected date range and tag evidence only.
          </Text>
        </Card>
      )}

      <div style={{ overflowX: 'auto' }}>
        <Table
          dataSource={leaderboardData}
          columns={leaderboardColumns}
          pagination={false}
          size="small"
          scroll={isMobile ? { x: 'max-content' } : undefined}
        />
      </div>
      {leaderboardData.length > 0 && (
        <Text type="secondary" style={{ marginTop: isMobile ? 10 : 12, display: 'block', fontSize: isMobile ? 11 : 12 }}>
          {leaderboardData[0].subjectName} leads on {leaderboardMetric === 'pointsPct' ? 'pointsPct' : leaderboardMetric === 'passRate' ? 'passRate' : leaderboardMetric === 'relSubs' ? 'relSubs' : 'momentum'} ({leaderboardMetric === 'pointsPct' ? leaderboardData[0].pointsPct.toFixed(1) + '%' : leaderboardMetric === 'passRate' ? leaderboardData[0].passPct.toFixed(1) + '%' : leaderboardMetric === 'relSubs' ? leaderboardData[0].relSubs : leaderboardData[0].momentum?.toFixed(1) || '0'}). {leaderboardData.length > 1 ? `Lowest: ${leaderboardData[leaderboardData.length - 1].subjectName}.` : ''}
        </Text>
      )}
    </Card>
  );
};
