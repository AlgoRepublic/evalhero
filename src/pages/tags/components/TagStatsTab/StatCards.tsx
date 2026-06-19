import { Row, Col } from 'antd';
import {
  FileTextOutlined,
  UserOutlined,
  TeamOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { StatCard } from './StatCard';
import { ComprehensiveTagStatsSummary } from '../../../../services/tagsApi';
import { theme } from 'antd';

const { useToken } = theme;

interface StatCardsProps {
  summary: ComprehensiveTagStatsSummary;
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
            label="Active Subjects"
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
      </Row>
    </>
  );
};
