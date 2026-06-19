import { toFormData } from '../utils/formDataHelper';
import { api } from './api';
import type { Tag } from './tagsApi';

// ─── Types (from KNOWLEDGE_BASE_API_UI_DEVELOPER.md - N-level nested folders) ───

/** Minimal folder reference (for parent/parents arrays) */
export interface KnowledgeBaseFolderRef {
  _id: string;
  name: string;
}

/** Full folder object with N-level nesting support */
export interface KnowledgeBaseFolder {
  _id: string;
  organization: string;
  name: string;
  parent: KnowledgeBaseFolderRef | null; // Immediate parent folder or null for root
  parents: KnowledgeBaseFolderRef[]; // Ordered ancestors [root, ..., grandparent, parent] for breadcrumbs
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface KnowledgeBaseDocument {
  _id: string;
  organization: string;
  title: string;
  filePath: string;
  mimeType: string | null;
  folder: KnowledgeBaseFolder | null;
  tags: Tag[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  url: string;
}

export interface ListMetadata {
  count: number;
  page: number;
  perPage: number;
}

export interface ListViewResponse {
  success: boolean;
  message: string;
  data: {
    metadata: ListMetadata;
    records: KnowledgeBaseDocument[];
  };
}

export interface DocumentResponse {
  success: boolean;
  message: string;
  data: { document: KnowledgeBaseDocument };
}

export interface CreateDocumentDto {
  file: File;
  title: string;
  folder?: string | null;
  tags?: string[];
}

export interface UpdateDocumentDto {
  title?: string;
  folder?: string | null;
  tags?: string[];
}

// ─── Folder Types ────────────────────────────────────────────────────────────
export interface FolderListResponse {
  success: boolean;
  message: string;
  data: {
    metadata: ListMetadata;
    records: KnowledgeBaseFolder[];
  };
}

export interface FolderResponse {
  success: boolean;
  message: string;
  data: { folder: KnowledgeBaseFolder };
}

export interface CreateFolderDto {
  name: string;
  parent?: string | null; // Parent folder ID or null/omit for root folder
}

export interface UpdateFolderDto {
  name?: string;
  parent?: string | null; // New parent folder ID, null or empty string for root
}

/** Build download URL from document.url; prepend API base per API doc. */
export function getDocumentDownloadUrl(doc: { url: string }): string {
  const base = String(import.meta.env.VITE_API_URL || window.location.origin).replace(
    /\/api\/v1\/?$/,
    ''
  );
  return doc.url.startsWith('http') ? doc.url : `${base}${doc.url}`;
}

// ─── API ───────────────────────────────────────────────────────────────────
export const knowledgeBaseApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ─── Folders (N-level nesting support) ─────────────────────────────────────
    
    // List folders
    // - parent=undefined: returns all folders
    // - parent='': returns root folders only (no parent)
    // - parent=<folderId>: returns subfolders of that folder
    getKnowledgeBaseFolders: build.query<
      FolderListResponse,
      {
        parent?: string; // undefined=all, ''=root only, folderId=subfolders
        page?: number;
        perPage?: number;
        sortBy?: string;
        order?: 'asc' | 'desc';
      }
    >({
      query: ({ parent, page = 1, perPage = 100, sortBy = 'createdAt', order = 'asc' }) => {
        const params: Record<string, string | number> = { page, perPage, sortBy, order };
        // Only add parent param if it's defined (including empty string for root folders)
        if (parent !== undefined) params.parent = parent;
        return {
          url: '/knowledge-base/folders',
          method: 'GET',
          params,
        };
      },
      providesTags: (result) =>
        result?.data?.records?.length
          ? [
              ...result.data.records.map((r) => ({ type: 'KnowledgeBase' as const, id: `FOLDER_${r._id}` })),
              { type: 'KnowledgeBase', id: 'FOLDER_LIST' },
            ]
          : [{ type: 'KnowledgeBase', id: 'FOLDER_LIST' }],
    }),

    // Get folder by ID (includes parent and parents for breadcrumbs)
    getKnowledgeBaseFolder: build.query<FolderResponse, string>({
      query: (id) => ({ url: `/knowledge-base/folders/${id}`, method: 'GET' }),
      providesTags: (_r, _e, id) => [{ type: 'KnowledgeBase', id: `FOLDER_${id}` }],
    }),

    // Create folder (supports parent for nesting)
    createKnowledgeBaseFolder: build.mutation<FolderResponse, CreateFolderDto>({
      query: ({ name, parent }) => {
        const body: Record<string, string | undefined> = { name };
        if (parent) body.parent = parent;
        return {
          url: '/knowledge-base/folders',
          method: 'POST',
          body: toFormData(body), // JSON body per API docs
        };
      },
      invalidatesTags: [
        { type: 'KnowledgeBase', id: 'FOLDER_LIST' },
      ],
    }),

    // Update folder (name and/or parent - moving folder)
    updateKnowledgeBaseFolder: build.mutation<FolderResponse, { id: string; body: UpdateFolderDto }>({
      query: ({ id, body }) => ({
        url: `/knowledge-base/folders/${id}`,
        method: 'PUT',
        body: toFormData(body), // JSON body per API docs
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'KnowledgeBase', id: `FOLDER_${id}` },
        { type: 'KnowledgeBase', id: 'FOLDER_LIST' },
        { type: 'KnowledgeBase', id: 'LIST' },
      ],
    }),

    // Delete folder (soft delete - documents become uncategorized)
    deleteKnowledgeBaseFolder: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/knowledge-base/folders/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'KnowledgeBase', id: `FOLDER_${id}` },
        { type: 'KnowledgeBase', id: 'FOLDER_LIST' },
        { type: 'KnowledgeBase', id: 'LIST' },
      ],
    }),

    // ─── Documents ───────────────────────────────────────────────────────────
    
    // List documents (paginated)
    // - folder=<folderId>: returns documents in that folder
    // - folder=undefined + all=true: returns all documents (root level list view)
    // - folder=undefined + no all: returns uncategorized documents (no folder)
    getKnowledgeBaseDocuments: build.query<
      ListViewResponse,
      {
        page?: number;
        perPage?: number;
        sortBy?: string;
        order?: 'asc' | 'desc';
        folder?: string;
        all?: boolean; // When true at root level, returns all documents
      }
    >({
      query: ({ page = 1, perPage = 20, sortBy = 'createdAt', order = 'asc', folder, all }) => {
        const params: Record<string, string | number | boolean> = {
          page,
          perPage,
          sortBy,
          order,
        };
        if (folder) {
          params.folder = folder;
        } else if (all) {
          // At root level with list view, get all documents
          params.all = 'true';
        }
        return { url: '/knowledge-base', method: 'GET', params };
      },
      providesTags: (result) =>
        result?.data?.records?.length
          ? [
              ...result.data.records.map((r) => ({ type: 'KnowledgeBase' as const, id: r._id })),
              { type: 'KnowledgeBase', id: 'LIST' },
            ]
          : [{ type: 'KnowledgeBase', id: 'LIST' }],
    }),

    // Get document by ID
    getKnowledgeBaseDocument: build.query<DocumentResponse, string>({
      query: (id) => ({ url: `/knowledge-base/${id}`, method: 'GET' }),
      providesTags: (_r, _e, id) => [{ type: 'KnowledgeBase', id }],
    }),

    // Create document (multipart: file, title, folder?, tags?)
    createKnowledgeBaseDocument: build.mutation<DocumentResponse, CreateDocumentDto>({
      query: ({ file, title, folder, tags }) => {
        const form = new FormData();
        form.append('file', file);
        form.append('title', title);
        if (folder) {
          form.append('folder', folder);
        }
        if (tags && tags.length > 0) {
          form.append('tags', JSON.stringify(tags));
        }
        return {
          url: '/knowledge-base',
          method: 'POST',
          body: form,
        };
      },
      invalidatesTags: [{ type: 'KnowledgeBase', id: 'LIST' }],
    }),

    // Update document (title, folder, tags - no file re-upload)
    // Uses JSON body per API docs (Content-Type: application/json)
    updateKnowledgeBaseDocument: build.mutation<
      DocumentResponse,
      { id: string; body: UpdateDocumentDto }
    >({
      query: ({ id, body }) => ({
        url: `/knowledge-base/${id}`,
        method: 'PUT',
        body: toFormData(body), // JSON body per API docs
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'KnowledgeBase', id },
        { type: 'KnowledgeBase', id: 'LIST' },
      ],
    }),

    // Delete document (soft delete)
    deleteKnowledgeBaseDocument: build.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({ url: `/knowledge-base/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'KnowledgeBase', id },
        { type: 'KnowledgeBase', id: 'LIST' },
      ],
    }),

    // Move document to folder (PUT /knowledge-base/:_id/folder)
    moveKnowledgeBaseDocumentToFolder: build.mutation<
      DocumentResponse,
      { id: string; folder: string | null }
    >({
      query: ({ id, folder }) => ({
        url: `/knowledge-base/${id}/folder`,
        method: 'PUT',
        body: toFormData({ folder }),
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'KnowledgeBase', id },
        { type: 'KnowledgeBase', id: 'LIST' },
        { type: 'KnowledgeBase', id: 'FOLDER_LIST' },
      ],
    }),
  }),
});

export const {
  // Folders (N-level nesting)
  useGetKnowledgeBaseFoldersQuery,
  useLazyGetKnowledgeBaseFoldersQuery,
  useGetKnowledgeBaseFolderQuery,
  useLazyGetKnowledgeBaseFolderQuery,
  useCreateKnowledgeBaseFolderMutation,
  useUpdateKnowledgeBaseFolderMutation,
  useDeleteKnowledgeBaseFolderMutation,
  // Documents
  useGetKnowledgeBaseDocumentsQuery,
  useLazyGetKnowledgeBaseDocumentsQuery,
  useGetKnowledgeBaseDocumentQuery,
  useLazyGetKnowledgeBaseDocumentQuery,
  useCreateKnowledgeBaseDocumentMutation,
  useUpdateKnowledgeBaseDocumentMutation,
  useDeleteKnowledgeBaseDocumentMutation,
  useMoveKnowledgeBaseDocumentToFolderMutation,
} = knowledgeBaseApi;
