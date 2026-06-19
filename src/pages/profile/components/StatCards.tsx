import { Row, Col } from 'antd';
import {
  FileTextOutlined,
  UserOutlined,
  TeamOutlined,
  QuestionCircleOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { StatCard } from './StatCard';
import { ProfileStatsSummary } from '../../../services/profilesAPI';
import { theme } from 'antd';

const { useToken } = theme;

interface StatCardsProps {
  summary: ProfileStatsSummary;
}

export const StatCards = ({ summary }: StatCardsProps) => {
  const { token } = useToken();

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginTop: 18 }}>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <StatCard
            badge="Total"
            badgeColor="blue"
            icon={<FileTextOutlined style={{ fontSize: 24 }} />}
            label="Total Stats"
            value={summary.totalStats}
            iconColor={token.colorPrimary}
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <StatCard
            badge="Unique"
            badgeColor="green"
            icon={<FileTextOutlined style={{ fontSize: 24 }} />}
            label="Unique Submissions"
            value={summary.uniqueSubmissions}
            iconColor={token.colorSuccess}
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <StatCard
            badge="Subjects"
            badgeColor="orange"
            icon={<UserOutlined style={{ fontSize: 24 }} />}
            label="Unique Subjects"
            value={summary.uniqueSubjects}
            iconColor={token.colorWarning}
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <StatCard
            badge="Assignees"
            badgeColor="cyan"
            icon={<TeamOutlined style={{ fontSize: 24 }} />}
            label="Unique Assignees"
            value={summary.uniqueAssignees}
            iconColor={token.colorInfo}
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <StatCard
            badge="Questions"
            badgeColor="purple"
            icon={<QuestionCircleOutlined style={{ fontSize: 24 }} />}
            label="Unique Questions"
            value={summary.uniqueQuestions}
            iconColor="#8b5cf6"
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <StatCard
            badge="Tags"
            badgeColor="magenta"
            icon={<TagsOutlined style={{ fontSize: 24 }} />}
            label="Unique Tags"
            value={summary.uniqueTags}
            iconColor="#eb2f96"
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <StatCard
            badge="As Subject"
            badgeColor="blue"
            icon={<UserOutlined style={{ fontSize: 24 }} />}
            label="Stats as Subject"
            value={summary.statsAsSubject}
            iconColor={token.colorPrimary}
          />
        </Col>

        <Col xs={24} sm={12} lg={8} xl={6}>
          <StatCard
            badge="As Assignee"
            badgeColor="green"
            icon={<TeamOutlined style={{ fontSize: 24 }} />}
            label="Stats as Assignee"
            value={summary.statsAsAssignee}
            iconColor={token.colorSuccess}
          />
        </Col>
      </Row>
    </>
  );
};
