import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { MessageOutlined } from '@ant-design/icons';
import { ChatLayout } from './components/ChatLayout';
import { Grid } from 'antd';

const { useBreakpoint } = Grid;

export const ChatPage = () => {
  const screens = useBreakpoint();
  const isMd = screens.md || screens.lg || screens.xl || screens.xxl;
  
  return (
    <>
      <Helmet>
        <title>Chat - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Chat"
        breadcrumbs={[
          {
            title: (
              <>
                <MessageOutlined />
                <span>Chat</span>
              </>
            ),
          },
        ]}
      />
      <div 
        style={{ 
          height: isMd ? 'calc(100vh - 200px)' : 'calc(100vh - 160px)', 
          margin: isMd ? '16px' : '8px',
          minHeight: '400px',
        }}
      >
        <ChatLayout />
      </div>
    </>
  );
};

