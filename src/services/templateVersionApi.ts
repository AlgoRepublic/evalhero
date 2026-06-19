import { toFormData } from '../utils/formDataHelper';
import { api } from './api';
import type { JSONContent } from '@tiptap/core';

export interface VisibilityRule {
  field?: string;
  operator?: string;
  value?: unknown;
}

export interface ValidationRule {
  field?: string;
  condition?: string;
  message?: string;
}

export interface ConditionalLogic {
  if?: unknown;
  then?: unknown;
}

export interface TemplateMeta {
  _id: string;
  name: string;
  code: string;
}

export interface FormSettings {
  allowSaveDraft: boolean;
  allowPartialSubmission: boolean;
  showProgressBar: boolean;
  autoSave: boolean;
  autoSaveInterval: number; // in ms
  submitButtonText: string;
  saveDraftButtonText: string;
}

export interface TemplateVersion {
  _id: string;
  templateId: string;
  version: number;
  schema: JSONContent;
  status: 'draft' | 'locked' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersionDetail {
  _id: string;
  status: 'draft' | 'locked' | 'published';
  lockedAt?: string | null;
  deletedAt?: string | null;
  validationRules: ValidationRule[];
  conditionalLogic: ConditionalLogic[];
  template: TemplateMeta;
  version: number;
  createdAt: string;
  updatedAt: string;
  formSchema: JSONContent;
}

export interface TemplateVersionResponse {
  data: { version: TemplateVersionDetail };
  success: boolean;
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Helper – converts TipTap JSON → FormData exactly as Postman does   */
/* ------------------------------------------------------------------ */
// const jsonToFormData = (prefix: string, json: JSONContent): FormData => {
//   const fd = new FormData();

//   const walk = (obj: any, path: string[]) => {
//     if (obj === null || obj === undefined) return;
//     if (Array.isArray(obj)) {
//       obj.forEach((v, i) => walk(v, [...path, `${i}`]));
//     } else if (typeof obj === 'object') {
//       Object.entries(obj).forEach(([k, v]) => walk(v, [...path, k]));
//     } else {
//       const key = path.length ? `${prefix}[${path.join('][')}]` : prefix;
//       fd.append(key, String(obj));
//     }
//   };

//   walk(json, []);
//   return fd;
// };

export const templateVersionApi = api.injectEndpoints({
  endpoints: (build) => ({
    /* ------------------- LIST DRAFTS ------------------- */
    getDraftVersions: build.query<
      { success: boolean; data: TemplateVersion[] },
      { templateId: string }
    >({
      query: ({ templateId }) => ({
        url: `/form-template-versions`,
        params: { templateId, status: 'draft' },
      }),
      providesTags: (_r, _e, { templateId }) => [
        { type: 'TemplateVersion', id: `${templateId}-DRAFT` },
      ],
    }),

    /* ------------------- GET SINGLE ------------------- */
    getVersion: build.query<
      { success: boolean; data: TemplateVersion },
      string
    >({
      query: (versionId) => `/form-template-versions/${versionId}`,
      providesTags: (_r, _e, id) => [{ type: 'TemplateVersion', id }],
    }),

    /* ------------------- LATEST DRAFT ------------------- */
    getLatestDraft: build.query<TemplateVersionResponse, string>({
      query: (templateId) =>
        `/form-template-versions/template/${templateId}/latest`,
      providesTags: (_r, _e, templateId) => [
        { type: 'TemplateVersion', id: `${templateId}-LATEST` },
      ],
    }),

    /* ------------------- CREATE DRAFT ------------------- */
    createDraft: build.mutation<
      { success: boolean; data: TemplateVersion },
      { templateId: string; schema: JSONContent }
    >({
      query: ({ templateId, schema }) => ({
        url: '/form-template-versions',
        method: 'POST',
        // body: jsonToFormData('schema', schema),
        body: toFormData({ templateId, schema: schema }),
      }),
      invalidatesTags: (_r, _e, { templateId }) => [
        { type: 'TemplateVersion', id: `${templateId}-DRAFT` },
        { type: 'TemplateVersion', id: `${templateId}-LATEST` },
      ],
    }),

    /* ------------------- UPDATE DRAFT ------------------- */
    updateDraft: build.mutation<
      { success: boolean; data: TemplateVersion },
      { versionId: string; schema: JSONContent }
    >({
      query: ({ versionId, schema }) => ({
        url: `/form-template-versions/${versionId}`,
        method: 'PUT',
        body: toFormData({ schema: schema }),
        // body: jsonToFormData('schema', schema),
      }),
      invalidatesTags: (_r, _e, { versionId }) => [
        { type: 'TemplateVersion', id: versionId },
      ],
    }),

    /* ------------------- LOCK (PUBLISH) ------------------- */
    lockVersion: build.mutation<
      { success: boolean; data: TemplateVersion },
      string
    >({
      query: (versionId) => ({
        url: `/form-template-versions/${versionId}/lock`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, versionId) => [
        { type: 'TemplateVersion', id: versionId },
      ],
    }),
  }),
});

export const {
  useGetDraftVersionsQuery,
  useGetVersionQuery,
  useGetLatestDraftQuery,
  useCreateDraftMutation,
  useUpdateDraftMutation,
  useLockVersionMutation,
} = templateVersionApi;
