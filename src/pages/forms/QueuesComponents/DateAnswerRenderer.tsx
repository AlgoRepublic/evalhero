import React from 'react';
import { Space, Typography } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

interface DateAnswerRendererProps {
  dateValue: string | null | undefined;
  isDateTime?: boolean;
  format?: string;
  className?: string;
}

/**
 * DateAnswerRenderer - Displays date and dateTime answers in a user-friendly format
 */
export const DateAnswerRenderer: React.FC<DateAnswerRendererProps> = ({
  dateValue,
  isDateTime = false,
  format,
  className = '',
}) => {

  if (!dateValue) {
    return (
      <Text type="secondary" italic style={{ fontSize: '14px' }}>
        No date provided
      </Text>
    );
  }

  try {
    const date = dayjs(dateValue);
    
    if (!date.isValid()) {
      return (
        <Text type="secondary" style={{ fontSize: '14px' }}>
          {String(dateValue)}
        </Text>
      );
    }

    if (isDateTime) {
      // Format as dateTime
      const formattedDateTime = format 
        ? date.format(format)
        : date.format('MMMM DD, YYYY [at] hh:mm A');
      
      const weekday = date.format('dddd');
      const relativeTime = getRelativeTime(date);
      
      return (
        <div className={`date-answer-renderer ${className}`}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text strong style={{ fontSize: '14px' }}>
              {formattedDateTime}
            </Text>
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {weekday}
              </Text>
              {relativeTime && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  • {relativeTime}
                </Text>
              )}
            </Space>
          </Space>
        </div>
      );
    } else {
      // Format as date only
      const formattedDate = format 
        ? date.format(format)
        : date.format('MMMM DD, YYYY');
      
      const weekday = date.format('dddd');
      const relativeDate = getRelativeDate(date);
      
      return (
        <div className={`date-answer-renderer ${className}`}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text strong style={{ fontSize: '14px' }}>
              {formattedDate}
            </Text>
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {weekday}
              </Text>
              {relativeDate && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  • {relativeDate}
                </Text>
              )}
            </Space>
          </Space>
        </div>
      );
    }
  } catch (error) {
    // Fallback to raw value if parsing fails
    return (
      <Text style={{ fontSize: '14px' }}>
        {String(dateValue)}
      </Text>
    );
  }
};

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
function getRelativeTime(date: dayjs.Dayjs): string | null {
  const now = dayjs();
  const diffMinutes = date.diff(now, 'minute');
  const absDiffMinutes = Math.abs(diffMinutes);
  
  if (absDiffMinutes < 1) {
    return 'just now';
  } else if (absDiffMinutes < 60) {
    return `${absDiffMinutes} minute${absDiffMinutes === 1 ? '' : 's'} ${diffMinutes < 0 ? 'ago' : 'from now'}`;
  } else if (absDiffMinutes < 1440) {
    const hours = Math.floor(absDiffMinutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ${diffMinutes < 0 ? 'ago' : 'from now'}`;
  } else if (absDiffMinutes < 10080) {
    const days = Math.floor(absDiffMinutes / 1440);
    return `${days} day${days === 1 ? '' : 's'} ${diffMinutes < 0 ? 'ago' : 'from now'}`;
  }
  
  return null; // Don't show relative time for dates more than a week away
}

/**
 * Get relative date string (e.g., "Today", "Yesterday", "3 days ago")
 */
function getRelativeDate(date: dayjs.Dayjs): string | null {
  const now = dayjs();
  const diffDays = date.diff(now, 'day');
  const absDiffDays = Math.abs(diffDays);
  
  if (absDiffDays === 0) {
    return 'Today';
  } else if (absDiffDays === 1) {
    return diffDays < 0 ? 'Yesterday' : 'Tomorrow';
  } else if (absDiffDays < 7) {
    return `${absDiffDays} day${absDiffDays === 1 ? '' : 's'} ${diffDays < 0 ? 'ago' : 'from now'}`;
  }
  
  return null; // Don't show relative date for dates more than a week away
}
