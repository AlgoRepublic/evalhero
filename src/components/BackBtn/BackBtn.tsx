import { useNavigate } from 'react-router-dom';
import { Button, ButtonProps, Tooltip } from 'antd';
import { LeftOutlined } from '@ant-design/icons';

type Props = {
  wIcon?: boolean;
  iconOnly?: boolean;
} & ButtonProps;

export const BackBtn = ({ wIcon, iconOnly, ...others }: Props) => {
  const navigate = useNavigate();

  const handleBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback to dashboard if no history (e.g., after page refresh)
      navigate('/dashboard');
    }
  };

  return (
    <Tooltip title="Navigate to previous page">
      <Button
        icon={wIcon || iconOnly ? <LeftOutlined /> : null}
        onClick={handleBack}
        {...others}
      >
        {!iconOnly && 'Go back'}
      </Button>
    </Tooltip>
  );
};
