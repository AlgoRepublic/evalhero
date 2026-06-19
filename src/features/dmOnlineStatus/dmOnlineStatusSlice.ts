import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DMOnlineStatusState {
  /** profileId -> isOnline. Tracks organization profiles' online status for DM. */
  byProfileId: Record<string, boolean>;
}

const initialState: DMOnlineStatusState = {
  byProfileId: {},
};

export const dmOnlineStatusSlice = createSlice({
  name: 'dmOnlineStatus',
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<{ profileId: string; isOnline: boolean }>) => {
      const { profileId, isOnline } = action.payload;
      state.byProfileId[profileId] = isOnline;
    },
    setBulk: (state, action: PayloadAction<Array<{ profileId: string; isOnline: boolean }>>) => {
      action.payload.forEach(({ profileId, isOnline }) => {
        state.byProfileId[profileId] = isOnline;
      });
    },
    setBulkFromMap: (state, action: PayloadAction<Record<string, boolean>>) => {
      Object.entries(action.payload).forEach(([profileId, isOnline]) => {
        state.byProfileId[profileId] = isOnline;
      });
    },
    clear: (state) => {
      state.byProfileId = {};
    },
  },
});

export const { setStatus, setBulk, setBulkFromMap, clear } = dmOnlineStatusSlice.actions;
export const dmOnlineStatusReducer = dmOnlineStatusSlice.reducer;

export const selectIsProfileOnline = (state: { dmOnlineStatus: DMOnlineStatusState }, profileId: string | undefined): boolean =>
  Boolean(profileId && state.dmOnlineStatus?.byProfileId?.[profileId]);

export const selectOnlineStatusMap = (state: { dmOnlineStatus: DMOnlineStatusState }) =>
  state.dmOnlineStatus?.byProfileId ?? {};
