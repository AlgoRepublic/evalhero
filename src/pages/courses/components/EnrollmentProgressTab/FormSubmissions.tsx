import React from 'react';
import { Card, Row, Col, Space, Typography, Tag, Divider, theme } from 'antd';
import {
  FileTextOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageProgress } from './types';

const { Title, Text } = Typography;

interface FormSubmissionsProps {
  pages: PageProgress[];
}

export const FormSubmissions: React.FC<FormSubmissionsProps> = ({ pages }) => {
  const { token } = theme.useToken();
  const formsWithPages = pages
    .filter((page) => page.inlineForms.length > 0)
    .flatMap((page) =>
      page.inlineForms.map((form) => ({
        page,
        form,
      }))
    );

  if (formsWithPages.length === 0) return null;

  return (
    <Card
      variant="borderless"
      style={{
        borderRadius: 16,
        boxShadow: token.boxShadowSecondary,
      }}
      title={
        <Space>
          <FileTextOutlined style={{ fontSize: 18 }} />
          <Title level={4} style={{ margin: 0 }}>
            Form Submissions
          </Title>
        </Space>
      }
    >
      <Row gutter={[16, 16]}>
        {formsWithPages.map(({ page, form }) => (
          <Col xs={24} sm={12} lg={8} key={`${page.pageId}-${form.formBlockId}`}>
            <Card
              variant="outlined"
              style={{
                borderRadius: 12,
                borderColor: form.isFilled
                  ? form.passed === true
                    ? token.colorSuccess
                    : token.colorError
                  : token.colorBorder,
              }}
              styles={{ body: { padding: 16 } }}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ fontSize: 15 }}>
                    {page.title}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {form.formBlockId}
                  </Text>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <Row gutter={[8, 8]}>
                  <Col span={24}>
                    <Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Status:
                      </Text>
                      <Tag
                        color={form.isFilled ? 'success' : 'default'}
                        icon={form.isFilled ? <CheckOutlined /> : <CloseOutlined />}
                      >
                        {form.isFilled ? 'Filled' : 'Not Filled'}
                      </Tag>
                    </Space>
                  </Col>
                  {form.score !== null && form.score !== undefined && (
                    <Col span={24}>
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Score:
                        </Text>
                        <Tag
                          color={form.passed === true ? 'success' : 'error'}
                          style={{ fontSize: 13, fontWeight: 600 }}
                        >
                          {form.score}%
                        </Tag>
                      </Space>
                    </Col>
                  )}
                  {form.approvalRequired && (
                    <Col span={24}>
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Approval:
                        </Text>
                        <Tag
                          color={
                            form.approvalStatus === 'approved'
                              ? 'success'
                              : form.approvalStatus === 'rejected'
                              ? 'error'
                              : 'warning'
                          }
                        >
                          {form.approvalStatus.replace('-', ' ').toUpperCase()}
                        </Tag>
                      </Space>
                    </Col>
                  )}
                  {form.attempts > 0 && (
                    <Col span={24}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> {form.attempts} attempt
                        {form.attempts > 1 ? 's' : ''}
                        {form.lastAttemptAt &&
                          ` • ${dayjs(form.lastAttemptAt).format('MMM DD, YYYY')}`}
                      </Text>
                    </Col>
                  )}
                </Row>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
};
