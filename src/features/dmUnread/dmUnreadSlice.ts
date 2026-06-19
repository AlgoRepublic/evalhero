import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DMUnreadState {
  /** channelId -> unread count. New messages in channels not currently open. */
  byChannelId: Record<string, number>;
}

const initialState: DMUnreadState = {
  byChannelId: {},
};

export const dmUnreadSlice = createSlice({
  name: 'dmUnread',
  initialState,
  reducers: {
    incrementUnread: (state, action: PayloadAction<string>) => {
      const channelId = action.payload;
      state.byChannelId[channelId] = (state.byChannelId[channelId] ?? 0) + 1;
    },
    clearUnread: (state, action: PayloadAction<string>) => {
      const channelId = action.payload;
      delete state.byChannelId[channelId];
    },
  },
});

export const { incrementUnread, clearUnread } = dmUnreadSlice.actions;
export const dmUnreadReducer = dmUnreadSlice.reducer;

export const selectUnreadCount = (state: { dmUnread: DMUnreadState }, channelId: string | undefined): number =>
  channelId ? (state.dmUnread?.byChannelId?.[channelId] ?? 0) : 0;

export const selectUnreadByChannelId = (state: { dmUnread: DMUnreadState }) =>
  state.dmUnread?.byChannelId ?? {};
