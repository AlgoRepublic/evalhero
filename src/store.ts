
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import themeReducer, { ThemeState } from './features/theme/themeSlice';
import authReducer from "./features/auth/authSlice";
import socketReducer from './features/socket/socketSlice';
import { dmOnlineStatusReducer } from './features/dmOnlineStatus/dmOnlineStatusSlice';
import { dmUnreadReducer } from './features/dmUnread/dmUnreadSlice';
import { persistReducer, persistStore, PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { api } from './services/api'; // <-- import your RTK Query base API
import './services/assetsApi'; // register asset URL endpoint

// Define the state shape
interface RootState {
  theme: ThemeState;
  auth: ReturnType<typeof authReducer>;
  socket: ReturnType<typeof socketReducer>;
  dmOnlineStatus: ReturnType<typeof dmOnlineStatusReducer>;
  dmUnread: ReturnType<typeof dmUnreadReducer>;
  [api.reducerPath]: ReturnType<typeof api.reducer>;
}

// Combine reducers (including RTK Query api.reducer)
const rootReducer = combineReducers({
  theme: themeReducer,
  auth: authReducer,
  socket: socketReducer,
  dmOnlineStatus: dmOnlineStatusReducer,
  dmUnread: dmUnreadReducer,
  [api.reducerPath]: api.reducer,
});

// Persist config with RootState
const persistConfig: PersistConfig<RootState> = {
  key: 'root',
  storage,
  version: 1,
  blacklist: [api.reducerPath, 'dmOnlineStatus', 'dmUnread'], // ⚠️ do not persist RTK Query cache; dmOnlineStatus refetched on org change; dmUnread per session
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store with persisted reducer
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(api.middleware), // add RTK Query middleware
});

// Persistor
export const persistor = persistStore(store);

// Type for RootState
export type { RootState };
export type AppDispatch = typeof store.dispatch;


// import { configureStore, combineReducers } from '@reduxjs/toolkit';
// import themeReducer, { ThemeState } from './theme/themeSlice';
// import authReducer from './auth/authSlice';
// import { persistReducer, persistStore, PersistConfig } from 'redux-persist';
// import storage from 'redux-persist/lib/storage';

// // Define the state shape
// interface RootState {
//   theme: ThemeState;
//   auth: AuthState
// }

// // Combine reducers
// const rootReducer = combineReducers({
//   theme: themeReducer,
//   auth: authReducer
// });

// // Persist config with RootState
// const persistConfig: PersistConfig<RootState> = {
//   key: 'root',
//   storage,
//   version: 1,
// };

// const persistedReducer = persistReducer(persistConfig, rootReducer);

// // Configure store with persisted reducer
// export const store = configureStore({
//   reducer: persistedReducer,
//   middleware: (getDefaultMiddleware) =>
//     getDefaultMiddleware({
//       serializableCheck: false,
//     }),
// });

// // Persistor
// export const persistor = persistStore(store);

// // Type for RootState
// export type { RootState };
