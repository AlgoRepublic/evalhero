import React from 'react';
import { FloatButton, Grid } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useTour } from '../../context/TourContext';

const { useBreakpoint } = Grid;

export const TourButton: React.FC = () => {
  const { isRunning, startTour } = useTour();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  if (isRunning) {
    return null;
  }

  return (
    <FloatButton
      icon={<PlayCircleOutlined />}
      type="primary"
      tooltip="Start Website Tour"
      onClick={() => startTour()}
      style={{
        bottom: isMobile ? 16 : 24,
        right: isMobile ? 16 : 72,
      }}
    />
  );
};
