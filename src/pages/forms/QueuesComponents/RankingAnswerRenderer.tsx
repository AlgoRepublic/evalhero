import React from 'react';
import { Space, Tag, Typography, theme } from 'antd';

const { Text } = Typography;

interface RankingAnswerRendererProps {
  order: string[] | any[] | null | undefined;
  options: Array<{ id: string | number; label: string | number } | string> | null | undefined;
  className?: string;
}

/**
 * RankingAnswerRenderer - Displays ranking answers in a formatted numbered list
 * 
 * Shows the ranked order of options with their position numbers, similar to how
 * rich text answers are displayed with formatting.
 */
export const RankingAnswerRenderer: React.FC<RankingAnswerRendererProps> = ({
  order,
  options,
  className = '',
}) => {
  const { token } = theme.useToken();

  if (!order || !Array.isArray(order) || order.length === 0) {
    return (
      <Text type="secondary" italic style={{ fontSize: '14px' }}>
        No ranking provided
      </Text>
    );
  }

  // Normalize options to have id and label
  const normalizedOptions = React.useMemo(() => {
    if (!options || !Array.isArray(options) || options.length === 0) {
      return [];
    }

    return options.map((opt, idx) => {
      if (typeof opt === 'string') {
        return {
          id: `${opt}-${idx}`,
          label: opt,
        };
      }
      if (typeof opt === 'object' && opt !== null && 'id' in opt && 'label' in opt) {
        return {
          id: String(opt.id),
          label: String(opt.label),
        };
      }
      return {
        id: `option-${idx}`,
        label: String(opt),
      };
    });
  }, [options]);

  // Create a map for quick lookup
  const optionMap = React.useMemo(() => {
    const map = new Map<string, string>();
    normalizedOptions.forEach((opt) => {
      map.set(opt.id, opt.label);
    });
    return map;
  }, [normalizedOptions]);

  // Get ordered labels
  const rankedItems = React.useMemo(() => {
    return order
      .map((id) => {
        const label = optionMap.get(String(id)) || String(id);
        return label;
      })
      .filter(Boolean);
  }, [order, optionMap]);

  if (rankedItems.length === 0) {
    return (
      <Text type="secondary" italic style={{ fontSize: '14px' }}>
        No ranking provided
      </Text>
    );
  }

  return (
    <div className={`ranking-answer-renderer ${className}`}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {rankedItems.map((label, index) => (
          <div
            key={`${label}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              background: token.colorFillAlter,
              borderRadius: 6,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Tag
              color="purple"
              style={{
                margin: 0,
                minWidth: 40,
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              #{index + 1}
            </Tag>
            <Text style={{ fontSize: '14px', flex: 1 }}>{label}</Text>
          </div>
        ))}
      </Space>
    </div>
  );
};
