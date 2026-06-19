/**
 * DM sidebar: search profiles and list existing DM channels.
 * Renders below the main channel list in ChatLayout (after a divider).
 */
import { useState, useEffect } from 'react';
import { Input, List, theme, Spin, Empty } from 'antd';
import { AssetAvatar } from '../../../components';
import { SearchOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { selectUnreadByChannelId } from '../../../features/dmUnread/dmUnreadSlice';
import {
  useLazySearchDMProfilesQuery,
  useListDMChannelsQuery,
  useCreateOrGetDMChannelMutation,
  type DMChannel,
  type DMProfile,
} from '../../../services/dmchatsApi';


function getProfileDisplayName(p: DMProfile): string {
  const u = p.user;
  if (!u) return 'Unknown';
  if (typeof u === 'object' && u !== null && 'name' in u) return (u as { name?: string }).name ?? (u as { email?: string }).email ?? 'Unknown';
  return 'Unknown';
}

function getOtherParticipant(channel: DMChannel, currentProfileId: string): DMProfile | undefined {
  return channel.participants.find((p) => p._id !== currentProfileId);
}

/** True if channel has activity after current user's last read (from lastReadByParticipants). */
function hasUnreadFromServer(channel: DMChannel, currentProfileId: string | null): boolean {
  if (!currentProfileId) return false;
  const lastReadAt = channel.lastReadByParticipants?.[currentProfileId];
  if (!lastReadAt) return !!channel.lastActivityAt;
  return new Date(channel.lastActivityAt) > new Date(lastReadAt);
}

export interface DMSidebarProps {
  selectedDmChannelId: string | null;
  onSelectDmChannel: (channel: DMChannel) => void;
  onCloseSidebar?: () => void;
}

export function DMSidebar({
  selectedDmChannelId,
  onSelectDmChannel,
  onCloseSidebar,
}: DMSidebarProps) {
  const { token } = theme.useToken();
  const currentProfileId = useSelector((state: RootState) => state.auth.selectedProfile?._id) ?? null;
  const unreadByChannelId = useSelector(selectUnreadByChannelId);
  const [search, setSearch] = useState('');
  const [createOrGetChannel, { isLoading: isCreating }] = useCreateOrGetDMChannelMutation();
  const [searchProfiles, { data: searchResults, isFetching: isSearching }] = useLazySearchDMProfilesQuery();
  const { data: channelsData, isLoading: isLoadingChannels } = useListDMChannelsQuery(undefined, {
    skip: !currentProfileId,
  });

  const channels = channelsData?.channels ?? [];
  const profiles = searchResults?.profiles ?? [];

  useEffect(() => {
    if (!search.trim()) return;
    const t = setTimeout(() => {
      searchProfiles({ search: search.trim(), limit: 15, excludeSelf: true });
    }, 300);
    return () => clearTimeout(t);
  }, [search, searchProfiles]);

  const handleSelectProfile = async (profile: DMProfile) => {
    if (!currentProfileId || profile._id === currentProfileId) return;
    try {
      const result = await createOrGetChannel({ participantIds: [currentProfileId, profile._id] }).unwrap();
      onSelectDmChannel(result.channel);
      setSearch('');
      onCloseSidebar?.();
    } catch (e) {
      console.error('Create/get DM channel failed', e);
    }
  };

  const handleSelectChannel = (channel: DMChannel) => {
    onSelectDmChannel(channel);
    onCloseSidebar?.();
  };

  const showSearchResults = search.trim().length > 0;
  const hasProfiles = profiles.length > 0;

  return (
    <div style={{ height: '100%', minHeight: 0, padding: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
        <Input
          placeholder="Find or start a conversation"
          prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder, fontSize: 14 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          size="middle"
          style={{
            borderRadius: 6,
            backgroundColor: token.colorFillQuaternary ?? 'rgba(0,0,0,.04)',
            border: 'none',
          }}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {showSearchResults ? (
          <div style={{ flexShrink: 0, padding: '0 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: token.colorTextSecondary, padding: '8px 0 4px' }}>
              People
            </div>
            {isSearching ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                <Spin size="small" />
              </div>
            ) : !hasProfiles ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No people found" style={{ marginTop: 8 }} />
            ) : (
              <List
                size="small"
                dataSource={profiles}
                split={false}
                style={{ border: 'none' }}
                renderItem={(p) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: 'none',
                    }}
                    onClick={() => handleSelectProfile(p)}
                  >
                    <List.Item.Meta
                      avatar={
                        <AssetAvatar avatarKey={(p.user as { avatar?: string })?.avatar} size={32} />
                      }
                      title={<span style={{ fontSize: 15 }}>{getProfileDisplayName(p)}</span>}
                      description={(p.user as { email?: string })?.email}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: token.colorTextSecondary,
                padding: '12px 12px 4px',
                letterSpacing: '0.02em',
              }}
            >
              Direct messages
            </div>
            {isLoadingChannels ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                <Spin size="small" />
              </div>
            ) : channels.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No conversations yet"
                style={{ marginTop: 12, marginBottom: 12 }}
              />
            ) : (
              <List
                size="small"
                dataSource={channels}
                split={false}
                style={{ border: 'none', padding: '0 4px' }}
                renderItem={(channel) => {
                  const other = currentProfileId ? getOtherParticipant(channel, currentProfileId) : undefined;
                  const name = other ? getProfileDisplayName(other) : 'Unknown';
                  const isSelected = selectedDmChannelId === channel._id;
                  const clientUnread = unreadByChannelId[channel._id] ?? 0;
                  const serverHasUnread = hasUnreadFromServer(channel, currentProfileId);
                  const unreadCount = isSelected ? 0 : (clientUnread > 0 ? clientUnread : (serverHasUnread ? 1 : 0));
                  const hasUnread = unreadCount > 0;

                  return (
                    <List.Item
                      style={{
                        cursor: 'pointer',
                        padding: '6px 12px',
                        borderRadius: 6,
                        marginBottom: 2,
                        backgroundColor: isSelected ? token.colorPrimaryBg : 'transparent',
                        border: 'none',
                      }}
                      onClick={() => handleSelectChannel(channel)}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <AssetAvatar
                              avatarKey={other?.user?.avatar}
                              size={32}
                              style={
                                isSelected
                                  ? { backgroundColor: token.colorPrimary }
                                  : { backgroundColor: token.colorFill }
                              }
                            />
                            {hasUnread && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: token.colorPrimary,
                                  border: `2px solid ${token.colorBgContainer}`,
                                  boxSizing: 'content-box',
                                }}
                              />
                            )}
                          </div>
                        }
                        title={
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              fontWeight: hasUnread || isSelected ? 600 : 400,
                              fontSize: 15,
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name}
                            </span>
                            {hasUnread && (
                              <span
                                style={{
                                  flexShrink: 0,
                                  minWidth: 18,
                                  height: 18,
                                  borderRadius: 9,
                                  background: token.colorPrimary,
                                  color: '#fff',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </span>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </>
        )}
      </div>
      {isCreating && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <Spin />
        </div>
      )}
    </div>
  );
}
