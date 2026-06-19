/**
 * Analytics Web Worker
 * 
 * Handles heavy normalization and aggregation work off the main thread.
 * Receives raw analytics payload and returns normalized records + metadata.
 * 
 * Note: Workers cannot pass Maps/functions directly. All data is converted
 * to plain objects/arrays at the boundary.
 */

// ----- Inline types (duplicated from analyticsApi.ts for worker isolation) -----

interface QueueSubmission {
  _id?: string;
  assignment?: string | { _id: string };
  assignee?: string | { _id: string; user?: string | { name?: string } };
  subject?: string | { _id: string };
  formTemplateSchema?: string | { _id: string };
  status?: string;
  approvalStatus?: string;
  disputeStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  answers?: unknown;
}

interface Assignment {
  _id: string;
  formTemplate?: string | { _id: string };
  formTemplateSchema?: string | { _id: string; version?: number };
  submitMeta?: {
    globalGroups?: Array<{ name?: string; subjectIds?: string[] }>;
    ungroupedSubjects?: Array<{ id?: string; name?: string }>;
  };
}

interface Tag {
  _id: string;
  name: string;
  deletedAt?: string | null;
}

interface Template {
  _id: string;
  name: string;
}

interface Schema {
  _id: string;
  version?: number;
  formTemplate: string;
}

interface ProfileData {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
}

interface AnalyticsRawPayload {
  submissions: QueueSubmission[];
  assignments: Assignment[];
  schemas: Schema[];
  templates: Template[];
  tags: Tag[];
  profiles: ProfileData[];
}

// ----- Types for worker communication -----

export interface WorkerNormalizeInput {
  payload: AnalyticsRawPayload;
  profileLookup: Record<string, ProfileData>;
}

export interface NormalizedAnswerWorker {
  questionId: string;
  prompt: string;
  qtype: string;
  value: string | number | boolean | null;
  valueRaw: string;
  tags: string[];
  pointsEarned: number;
  pointsPossible: number;
  passEarned: number;
  passPossible: number;
}

export interface NormalizedRecordWorker {
  submissionId: string;
  templateId: string | null;
  templateName: string;
  schemaId: string;
  schemaVersion: number | null;
  assignmentId: string;
  subjectId: string;
  subjectDisplay: string;
  assigneeId: string;
  assigneeDisplay: string;
  status: string;
  approvalStatus: string;
  disputeStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
  finalizedAt: string | null;
  isApproved: boolean;
  answers: NormalizedAnswerWorker[];
  tagTotals: Array<[string, { earned: number; possible: number; passEarned: number; passPossible: number }]>;
  pointsEarnedTotal: number;
  pointsPossibleTotal: number;
  pointsPct: number | null;
  passEarnedTotal: number;
  passPossibleTotal: number;
  passPct: number | null;
}

export interface WorkerNormalizeOutput {
  records: NormalizedRecordWorker[];
  meta: {
    tagName: Array<[string, string]>;
    subjectName: Array<[string, string]>;
    templateName: Array<[string, string]>;
    schemaMeta: Array<[string, { version: number | null; templateId: string }]>;
    baseline: Array<[string, NormalizedRecordWorker]>;
  };
}

// ----- Helper functions -----

