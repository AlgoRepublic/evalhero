import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import {
  TagsOutlined,
  BarChartOutlined,
  FileTextOutlined,
  UserOutlined,
  TeamOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import {
  Card,
  Row,
  Col,
  Spin,
  Alert,
  Statistic,
  Typography,
  Space,
  Flex,
  theme,
  Progress,
  Tag,
  Select,
} from 'antd';
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useGetTagStatsQuery } from '../../services/tagsApi';
import { useGetSubjectsQuery } from '../../services/assignmentsApi';
import { User } from '../../features/auth/authSlice';

const { Text } = Typography;
const { useToken } = theme;

const TagStatsPage = () => {
  const { tagId } = useParams<{ tagId: string }>();
  const { token } = useToken();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>(undefined);

  // Fetch subjects for filter
  const { data: subjectsRes, isLoading: subjectsLoading } = useGetSubjectsQuery();
  const subjects = subjectsRes?.data || [];

  // Fetch tag stats with optional subject filter
  const { data, isLoading, isError, error } = useGetTagStatsQuery(
    {
      tagId: tagId || '',
      subjectId: selectedSubjectId,
    },
    {
      skip: !tagId,
    }
  );

  if (isLoading) {
    return (
      <div>
        <Helmet>
          <title>Tag Statistics - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Tag Statistics"
          breadcrumbs={[
            {
              title: (
                <>
                  <TagsOutlined />
                  <span>Tags</span>
                </>
              ),
              path: '/tags',
            },
            {
              title: (
                <>
                  <BarChartOutlined />
                  <span>Statistics</span>
                </>
              ),
            },
          ]}
        />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Loading statistics...</Text>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const errorMessage =
      (error as { data?: { message?: string } })?.data?.message || 'Failed to load tag statistics';
    return (
      <div>
        <Helmet>
          <title>Tag Statistics - Eval Hero</title>
        </Helmet>
        <PageHeader
          title="Tag Statistics"
          breadcrumbs={[
            {
              title: (
                <>
                  <TagsOutlined />
                  <span>Tags</span>
                </>
              ),
              path: '/tags',
            },
            {
              title: (
                <>
                  <BarChartOutlined />
                  <span>Statistics</span>
                </>
              ),
            },
          ]}
        />
        <Alert
          message="Error Loading Statistics"
          description={errorMessage}
          type="error"
          showIcon
          style={{ marginTop: 24 }}
        />
      </div>
    );
  }

  const stats = data.data.stats;
  const passRate = stats.passFail.passRate;
  const averagePercentage = stats.score.averagePercentage;

  return (
    <div style={{ paddingBottom: 24 }}>
      <Helmet>
        <title>{stats.tag.name} - Statistics - Eval Hero</title>
      </Helmet>
      <PageHeader
        title={`${stats.tag.name} - Statistics`}
        breadcrumbs={[
          {
            title: (
              <>
                <TagsOutlined />
                <span>Tags</span>
              </>
            ),
            path: '/tags',
          },
          {
            title: (
              <>
                <BarChartOutlined />
                <span>Statistics</span>
              </>
            ),
          },
        ]}
      />

      {/* Subject Filter */}
      <Card
        style={{
          marginTop: 24,
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <Flex align="center" gap="middle" wrap="wrap">
          <Space>
            <FilterOutlined style={{ fontSize: 16, color: token.colorTextSecondary }} />
            <Text strong>Filter by Subject:</Text>
          </Space>
          <Select
            placeholder="Select a subject to filter statistics"
            allowClear
            showSearch
            style={{ minWidth: 250, maxWidth: '100%' }}
            loading={subjectsLoading}
            value={selectedSubjectId}
            onChange={(value) => setSelectedSubjectId(value || undefined)}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={subjects.map((profile) => ({
              label: (profile.user as User)?.name || 'Unknown',
              value: profile._id,
            }))}
          />
        </Flex>
      </Card>

      {/* Summary Statistics Cards */}
      <Row
        gutter={[
          { xs: 12, sm: 16, md: 20, lg: 24 },
          { xs: 12, sm: 16, md: 20, lg: 24 },
        ]}
        style={{ marginTop: 24 }}
      >
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            hoverable
            style={{
              height: '100%',
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
            }}
          >
            <Flex vertical gap="middle">
              <Flex align="center" justify="space-between">
                <FileTextOutlined
                  style={{ fontSize: 32, color: token.colorPrimary }}
                />
                <Tag color="blue">Total</Tag>
              </Flex>
              <Statistic
                title="Total Stats"
                value={stats.summary.totalStats}
                // precision={2}
                valueStyle={{ fontSize: 28, fontWeight: 600 }}
              />
            </Flex>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            hoverable
            style={{
              height: '100%',
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
            }}
          >
            <Flex vertical gap="middle">
              <Flex align="center" justify="space-between">
                <FileTextOutlined
                  style={{ fontSize: 32, color: token.colorSuccess }}
                />
                <Tag color="green">Unique</Tag>
              </Flex>
              <Statistic
                title="Unique Submissions"
                value={stats.summary.uniqueSubmissions}
                // precision={2}
                valueStyle={{ fontSize: 28, fontWeight: 600 }}
              />
            </Flex>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            hoverable
            style={{
              height: '100%',
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
            }}
          >
            <Flex vertical gap="middle">
              <Flex align="center" justify="space-between">
                <UserOutlined
                  style={{ fontSize: 32, color: token.colorWarning }}
                />
                <Tag color="orange">Subjects</Tag>
              </Flex>
              <Statistic
                title="Unique Subjects"
                value={stats.summary.uniqueSubjects}
                // precision={2}
                valueStyle={{ fontSize: 28, fontWeight: 600 }}
              />
            </Flex>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            hoverable
            style={{
              height: '100%',
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
            }}
          >
            <Flex vertical gap="middle">
              <Flex align="center" justify="space-between">
                <TeamOutlined
                  style={{ fontSize: 32, color: token.colorInfo }}
                />
                <Tag color="cyan">Assignees</Tag>
              </Flex>
              <Statistic
                title="Unique Assignees"
                value={stats.summary.uniqueAssignees}
                // precision={2}
                valueStyle={{ fontSize: 28, fontWeight: 600 }}
              />
            </Flex>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            hoverable
            style={{
              height: '100%',
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
            }}
          >
            <Flex vertical gap="middle">
              <Flex align="center" justify="space-between">
                <QuestionCircleOutlined
                  style={{ fontSize: 32, color: '#722ed1' }}
                />
                <Tag color="purple">Questions</Tag>
              </Flex>
              <Statistic
                title="Unique Questions"
                value={stats.summary.uniqueQuestions}
                // precision={2}
                valueStyle={{ fontSize: 28, fontWeight: 600 }}
              />
            </Flex>
          </Card>
        </Col>
      </Row>

      {/* Pass/Fail and Score Statistics */}
      <Row
        gutter={[
          { xs: 12, sm: 16, md: 20, lg: 24 },
          { xs: 12, sm: 16, md: 20, lg: 24 },
        ]}
        style={{ marginTop: 24 }}
      >
        {/* Pass/Fail Statistics */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                <span>Pass/Fail Statistics</span>
              </Space>
            }
            style={{
              height: '100%',
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
            }}
          >
            <Row gutter={[16, 24]}>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Total Evaluations"
                  value={stats.passFail.total}
                  // precision={2}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ fontSize: 24, fontWeight: 600 }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Passed"
                  value={stats.passFail.pass}
                  // precision={2}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: token.colorSuccess,
                  }}
                />
                <Progress
                  percent={stats.passFail.total > 0 ? (stats.passFail.pass / stats.passFail.total) * 100 : 0}
                  strokeColor={token.colorSuccess}
                  showInfo={false}
                  style={{ marginTop: 8 }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Failed"
                  value={stats.passFail.fail}
                  // precision={2}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: token.colorError,
                  }}
                />
                <Progress
                  percent={stats.passFail.total > 0 ? (stats.passFail.fail / stats.passFail.total) * 100 : 0}
                  strokeColor={token.colorError}
                  showInfo={false}
                  style={{ marginTop: 8 }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Pass Rate"
                  value={passRate}
                  precision={2}
                  suffix="%"
                  prefix={<RiseOutlined />}
                  valueStyle={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: token.colorSuccess,
                  }}
                  />
                <Progress
                  percent={passRate}
                  strokeColor={token.colorSuccess}
                  status="active"
                  style={{ marginTop: 8 }}
                  showInfo={false}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Score Statistics */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: token.colorWarning }} />
                <span>Score Statistics</span>
              </Space>
            }
            style={{
              height: '100%',
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
            }}
          >
            <Row gutter={[16, 24]}>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Total Evaluations"
                  value={stats.score.total}
                  // precision={2}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ fontSize: 24, fontWeight: 600 }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Average Score"
                  value={stats.score.average}
                  precision={2}
                  // suffix={`/ ${stats.score.averageOutOf.toFixed(2)}`}
                  prefix={<RiseOutlined />}
                  valueStyle={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: token.colorPrimary,
                  }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Flex gap="small" align="center">
                  <FallOutlined style={{ color: token.colorError }} />
                  <Statistic
                    title="Min Score"
                    value={stats.score.min}
                    precision={2}
                    // suffix={`/ ${stats.score.averageOutOf.toFixed(2)}`}
                    valueStyle={{ fontSize: 20, fontWeight: 500 }}
                  />
                </Flex>
              </Col>
              <Col xs={24} sm={12}>
                <Flex gap="small" align="center">
                  <RiseOutlined style={{ color: token.colorSuccess }} />
                  <Statistic
                    title="Max Score"
                    value={stats.score.max}
                    precision={2}
                    // suffix={`/ ${stats.score.averageOutOf.toFixed(2)}`}
                    valueStyle={{ fontSize: 20, fontWeight: 500 }}
                  />
                </Flex>
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Total Score"
                  value={stats.score.totalScore}
                  precision={2}
                  suffix={`/ ${stats.score.totalScoreOutOf.toFixed(2)}`}
                  prefix={<TrophyOutlined />}
                  valueStyle={{ fontSize: 20, fontWeight: 500 }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Average Percentage"
                  value={averagePercentage ? averagePercentage.toFixed(2) : 0}
                  precision={2}
                  suffix="%"
                  // prefix={<PercentageOutlined />}
                  valueStyle={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: token.colorPrimary,
                  }}
                />
                {/* <Progress
                  percent={averagePercentage}
                  strokeColor={token.colorPrimary}
                  status="active"
                  style={{ marginTop: 8 }}
                  showInfo={false}
                /> */}
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export { TagStatsPage };
