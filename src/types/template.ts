export interface TemplateFormData {
  name: string;
  code: string;
  description: string;
  hasApproval: boolean;
  hasDisputes: boolean;
  signatureRequired: boolean;
}

export interface TemplateMeta {
  name: string;
  code: string;
  description: string;
  hasApproval: boolean;
  hasDisputes: boolean;
  signatureRequired: boolean;
}

export interface TiptapInstance {
  editor: any;
  getJSON: () => any;
  setJSON: (json: any) => void;
  destroy: () => void;
}

export type EditingNodePayload = {
  attrs: Record<string, any>;
  type: string;
  updateAttributes: (attrs: Record<string, any>) => void;
  deleteNode: () => void;
};