function odate(v: unknown): string | null {
  if (v == null) return null;
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function getIdFromRef(ref: string | { _id: string } | null | undefined): string {
  if (ref == null) return '';
  return typeof ref === 'string' ? ref : String(ref._id ?? '');
}

function shortId(id: string | null | undefined): string {
  return id && String(id).length > 8 ? String(id).slice(-6) : String(id ?? '—');
}

function isTrue(v: unknown): boolean {
  return String(v).toLowerCase() === 'true';
}

function num(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

interface JsonNode {
  type?: string;
  content?: JsonNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string }>;
}

function extractText(kids: JsonNode[] | undefined): string {
  if (!kids) return '';
  const parts: string[] = [];
  for (const k of kids) {
    if (k.text) parts.push(k.text);
    if (k.content) parts.push(extractText(k.content));
  }
  return parts.join(' ');
}

function buildSubjectDisplay(
  assignments: Assignment[],
  profileLookup: Record<string, ProfileData>
): (subjectId: string) => string {
  const subjectName = new Map<string, string>();
  const subjectGroup = new Map<string, string>();

  for (const a of assignments) {
    const sm = a.submitMeta ?? {};
    const groups = sm.globalGroups ?? [];
    const ungrouped = sm.ungroupedSubjects ?? [];

    for (const g of groups) {
      const gName = g?.name ? `Group: ${g.name}` : 'Group';
      for (const sid of g.subjectIds ?? []) {
        const id = String(sid);
        if (!subjectGroup.has(id)) subjectGroup.set(id, gName);
      }
    }
    for (const u of ungrouped) {
      const id = String(u?.id ?? '');
      if (!id) continue;
      const name = (u?.name ?? '').trim();
      if (name) subjectName.set(id, name);
    }
  }

  return (subjectId: string) => {
    const id = String(subjectId ?? '');
    if (!id) return '—';
    
    // Priority 1: Profile name from profile lookup
    const profile = profileLookup[id];
    if (profile && profile.name && String(profile.name).trim()) {
      return String(profile.name).trim();
    }
    
    // Priority 2: Subject name from assignment submitMeta
    if (subjectName.has(id)) return subjectName.get(id)!;
    
    // Priority 3: Subject group + short ID
    if (subjectGroup.has(id)) return `${subjectGroup.get(id)} • ${shortId(id)}`;
    
    // Priority 4: Short ID fallback
    return `Subject • ${shortId(id)}`;
  };
}

function getAssigneeDisplay(
  assigneeRef: string | { _id: string; user?: string | { name?: string } } | null | undefined,
  assigneeId: string,
  profileLookup: Record<string, ProfileData>
): string {
  // Try to get the actual profile ID
  let profileId = assigneeId;
  if (assigneeRef && typeof assigneeRef === 'object' && '_id' in assigneeRef) {
    profileId = String(assigneeRef._id);
  }
  
  // Priority 1: Profile name
  const profile = profileLookup[profileId];
  if (profile && profile.name && String(profile.name).trim()) {
    return String(profile.name).trim();
  }
  
  // Fallback to existing logic
  if (assigneeRef == null || typeof assigneeRef === 'string') return `Assignee • ${shortId(assigneeId)}`;
  const user = assigneeRef.user;
  const name = typeof user === 'object' && user && 'name' in user ? user.name : undefined;
  return (name && String(name).trim()) || `Assignee • ${shortId(assigneeId)}`;
}

function getSubmissionContent(sub: { answers?: unknown }): JsonNode[] {
  let answers = sub?.answers;
  if (answers == null) return [];
  if (typeof answers === 'string') {
    try {
      answers = JSON.parse(answers) as unknown;
    } catch {
      return [];
    }
  }
  if (typeof answers === 'object' && Array.isArray((answers as { content?: JsonNode[] }).content)) {
    return (answers as { content: JsonNode[] }).content;
  }
  if (Array.isArray(answers)) return answers as JsonNode[];
  const data = (answers as { data?: { content?: JsonNode[] } })?.data;
  if (data && Array.isArray(data.content)) return data.content;
  return [];
}

// ----- Main normalization function -----

function normalizePayload(
  raw: AnalyticsRawPayload,
  profileLookup: Record<string, ProfileData>
): WorkerNormalizeOutput {
  const assignmentsById = new Map<string, Assignment>();
  
  for (const a of raw.assignments) {
    assignmentsById.set(String(a._id ?? ''), a);
  }
  
  const subjectDisplayFn = buildSubjectDisplay(raw.assignments, profileLookup);

  // Build metadata maps (as arrays for serialization)
  const tagNameArr: Array<[string, string]> = [];
  for (const t of raw.tags ?? []) {
    const id = String(t._id ?? '');
    if (!id || t.deletedAt) continue;
    tagNameArr.push([id, String(t.name || `Tag • ${shortId(id)}`)]);
  }

  const templateNameArr: Array<[string, string]> = [];
  for (const t of raw.templates) {
    const tid = String(t._id ?? '');
    templateNameArr.push([tid, t.name || `Template • ${shortId(tid)}`]);
  }

  const schemaMetaArr: Array<[string, { version: number | null; templateId: string }]> = [];
  for (const s of raw.schemas) {
    const sid = String(s._id ?? '');
    schemaMetaArr.push([sid, {
      version: s.version ?? null,
      templateId: String(s.formTemplate ?? ''),
    }]);
  }

  const templateNameMap = new Map(templateNameArr);
  const schemaMetaMap = new Map(schemaMetaArr);

  const recs: NormalizedRecordWorker[] = [];

  for (const sub of raw.submissions) {
    const submissionId = String(sub._id ?? '');
    const assignmentId = getIdFromRef(sub.assignment);
    const assigneeId = getIdFromRef(sub.assignee);
    const subjectId = getIdFromRef(sub.subject);
    const schemaId = getIdFromRef(sub.formTemplateSchema);

    const assignment = assignmentsById.get(assignmentId);
    const templateId = assignment
      ? String(
          typeof assignment.formTemplate === 'object'
            ? assignment.formTemplate?._id ?? ''
            : (assignment.formTemplate as string) ?? ''
        )
      : schemaMetaMap.get(schemaId)?.templateId ?? null;
    const templateName = templateId
      ? templateNameMap.get(templateId) || `Template • ${shortId(templateId)}`
      : '—';
    const schemaVersion = schemaMetaMap.get(schemaId)?.version ?? null;

    const createdAt = odate(sub.createdAt);
    const updatedAt = odate(sub.updatedAt);
    const isApproved = String(sub.approvalStatus ?? '').toLowerCase() === 'approved';
    const finalizedAt = isApproved ? updatedAt : null;

    const subjectDisplayName = subjectDisplayFn(subjectId);
    const assigneeDisplayName = getAssigneeDisplay(sub.assignee as { _id: string; user?: string | { name?: string } } | undefined, assigneeId, profileLookup);

    let pointsEarnedTotal = 0;
    let pointsPossibleTotal = 0;
    let passEarnedTotal = 0;
    let passPossibleTotal = 0;
    const tagTotalsArr: Array<[string, { earned: number; possible: number; passEarned: number; passPossible: number }]> = [];

    const content = getSubmissionContent(sub);

    for (const node of content) {
      if (node.type !== 'question') continue;
      const kids = node.content;
      const text = extractText(kids);
      const prompt = text || '(Untitled question)';
      void prompt;

      const qtype = String(node.attrs?.type ?? 'unknown');
      void qtype;
      const rawValue = node.attrs?.value;
      const value = Array.isArray(rawValue) ? rawValue.join(', ') : rawValue;
      const valueRaw = String(value ?? '');
      void valueRaw;
      const nodeAttrs = node.attrs ?? {};
      const tags = Array.isArray(nodeAttrs.tags) ? nodeAttrs.tags.map(String) : [];
      const pointsEarned = num(node.attrs?.pointsEarned);
      const pointsPossible = num(node.attrs?.pointsPossible);
      const isCorrect = isTrue(node.attrs?.isCorrect);
      const passEarned = isCorrect ? 1 : 0;
      const passPossible = 1;

      pointsEarnedTotal += pointsEarned;
      pointsPossibleTotal += pointsPossible;
      passEarnedTotal += passEarned;
      passPossibleTotal += passPossible;

      // Aggregate by tag
      for (const tag of tags) {
        let existing = tagTotalsArr.find(([t]) => t === tag);
        if (!existing) {
          existing = [tag, { earned: 0, possible: 0, passEarned: 0, passPossible: 0 }];
          tagTotalsArr.push(existing);
        }
        existing[1].earned += pointsEarned;
        existing[1].possible += pointsPossible;
        existing[1].passEarned += passEarned;
        existing[1].passPossible += passPossible;
      }
    }

    const pointsPct = pointsPossibleTotal > 0 ? pointsEarnedTotal / pointsPossibleTotal : null;
    const passPct = passPossibleTotal > 0 ? passEarnedTotal / passPossibleTotal : null;

    recs.push({
      submissionId,
      templateId,
      templateName,
      schemaId,
      schemaVersion,
      assignmentId,
      subjectId,
      subjectDisplay: subjectDisplayName,
      assigneeId,
      assigneeDisplay: assigneeDisplayName,
      status: String(sub.status ?? '—'),
      approvalStatus: String(sub.approvalStatus ?? '—'),
      disputeStatus: String(sub.disputeStatus ?? '—'),
      createdAt,
      updatedAt,
      finalizedAt,
      isApproved,
      answers: [],
      tagTotals: tagTotalsArr,
      pointsEarnedTotal,
      pointsPossibleTotal,
      pointsPct,
      passEarnedTotal,
      passPossibleTotal,
      passPct,
    });
  }

  // Build baseline
  const baselineArr: Array<[string, NormalizedRecordWorker]> = [];
  const approved = recs
    .filter((r) => r.isApproved && r.finalizedAt)
    .sort((a, b) => {
      const aTime = a.finalizedAt ? new Date(a.finalizedAt).getTime() : 0;
      const bTime = b.finalizedAt ? new Date(b.finalizedAt).getTime() : 0;
      return aTime - bTime;
    });
  
  const baselineMap = new Map<string, NormalizedRecordWorker>();
  for (const r of approved) {
    const key = `${r.templateId}|${r.subjectId}`;
    if (!baselineMap.has(key)) baselineMap.set(key, r);
  }
  baselineMap.forEach((v, k) => baselineArr.push([k, v]));

  return {
    records: recs,
    meta: {
      tagName: tagNameArr,
      subjectName: [],
      templateName: templateNameArr,
      schemaMeta: schemaMetaArr,
      baseline: baselineArr,
    },
  };
}

// ----- Worker message handling -----

self.addEventListener('message', (event: MessageEvent<WorkerNormalizeInput>) => {
  try {
    const { payload, profileLookup } = event.data;
    const result = normalizePayload(payload, profileLookup);
    self.postMessage({ success: true, data: result });
  } catch (error) {
    self.postMessage({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error in worker' 
    });
  }
});

export {};
