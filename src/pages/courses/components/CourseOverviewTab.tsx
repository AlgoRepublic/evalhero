import React from 'react';
import {
  Card,
  Tag,
  Space,
  Typography,
  Image,
  Row,
  Col,
  theme,
  Grid,
} from 'antd';
import { FileTextOutlined, SettingOutlined, BookOutlined} from '@ant-design/icons';
import type { Course } from '../../../types/course';
import type { GlobalToken } from 'antd/es/theme/interface';

const { Title, Paragraph, Text } = Typography;
const { useBreakpoint } = Grid;

function SettingRow({
  label,
  value,
  token,
  isSmall,
}: {
  label: string;
  value: React.ReactNode;
  token: GlobalToken;
  isSmall: boolean;
}) {
  return (
    <Card
      size="small"
      style={{
        background: token.colorFillTertiary,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
      styles={{ body: { padding: isSmall ? 10 : 12, minWidth: 0 } }}
    >
      <Row gutter={[8, 4]} align="middle" justify="space-between">
        <Col style={{ flexShrink: 0 }}>
          <Text type="secondary" style={{ fontSize: isSmall ? 12 : 13 }}>
            {label}
          </Text>
        </Col>
        <Col style={{ minWidth: 0, overflow: 'hidden' }}>
          {value}
        </Col>
      </Row>
    </Card>
  );
}

interface CourseOverviewTabProps {
  course: Course;
}

const CourseOverviewTab: React.FC<CourseOverviewTabProps> = ({ course }) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isSmall = !screens.md;

  return (
    <Row gutter={[0, 0]} style={{ padding: '8px 0' }}>
      <Col span={24}>
        <Row gutter={[16, 16]}>
        {/* Cover Image and Description */}
        <Col xs={24} lg={24}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: token.boxShadowSecondary,
              height: '100%',
            }}
          >
            <Row gutter={[0, 24]}>
              <Col span={24}>
                <Title
                  level={2}
                  style={{ marginBottom: 0, marginTop: 0, display: 'flex', alignItems: 'center', gap: 12, fontSize: 24 }}
                >
                  <BookOutlined style={{ color: token.colorPrimary, fontSize: 28 }} />
                  {course.title}
                </Title>
              </Col>
              {course.coverImage && (
                <Col span={24}>
                  <Image
                    src={course.coverImage}
                    alt={course.title}
                    style={{
                      width: '100%',
                      maxHeight: 400,
                      objectFit: 'cover',
                      borderRadius: 8,
                    }}
                    preview
                  />
                </Col>
              )}
              <Col span={24}>
                <Title level={4} style={{ marginBottom: 12, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileTextOutlined style={{ color: token.colorPrimary }} />
                  Description
                </Title>
                <Paragraph
                  style={{
                    fontSize: 15,
                    lineHeight: 1.8,
                    color: token.colorText,
                    marginBottom: 0,
                  }}
                >
                  {course.description || (
                    <Text type="secondary" italic>No description provided</Text>
                  )}
                </Paragraph>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Statistics Card */}
        {/* <Col xs={24} lg={8}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChartOutlined style={{ color: token.colorPrimary }} />
                Statistics
              </span>
            }
            style={{
              borderRadius: 12,
              boxShadow: token.boxShadowSecondary,
              height: '100%',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <Row gutter={[0, 12]}>
              <Col span={24}>
                <Card size="small" style={{ background: token.colorFillTertiary, borderRadius: 8 }}>
                  <Row align="middle" justify="space-between" gutter={8}>
                    <Col>
                      <Space>
                        <FileTextOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
                        <Text strong>Pages</Text>
                      </Space>
                    </Col>
                    <Col>
                      <Text style={{ fontSize: 18, fontWeight: 600, color: token.colorPrimary }}>
                        {course.pages?.length || 0}
                      </Text>
                    </Col>
                  </Row>
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small" style={{ background: token.colorFillTertiary, borderRadius: 8 }}>
                  <Row align="middle" justify="space-between" gutter={8}>
                    <Col>
                      <Space>
                        <UserOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
                        <Text strong>Members</Text>
                      </Space>
                    </Col>
                    <Col>
                      <Text style={{ fontSize: 18, fontWeight: 600, color: token.colorPrimary }}>
                        {course.members?.length || 0}
                      </Text>
                    </Col>
                  </Row>
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small" style={{ background: token.colorFillTertiary, borderRadius: 8 }}>
                  <Row align="middle" justify="space-between" gutter={8}>
                    <Col>
                      <Space>
                        <TeamOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
                        <Text strong>Cohorts</Text>
                      </Space>
                    </Col>
                    <Col>
                      <Text style={{ fontSize: 18, fontWeight: 600, color: token.colorPrimary }}>
                        {course.cohorts?.length || 0}
                      </Text>
                    </Col>
                  </Row>
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small" style={{ background: token.colorFillTertiary, borderRadius: 8 }}>
                  <Row align="middle" justify="space-between" gutter={8}>
                    <Col>
                      <Space>
                        <SafetyOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
                        <Text strong>Roles</Text>
                      </Space>
                    </Col>
                    <Col>
                      <Text style={{ fontSize: 18, fontWeight: 600, color: token.colorPrimary }}>
                        {course.roles?.length || 0}
                      </Text>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col> */}
        </Row>

        {/* Course Settings - responsive grid to avoid overlap on laptop */}
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SettingOutlined style={{ color: token.colorPrimary }} />
                  Course Settings
                </span>
              }
              style={{
                borderRadius: 12,
                boxShadow: token.boxShadowSecondary,
                overflow: 'hidden',
              }}
              styles={{ body: {
                padding: isSmall ? 4 : 16,
                minWidth: 0,
              } }}
            >
              <Row gutter={[isSmall ? 8 : 12, isSmall ? 8 : 12]}>
                <Col xs={24} sm={12} md={12} xl={8}>
                  <SettingRow
                    label="Status"
                    value={
                      <Tag
                        color={
                          course.status === 'published'
                            ? 'success'
                            : course.status === 'archived'
                            ? 'warning'
                            : 'default'
                        }
                        style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}
                      >
                        {course.status}
                      </Tag>
                    }
                    token={token}
                    isSmall={isSmall}
                  />
                </Col>
                <Col xs={24} sm={12} md={12} xl={8}>
                  <SettingRow
                    label="Visibility"
                    value={
                      <Tag
                        color={course.visibility === 'open' ? 'blue' : 'purple'}
                        style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}
                      >
                        {course.visibility}
                      </Tag>
                    }
                    token={token}
                    isSmall={isSmall}
                  />
                </Col>
                <Col xs={24} sm={12} md={12} xl={8}>
                  <SettingRow
                    label="Enrollment Policy"
                    value={
                      <Tag
                        color={
                          course.enrollmentPolicy === 'auto-join'
                            ? 'green'
                            : course.enrollmentPolicy === 'request-join'
                            ? 'orange'
                            : 'red'
                        }
                        style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}
                      >
                        {course.enrollmentPolicy}
                      </Tag>
                    }
                    token={token}
                    isSmall={isSmall}
                  />
                </Col>
                <Col xs={24} sm={12} md={12} xl={8}>
                  <SettingRow
                    label="Non-Org Guests"
                    value={
                      course.nonOrgGuestsAllowed ? (
                        <Tag color="green" style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}>
                          Allowed
                        </Tag>
                      ) : (
                        <Tag style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}>Not Allowed</Tag>
                      )
                    }
                    token={token}
                    isSmall={isSmall}
                  />
                </Col>
                <Col xs={24} sm={24} md={24} xl={16}>
                  <SettingRow
                    label="Sequencing"
                    value={
                      <Space size={4} wrap style={{ minWidth: 0 }}>
                        {course.sequencing?.enabled ? (
                          <Tag color="green" style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}>
                            Enabled
                          </Tag>
                        ) : (
                          <Tag style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}>Disabled</Tag>
                        )}
                        {course.sequencing?.enabled && (
                          <>
                            <Tag style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}>
                              {course.sequencing.strict ? 'Strict' : 'Soft'}
                            </Tag>
                            <Tag style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}>
                              {course.sequencing.allowRetake ? 'Retake Allowed' : 'No Retake'}
                            </Tag>
                            {course.sequencing.mode && (
                              <Tag style={{ margin: 0, fontSize: isSmall ? 12 : 13 }}>
                                {course.sequencing.mode}
                              </Tag>
                            )}
                          </>
                        )}
                      </Space>
                    }
                    token={token}
                    isSmall={isSmall}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default CourseOverviewTab;
