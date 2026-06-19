import { usePageContext } from './usePageContext.tsx';
import useFetchData from './useFetchData.tsx';

// src/hooks.ts
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store.ts';
// import type { RootState, AppDispatch } from './app/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;


export { usePageContext, useFetchData };
export { useAssetUrl } from './useAssetUrl';
export {
  usePermission,
  useAnyPermission,
  useAllPermissions,
  usePermissions,
} from './usePermission';
