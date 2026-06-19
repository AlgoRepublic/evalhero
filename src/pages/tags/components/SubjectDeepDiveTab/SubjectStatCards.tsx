import { Row, Col } from 'antd';
import {
  FileTextOutlined,
  TagsOutlined,
  TrophyOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { StatCard } from '../TagStatsTab/StatCard';
import { ComprehensiveTagStatsSummary, TagBreakdown } from '../../../../services/tagsApi';
import { theme } from 'antd';

const { useToken } = theme;

interface SubjectStatCardsProps {
  summary: ComprehensiveTagStatsSummary;
  tagBreakdown: TagBreakdown[];
}

export const SubjectStatCards = ({ summary, tagBreakdown }: SubjectStatCardsProps) => {
  const { token } = useToken();

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginTop: 18 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            badge="Total"
            badgeColor="blue"
            icon={<FileTextOutlined style={{ fontSize: 24 }} />}
            label="Total Stats"
            value={summary.totalStats}
            iconColor={token.colorPrimary}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            badge="Unique"
            badgeColor="green"
            icon={<FileTextOutlined style={{ fontSize: 24 }} />}
            label="Unique Submissions"
            value={summary.uniqueSubmissions}
            iconColor={token.colorSuccess}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            badge="Coverage"
            badgeColor="orange"
            icon={<TagsOutlined style={{ fontSize: 24 }} />}
            label="Tags Covered"
            value={tagBreakdown?.length || 0}
            iconColor={token.colorWarning}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            badge="Rank"
            badgeColor="cyan"
            icon={<TrophyOutlined style={{ fontSize: 24 }} />}
            label="Org Rank (Points %)"
            value="—"
            iconColor={token.colorPrimary}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 14 }}>
        <Col xs={24} sm={12} lg={6}>
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
