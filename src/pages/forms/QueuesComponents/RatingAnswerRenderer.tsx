import React, { useMemo } from 'react';
import { Rate, Typography, theme } from 'antd';

const { Text } = Typography;

interface RatingAnswerRendererProps {
  ratingValue: number | null | undefined;
  maxRating?: number;
  ratingLabels?: string[];
  variant?: 'stars' | 'anchors' | 'emoji';
  allowHalf?: boolean;
  className?: string;
}

/**
 * RatingAnswerRenderer - Displays rating answers in a visual format
 * matching the rating node's display style (stars, anchors, or emoji)
 */
export const RatingAnswerRenderer: React.FC<RatingAnswerRendererProps> = ({
  ratingValue,
  maxRating = 5,
  ratingLabels,
  variant = 'stars',
  allowHalf = false,
  className = '',
}) => {
  const { token } = theme.useToken();

  if (ratingValue === null || ratingValue === undefined) {
    return (
      <Text type="secondary" italic style={{ fontSize: '14px' }}>
        No rating provided
      </Text>
    );
  }

  // Process anchorLabels: ensure it's an array and matches scale
  const anchorLabels = useMemo(() => {
    if (Array.isArray(ratingLabels) && ratingLabels.length === maxRating) {
      return ratingLabels;
    }
    // Default labels for common scales
    const defaultLabels: Record<number, string[]> = {
      3: ['Poor', 'Fair', 'Excellent'],
      4: ['Poor', 'Fair', 'Good', 'Excellent'],
      5: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'],
      7: ['Very Poor', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent', 'Outstanding'],
      10: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    };
    return defaultLabels[maxRating] || Array.from({ length: maxRating }, (_, i) => String(i + 1));
  }, [ratingLabels, maxRating]);

  // Generate emoji mapping for any scale
  const getEmojiForIndex = useMemo(() => {
    const emojiSets = [
      ['😞', '😐', '🙂', '😊', '😄'], // 5-point scale
      ['😢', '😞', '😐', '🙂', '😊', '😄', '🤩'], // 7-point scale
      ['😢', '😞', '😐', '🙂', '😊', '😄', '🤩', '🌟', '💯', '🎉'], // 10-point scale
    ];
    
    // Select appropriate emoji set based on scale
    let selectedSet: string[] = [];
    if (maxRating <= 5) {
      selectedSet = emojiSets[0].slice(0, maxRating);
    } else if (maxRating <= 7) {
      selectedSet = emojiSets[1].slice(0, maxRating);
    } else if (maxRating <= 10) {
      selectedSet = emojiSets[2].slice(0, maxRating);
    } else {
      // For scales > 10, interpolate between min and max emoji
      const minEmoji = '😞';
      const maxEmoji = '😄';
      selectedSet = Array.from({ length: maxRating }, (_, i) => {
        if (i === 0) return minEmoji;
        if (i === maxRating - 1) return maxEmoji;
        // Interpolate: use middle emojis for intermediate values
        const progress = i / (maxRating - 1);
        if (progress < 0.33) return '😐';
        if (progress < 0.66) return '🙂';
        return '😊';
      });
    }
    
    return (index: number): string => {
      return selectedSet[index - 1] || '⭐';
    };
  }, [maxRating]);

  // Render anchors as pill buttons (read-only)
  const renderPills = () => {
    return (
      <div
        style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
        aria-label={`Rating ${ratingValue} of ${maxRating}`}
      >
        {anchorLabels.map((lab: string, idx: number) => {
          const index = idx + 1;
          const selected = ratingValue === index || (allowHalf && ratingValue === index - 0.5);
          return (
            <span
              key={index}
              style={{
                display: 'inline-block',
                minWidth: 84,
                padding: '4px 12px',
                borderRadius: '16px',
                backgroundColor: selected ? token.colorPrimary : token.colorFillSecondary,
                color: selected ? '#fff' : token.colorText,
                fontSize: 14,
                fontWeight: selected ? 500 : 400,
                whiteSpace: 'normal',
                textAlign: 'center',
                opacity: selected ? 1 : 0.6,
                userSelect: 'none',
                transition: 'all 0.2s',
              }}
              aria-label={`${lab} (Rating ${index} of ${maxRating})${selected ? ' (selected)' : ''}`}
            >
              {lab}
            </span>
          );
        })}
      </div>
    );
  };

  // Render emoji rating
  const renderEmoji = () => {
    const emoji = getEmojiForIndex(Math.ceil(ratingValue));
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '32px', lineHeight: 1 }}>{emoji}</span>
        {ratingValue > 0 && (
          <Text strong style={{ fontSize: '16px' }}>
            {ratingValue} / {maxRating}
          </Text>
        )}
      </div>
    );
  };

  // Render stars rating
  const renderStars = () => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Rate
          value={ratingValue}
          count={maxRating}
          allowHalf={allowHalf}
          disabled
          style={{ fontSize: '20px' }}
        />
        {ratingValue > 0 && (
          <Text strong style={{ fontSize: '14px' }}>
            {ratingValue} / {maxRating}
          </Text>
        )}
      </div>
    );
  };

  return (
    <div className={`rating-answer-renderer ${className}`}>
      {variant === 'anchors' ? renderPills() : variant === 'emoji' ? renderEmoji() : renderStars()}
    </div>
  );
};
