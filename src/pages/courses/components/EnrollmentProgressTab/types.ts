import { PageProgress, CourseProgress } from '../../../../types/course';

export interface PageTableData {
  key: string;
  pageId: string;
  title: string;
  order: number;
  status: string;
  isUnlocked: boolean;
  isRead: boolean;
  timeOnTask: number;
  inlineForms: Array<{ isFilled: boolean }>;
}

export interface PageRef {
  _id: string;
  title: string;
}

export type { PageProgress, CourseProgress };
