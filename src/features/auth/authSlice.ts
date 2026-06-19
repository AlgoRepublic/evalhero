import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { WasabiStorage } from '../../services/orgApi';
import { Permission } from '../../services/permissionsApi';
import type { OtpDeliveryPreference } from '../../types/auth';

export interface User {
  _id: string;
  avatar?: string;
  isAdmin: boolean;
  deletedAt: string | null;
  name: string;
  email?: string; // Optional – user may have email and/or phone (at least one required on backend)
  phone?: string;
  otpDeliveryPreference?: OtpDeliveryPreference;
  createdAt: string;
  updatedAt: string;
}

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  otpVerified: boolean;
  profiles: Profile[];
  selectedProfile: Profile | null;
  permissions: Permission[];
  permissionCodes: string[];
};

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  otpVerified: false,
  profiles: [],
  selectedProfile: null,
  permissions: [],
  permissionCodes: []
};

export interface Organization {
  _id: string;
  icon: string;
  deletedAt: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  wasabiStorage?: WasabiStorage;
}

export interface Profile {
  _id: string;
  permissionCodes: string[];
  deletedAt: string | null;
  roles: Array<{ role: string; permissionCodes: string[]; _id: string }>;
  departments: Array<{ department: string; permissionCodes: string[]; _id: string }>;
  locations: Array<{ location: string; permissionCodes: string[]; _id: string }>;
  organization: Organization;
  user: string | User;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionCategory {
  entity: string;
  permissions: Permission[];
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        accessToken?: string | null;
        refreshToken?: string | null;
        user?: User | null;
        otpVerified?: boolean;
        profiles?: Profile[];
        selectedProfile?: Profile | null;
      }>
    ) => {
      const {
        accessToken,
        refreshToken,
        user,
        otpVerified,
        profiles,
        selectedProfile,
      } = action.payload;
      if (accessToken !== undefined) {
        state.accessToken = accessToken;
        localStorage.setItem('accessToken', accessToken || '');
      }
      if (refreshToken !== undefined) {
        state.refreshToken = refreshToken;
        localStorage.setItem('refreshToken', refreshToken || '');
      }
      if (user !== undefined) state.user = user;
      if (otpVerified !== undefined) state.otpVerified = otpVerified;

      // ✅ Step 1: Filter only active profiles
      if (profiles !== undefined) {
        state.profiles = [...profiles]
          // .filter(
          //   (p) => p.deletedAt === null // && p.organization.deletedAt === null
          // )
          .sort((a, b) =>
            a.organization.name.localeCompare(b.organization.name)
          );
      }

      // ✅ Step 2: Apply selectedProfile from payload if given
      if (selectedProfile !== undefined) {
        state.selectedProfile = selectedProfile;
      }

      // ✅ Step 3: Sync selectedProfile with latest from profiles
      if (state.selectedProfile) {
        const updated = state.profiles.find(
          (p) => p._id === state.selectedProfile?._id
        );
        state.selectedProfile = updated || null;
      }

      // ✅ Step 4: If no selectedProfile → pick first active
      if (!state.selectedProfile) {
        state.selectedProfile = state.profiles[0] || null;
      }

      // ✅ Step 5: If selectedProfile (or its org) is deleted → switch
      // if (
      //   state.selectedProfile &&
      //   (state.selectedProfile.deletedAt !== null
      //     //  ||  state.selectedProfile.organization.deletedAt !== null
      //   )
      // ) {
      //   const firstActive = state.profiles.find(
      //     (p) => p.deletedAt === null // && p.organization.deletedAt === null
      //   );
      //   state.selectedProfile = firstActive || null;
      // }

      if (state.selectedProfile) {
        const updated = state.profiles.find(
          (p) =>
            p._id === state.selectedProfile?._id 
          // &&
          //   p.deletedAt === null &&
          //   p.organization.deletedAt === null
        );
        state.selectedProfile = updated || null;
      }
    },
     setPermissions: (state, action: PayloadAction<Permission[]>) => {
      state.permissionCodes = action.payload.map((p) => p.code);
      state.permissions = action.payload;
    },
    clearPermissions: (state) => {
      state.permissionCodes = [];
      state.permissions = [];
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.otpVerified = false;
      state.profiles = [];
      state.selectedProfile = null;
      state.permissions = [];
      state.permissionCodes = [];
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
  },
});

export const { setCredentials, logout, clearPermissions, setPermissions } = authSlice.actions;
export default authSlice.reducer;
