import { JSONContent } from '@tiptap/core';

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
};

export const parseCanvasContent = (canvasDocId: unknown): JSONContent | null => {
  try {
    if (typeof canvasDocId === 'string') {
      return JSON.parse(canvasDocId);
    }
    if (typeof canvasDocId === 'object' && canvasDocId !== null) {
      if ('canvasSchema' in canvasDocId) {
        return (canvasDocId as { canvasSchema: JSONContent }).canvasSchema;
      }
      return canvasDocId as JSONContent;
    }
    return null;
  } catch {
    return null;
  }
};
