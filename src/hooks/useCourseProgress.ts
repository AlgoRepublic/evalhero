import { useCallback } from 'react';
import { message } from 'antd';
import {
  useMarkPageAsReadMutation,
  useSubmitFormMutation,
} from '../services/coursesApi';

/**
 * Hook for tracking course progress
 * Use this hook to mark pages as read and record form submissions
 */
export function useCourseProgress(
  courseId: string,
  courseEnrolmentId: string | null
) {
  const [markPageAsRead] = useMarkPageAsReadMutation();
  const [submitForm] = useSubmitFormMutation();

  const trackPageRead = useCallback(
    async (
      pageId: string,
      readDuration?: number,
      status?: 'in-progress' | undefined
    ) => {
      if (!courseEnrolmentId) {
        console.warn('Cannot track page read: courseEnrolmentId is missing');
        return;
      }

      console.log("trackPageRead", pageId, readDuration, status);

      try {
        await markPageAsRead({
          courseId,
          pageId,
          courseEnrolmentId,
          readDuration,
          status,
        }).unwrap();
      } catch (error: any) {
        console.error('Failed to mark page as read:', error);
        message.error(
          error?.data?.message || 'Failed to track page reading progress'
        );
      }
    },
    [courseId, courseEnrolmentId, markPageAsRead]
  );

  const trackFormSubmission = useCallback(
    async (
      pageId: string,
      formBlockId: string,
      formData: {
        submissionId?: string;
        isFilled: boolean;
        score?: number;
        passed?: boolean;
        approvalStatus?: 'not-required' | 'pending' | 'approved' | 'rejected';
      }
    ) => {
      if (!courseEnrolmentId) {
        console.warn('Cannot track form submission: courseEnrolmentId is missing');
        return;
      }

      try {
        await submitForm({
          courseId,
          pageId,
          formBlockId,
          courseEnrolmentId,
          ...formData,
        }).unwrap();
      } catch (error: any) {
        console.error('Failed to track form submission:', error);
        const errorMessage =
          error?.data?.message || 'Failed to track form submission';
        message.error(errorMessage);

        // Re-throw to allow caller to handle the error
        throw error;
      }
    },
    [courseId, courseEnrolmentId, submitForm]
  );

  return {
    trackPageRead,
    trackFormSubmission,
  };
}
