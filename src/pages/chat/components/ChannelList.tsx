import { Typography, theme, Grid, Button } from 'antd';
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { APPROVAL_TAB_ITEMS } from './chatLayoutUtils';

const { Text } = Typography;
const { useBreakpoint } = Grid;

export type ChatType = 'question_approval' | 'course_form_question_approval' | null;

interface ChannelListProps {
  selectedType: ChatType;
  onTypeSelect: (type: ChatType) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const ChannelList = ({
  selectedType,
  onTypeSelect,
  onRefresh,
  isRefreshing = false,
}: ChannelListProps) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMd = screens.md || screens.lg || screens.xl || screens.xxl;

  const menuItems = APPROVAL_TAB_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    icon: <CheckCircleOutlined />,
  }));

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: isMd ? '10px 16px' : '10px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          strong
          style={{
            fontSize: isMd ? '16px' : '14px',
            color: token.colorTextHeading,
          }}
        >
          Chat Channels
        </Text>
        {onRefresh && (
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            size="small"
            type="text"
            title="Refresh"
            loading={isRefreshing}
          />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {menuItems.map((item) => {
          const isSelected = selectedType === item.key;
          return (
            <div
              key={item.key}
              onClick={() => onTypeSelect(item.key as ChatType)}
              style={{
                padding: isMd ? '12px 16px' : '10px 12px',
                cursor: 'pointer',
                backgroundColor: isSelected ? token.colorPrimaryBg : 'transparent',
                borderRadius: token.borderRadius,
                border: `1px solid ${isSelected ? token.colorPrimaryBorder : token.colorBorder}`,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span
                style={{
                  fontSize: isMd ? '18px' : '16px',
                  color: isSelected ? token.colorPrimary : token.colorTextSecondary,
                }}
              >
                {item.icon}
              </span>
              <Text
                strong={isSelected}
                style={{
                  fontSize: isMd ? '14px' : '13px',
                  color: isSelected ? token.colorPrimary : token.colorText,
                  flex: 1,
                }}
              >
                {item.label}
              </Text>
            </div>
          );
        })}
      </div>
    </div>
  );
};

