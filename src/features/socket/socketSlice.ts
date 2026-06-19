import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SocketConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SocketState {
  status: SocketConnectionStatus;
  error: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  reconnectAttempts: number;
}

const initialState: SocketState = {
  status: 'disconnected',
  error: null,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  reconnectAttempts: 0,
};

const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<SocketConnectionStatus>) => {
      state.status = action.payload;
      if (action.payload === 'connected') {
        state.lastConnectedAt = new Date().toISOString();
        state.error = null;
        state.reconnectAttempts = 0;
      } else if (action.payload === 'disconnected') {
        state.lastDisconnectedAt = new Date().toISOString();
      }
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.status = 'error';
      }
    },
    setReconnectAttempts: (state, action: PayloadAction<number>) => {
      state.reconnectAttempts = action.payload;
    },
    reset: () => {
      return initialState;
    },
  },
});

export const { setStatus, setError, setReconnectAttempts, reset } = socketSlice.actions;
export default socketSlice.reducer;
