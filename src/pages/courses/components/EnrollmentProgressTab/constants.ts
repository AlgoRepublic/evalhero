import { ModuleStatus } from '../../../../types/course';

export const STATUS_COLOR_MAP: Record<ModuleStatus, string> = {
  'not-started': 'warning',
  'in-progress': 'processing',
  'passed': 'success',
  'failed': 'error',
  'locked': 'default',
  'completed': 'success',
};

export const MIN_READ_DURATION = 2; // seconds
export const MARK_AS_READ_DELAY = 2000; // milliseconds
export const PAGE_VIEWER_MIN_HEIGHT = 600;

export const GRADIENT_STYLES = {
  primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  completion: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  completionDark: 'linear-gradient(135deg, #0d7a72 0%, #2bc768 100%)',
  inProgress: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  pages: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  time: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
};
