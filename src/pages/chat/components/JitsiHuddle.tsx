import { useEffect, useRef, useState } from 'react';
import { Layout, Typography, Button, Space, Card, message, theme } from 'antd';
import { CloseOutlined, CopyOutlined, ShareAltOutlined } from '@ant-design/icons';
// Utility function for copying to clipboard
const copyToClipboard = async (text: string) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
};

const { Header, Content } = Layout;
const { Text, Title } = Typography;

interface JitsiHuddleProps {
  roomId: string;
  channelId: string;
  onClose: () => void;
}

export const JitsiHuddle = ({ roomId, channelId, onClose }: JitsiHuddleProps) => {
  const { token } = theme.useToken();
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const [jitsiLoaded, setJitsiLoaded] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  console.log('channelId', channelId);
  useEffect(() => {
    // Generate meeting link
    const link = `${window.location.origin}/chat/huddle/${roomId}`;
    setMeetingLink(link);

    // Load Jitsi Meet SDK
    const loadJitsi = async () => {
      try {
        // In production, you would use the Jitsi Meet SDK
        // For demo purposes, we'll show a placeholder
        // You can install: npm install @jitsi/react-sdk
        
        // Example with Jitsi Meet iframe API (simpler for demo)
        if (jitsiContainerRef.current) {
          const domain = 'meet.jit.si'; // Use your own Jitsi domain in production
          const options = {
            roomName: roomId,
            width: '100%',
            height: '100%',
            parentNode: jitsiContainerRef.current,
            configOverwrite: {
              startWithAudioMuted: false,
              startWithVideoMuted: false,
            },
            interfaceConfigOverwrite: {
              TOOLBAR_BUTTONS: [
                'microphone',
                'camera',
                'closedcaptions',
                'desktop',
                'fullscreen',
                'fodeviceselection',
                'hangup',
                'profile',
                'chat',
                'recording',
                'livestreaming',
                'settings',
                'raisehand',
                'videoquality',
                'filmstrip',
                'invite',
                'feedback',
                'stats',
                'shortcuts',
                'tileview',
                'videobackgroundblur',
                'download',
                'help',
                'mute-everyone',
                'security',
              ],
            },
          };

          // Load Jitsi Meet iframe API
          const script = document.createElement('script');
          script.src = `https://${domain}/external_api.js`;
          script.async = true;
          script.onload = () => {
            // @ts-ignore - JitsiMeetExternalAPI is loaded dynamically
            const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;
            if (JitsiMeetExternalAPI) {
              const api = new JitsiMeetExternalAPI(domain, options);
              setJitsiLoaded(true);

              api.addEventListener('readyToClose', () => {
                onClose();
              });

              api.addEventListener('participantLeft', (participant: any) => {
                console.log('Participant left:', participant);
              });

              api.addEventListener('participantJoined', (participant: any) => {
                console.log('Participant joined:', participant);
              });
            }
          };
          document.body.appendChild(script);
        }
      } catch (error) {
        console.error('Error loading Jitsi:', error);
        message.error('Failed to load video meeting');
      }
    };

    loadJitsi();

    return () => {
      // Cleanup
      if (jitsiContainerRef.current) {
        jitsiContainerRef.current.innerHTML = '';
      }
    };
  }, [roomId, onClose]);

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(meetingLink);
      message.success('Meeting link copied to clipboard!');
    } catch (error) {
      message.error('Failed to copy link');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join the huddle',
        text: 'Join me in this huddle',
        url: meetingLink,
      });
    } else {
      handleCopyLink();
    }
  };

  return (
    <Layout style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header
        style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            Huddle
          </Title>
          <Text type="secondary">Room: {roomId}</Text>
        </Space>
        <Space>
          <Button icon={<CopyOutlined />} onClick={handleCopyLink}>
            Copy Link
          </Button>
          <Button icon={<ShareAltOutlined />} onClick={handleShare}>
            Share
          </Button>
          <Button type="primary" danger icon={<CloseOutlined />} onClick={onClose}>
            Leave
          </Button>
        </Space>
      </Header>
      <Content style={{ flex: 1, position: 'relative', background: '#000' }}>
        {!jitsiLoaded && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            <Text style={{ color: '#fff', fontSize: '16px' }}>
              Loading video meeting...
            </Text>
          </div>
        )}
        <div
          ref={jitsiContainerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: '500px',
          }}
        />
        {!jitsiLoaded && (
          <Card
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              right: '20px',
              maxWidth: '400px',
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Join the huddle</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Share this link with others to join: {meetingLink}
              </Text>
              <Button type="primary" block onClick={handleCopyLink}>
                Copy Link
              </Button>
            </Space>
          </Card>
        )}
      </Content>
    </Layout>
  );
};

