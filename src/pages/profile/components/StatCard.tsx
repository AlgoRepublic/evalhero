import { Card, Tag, Flex, Typography } from 'antd';
import { ReactNode, isValidElement, cloneElement } from 'react';
import { theme } from 'antd';
import { useMediaQuery } from 'react-responsive';

const { Text } = Typography;
const { useToken } = theme;

interface StatCardProps {
  badge: string;
  badgeColor: string;
  icon: ReactNode;
  label: string;
  value: string | number;
  iconColor?: string;
}

export const StatCard = ({
  badge,
  badgeColor,
  icon,
  label,
  value,
  iconColor,
}: StatCardProps) => {
  const { token } = useToken();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  return (
    <Card
      style={{
        position: 'relative',
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowTertiary,
      }}
      styles={{ body: { padding: isMobile ? '12px 12px 12px 12px' : '36px 12px 12px 12px' } }}
    >
      <Tag
        color={badgeColor}
        style={{
          position: 'absolute',
          top: isMobile ? 8 : 12,
          right: isMobile ? 8 : 12,
          fontSize: isMobile ? 11 : 12,
        }}
      >
        {badge}
      </Tag>
      <Flex align="flex-start" gap={isMobile ? 'small' : 'middle'}>
        <div style={{ color: iconColor || token.colorPrimary, marginTop: 2 }}>
          {isValidElement(icon) && cloneElement(icon as React.ReactElement, {
            style: { fontSize: isMobile ? 20 : 24 }
          })}
        </div>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
            {label}
          </Text>
          <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 600, marginTop: isMobile ? 4 : 6 }}>
            {value}
          </div>
        </div>
      </Flex>
    </Card>
  );
};
