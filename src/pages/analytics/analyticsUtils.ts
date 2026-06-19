/**
 * Analytics utils: normalize submissions from raw API payload,
 * filters, aggregations, and helpers for the analytics dashboard.
 * Ported from submission view data/index.html logic.
 */
import type { AnalyticsRawPayload } from '../../services/analyticsApi';

// ----- Helpers (API returns plain strings for _id and ISO strings for dates) -----
/** Parse API date (ISO string or number); dates from APIs are plain strings. */
export function odate(v: unknown): Date | null {
  if (v == null) return null;
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Get id from API ref that may be a string id or a populated object with _id (QueueSubmission style). */
export function getIdFromRef(ref: string | { _id: string } | null | undefined): string {
  if (ref == null) return '';
  return typeof ref === 'string' ? ref : String(ref._id ?? '');
}

/** Get assignee display name when assignee is populated (Profile with user.name), else "Assignee • shortId". */
function getAssigneeDisplay(
  assigneeRef: string | { _id: string; user?: string | { name?: string } } | null | undefined,
  assigneeId: string
): string {
  if (assigneeRef == null || typeof assigneeRef === 'string') return `Assignee • ${shortId(assigneeId)}`;
  const user = assigneeRef.user;
  const name = typeof user === 'object' && user && 'name' in user ? user.name : undefined;
  return (name && String(name).trim()) || `Assignee • ${shortId(assigneeId)}`;
}

export function isTrue(v: unknown): boolean {
  return String(v).toLowerCase() === 'true';
}

export function num(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function pct(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 100)}%`;
}

export function pct1(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`;
}

export function shortId(id: string | null | undefined): string {
  return id && String(id).length > 8 ? String(id).slice(-6) : String(id ?? '—');
}

export function toISODate(d: Date | null): string {
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function withinRange(
  d: Date | null,
  start: Date | null,
  end: Date | null
): boolean {
  if (!d) return false;
  const t = d.getTime();
  if (start && t < start.getTime()) return false;
  if (end) {
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    if (t > e.getTime()) return false;
  }
  return true;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfQuarter(d: Date): Date {
  const x = new Date(d);
  const q = Math.floor(x.getMonth() / 3);
  x.setMonth(q * 3, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function bucketKey(d: Date | null, bucket: string): string | null {
  if (!d) return null;
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  if (bucket === 'day') return toISODate(x);
  if (bucket === 'week') return toISODate(startOfWeek(x));
  if (bucket === 'month') return toISODate(startOfMonth(x));
  if (bucket === 'quarter') return toISODate(startOfQuarter(x));
  return toISODate(x);
}

export function movingAverage(arr: (number | null)[], win: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < arr.length; i++) {
    let sum = 0,
      n = 0;
    for (let j = Math.max(0, i - win + 1); j <= i; j++) {
      const v = arr[j];
      if (v == null) continue;
      sum += v;
      n += 1;
    }
    out.push(n ? sum / n : null);
  }
  return out;
}

export function stddev(vals: (number | null)[]): number {
  const xs = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length <= 1) return 0;
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function fmtDateTime(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
}

// ----- Answer node / schema helpers -----
type JsonNode = { type?: string; text?: string; content?: JsonNode[]; attrs?: Record<string, unknown> };

function extractText(node: JsonNode | string | JsonNode[] | null): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object') {
    if ((node as JsonNode).type === 'text') return String((node as JsonNode).text ?? '');
    const content = (node as JsonNode).content;
    return extractText(Array.isArray(content) ? content : content ?? []);
  }
  return '';
}

export function questionPromptFromNode(qnode: JsonNode | null): string {
  if (!qnode) return '(Untitled question)';
  const kids = Array.isArray(qnode.content) ? qnode.content : [];
  for (const child of kids) {
    if (
      child &&
      typeof child === 'object' &&
      (child.type === 'paragraph' || child.type === 'heading')
    ) {
      const content = child.content;
      const t = extractText(Array.isArray(content) ? content : []).trim();
      if (t) return t;
    }
  }
  return extractText(kids).trim() || '(Untitled question)';
}

// ----- Subject display from assignments -----
type AssignmentLike = {
  submitMeta?: {
    globalGroups?: Array<{ name?: string; subjectIds?: string[] }>;
    ungroupedSubjects?: Array<{ id?: string; name?: string }>;
  };
};

export function buildSubjectDisplay(assignments: AssignmentLike[]): (subjectId: string) => string {
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
    if (subjectName.has(id)) return subjectName.get(id)!;
    if (subjectGroup.has(id)) return `${subjectGroup.get(id)} • ${shortId(id)}`;
    return `Subject • ${shortId(id)}`;
  };
}

// ----- Points / pass-fail from question attrs -----
type OptionPoints = Record<
  string,
  { points?: unknown; isCorrect?: unknown }
>;

function computeMaxPoints(attrs: Record<string, unknown>, qtype: string): number {
  if (!isTrue(attrs?.enablePoints)) return 0;
  const op = attrs?.optionPoints as OptionPoints | undefined;
  if (!op || typeof op !== 'object') return 0;

  const entries = Object.entries(op).map(([, v]) => ({
    points: num(v?.points),
    isCorrect: isTrue(v?.isCorrect),
  }));
  if (!entries.length) return 0;

  if (qtype === 'singleChoice') {
    return Math.max(...entries.map((e) => e.points));
  }
  const correct = entries.filter((e) => e.isCorrect);
  if (correct.length) return correct.reduce((s, e) => s + e.points, 0);
  const pos = entries.filter((e) => e.points > 0);
  if (pos.length) return pos.reduce((s, e) => s + e.points, 0);
  return Math.max(...entries.map((e) => e.points));
}

function computeEarnedPoints(attrs: Record<string, unknown>, qtype: string): number {
  if (!isTrue(attrs?.enablePoints)) return 0;
  const op = (attrs?.optionPoints as OptionPoints) ?? {};
  if (qtype === 'singleChoice') {
    const v = attrs?.value;
    const rec = op?.[String(v ?? '')];
    return rec ? num(rec.points) : 0;
  }
  const arr = Array.isArray(attrs?.value) ? attrs.value : [];
  let sum = 0;
  for (const v of arr) {
    const rec = op?.[String(v)];
    sum += rec ? num(rec.points) : 0;
  }
  return sum;
}

function computePassFail(
  attrs: Record<string, unknown>,
  qtype: string
): { passEarned: number; passPossible: number } {
  if (!isTrue(attrs?.enablePassFail)) return { passEarned: 0, passPossible: 0 };
  const op = (attrs?.optionPoints as OptionPoints) ?? {};

  if (qtype === 'singleChoice') {
    const v = attrs?.value;
    const rec = op?.[String(v ?? '')];
    const ok = rec ? isTrue(rec.isCorrect) : false;
    return { passEarned: ok ? 1 : 0, passPossible: 1 };
  }

  const selected = new Set(
    (Array.isArray(attrs?.value) ? attrs.value : []).map(String)
  );
  const correct = new Set(
    Object.entries(op)
      .filter(([, v]) => isTrue(v?.isCorrect))
      .map(([k]) => k)
  );
  const incorrect = new Set(
    Object.entries(op)
      .filter(([, v]) => v && !isTrue(v?.isCorrect))
      .map(([k]) => k)
  );

  // Multi-select pass/fail: pass if at least one correct selected and no incorrect selected
  if (correct.size) {
    const hasCorrect = [...selected].some((v) => correct.has(v));
    const hasIncorrect = [...selected].some((v) => incorrect.has(v));
    return { passEarned: hasCorrect && !hasIncorrect ? 1 : 0, passPossible: 1 };
  }
  return { passEarned: 0, passPossible: 1 };
}

// ----- Matrix field: row-level points and pass/fail for analytics (row tags) -----
type MatrixRowStat = {
  rowId: string;
  earned: number;
  possible: number;
  passEarned: number;
  passPossible: number;
};

function matrixNormalizeValue(val: unknown, colType: string): unknown {
  if (val === null || val === undefined) return null;
  if (colType === 'choice') return typeof val === 'string' ? val : String(val);
  if (colType === 'multiple') {
    if (Array.isArray(val)) return val.map((v) => (typeof v === 'string' ? v : String(v)));
    return [];
  }
  return val;
}

function matrixParseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return !!v;
}

function matrixParsePoints(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function matrixParseOptionEntry(entry: unknown): { points: number; isCorrect: boolean } {
  if (!entry || typeof (entry as object) !== 'object') return { points: 0, isCorrect: false };
  const e = entry as { points?: unknown; isCorrect?: unknown };
  return {
    points: matrixParsePoints(e.points),
    isCorrect: matrixParseBool(e.isCorrect),
  };
}

function isMatrixScoringColumn(c: { type?: string; enablePoints?: unknown; enablePassFail?: unknown }): boolean {
  if (!c || (c.type !== 'choice' && c.type !== 'multiple')) return false;
  return matrixParseBool(c.enablePoints) || matrixParseBool(c.enablePassFail);
}

/**
 * Compute per-row points and pass/fail counts for a matrix field.
 * Used to attribute matrix row scores to row tags in analytics.
 */
export function computeMatrixRowStats(attrs: {
  columns?: Array<{ id?: string; type?: string; options?: string[]; optionPoints?: Record<string, unknown>; enablePoints?: unknown; enablePassFail?: unknown }>;
  rows?: Array<{ id: string; tags?: string[] }>;
  cells?: Record<string, Record<string, unknown>>;
  nodeGroupValues?: Record<string, Record<string, Record<string, unknown>>>;
}): {
  perRow: MatrixRowStat[];
  totalEarned: number;
  totalPossible: number;
  totalPassEarned: number;
  totalPassPossible: number;
} {
  const columns = Array.isArray(attrs.columns) ? attrs.columns : [];
  const rows = Array.isArray(attrs.rows) ? attrs.rows : [];
  let cells: Record<string, Record<string, unknown>> =
    attrs.cells && typeof attrs.cells === 'object' ? { ...attrs.cells } : {};
  if (Object.keys(cells).length === 0 && attrs.nodeGroupValues && typeof attrs.nodeGroupValues === 'object') {
    const firstKey = Object.keys(attrs.nodeGroupValues)[0];
    const firstCells = firstKey ? attrs.nodeGroupValues[firstKey] : undefined;
    if (firstCells && typeof firstCells === 'object') cells = firstCells;
  }

  const scoringColumns = columns.filter((c) => isMatrixScoringColumn(c));
  const perRow: MatrixRowStat[] = [];
  let totalEarned = 0;
  let totalPossible = 0;
  let totalPassEarned = 0;
  let totalPassPossible = 0;

  for (const row of rows) {
    const rowId = row.id;
    let earned = 0;
    let possible = 0;
    let passEarned = 0;
    let passPossible = 0;

    for (const col of scoringColumns) {
      const optionPointsRaw = (col.optionPoints ?? {}) as Record<string, unknown>;
      const opts = Array.isArray(col.options) ? (col.options as string[]) : [];
      const val = (cells[rowId] && cells[rowId][col.id ?? '']) ?? null;
      const normalizedVal = matrixNormalizeValue(val, col.type ?? 'choice');
      const enablePoints = matrixParseBool(col.enablePoints);
      const enablePassFail = matrixParseBool(col.enablePassFail);

      if (enablePoints) {
        const correctOpts = opts.filter((o) => matrixParseOptionEntry(optionPointsRaw[o]).isCorrect);
        const maxForCol =
          col.type === 'choice'
            ? correctOpts.length
              ? Math.max(...correctOpts.map((o) => matrixParseOptionEntry(optionPointsRaw[o]).points))
              : 0
            : correctOpts.reduce((sum, o) => sum + matrixParseOptionEntry(optionPointsRaw[o]).points, 0);
        possible += maxForCol;
        if (col.type === 'choice' && typeof normalizedVal === 'string') {
          const entry = matrixParseOptionEntry(optionPointsRaw[normalizedVal]);
          if (entry.isCorrect && entry.points >= 0) earned += entry.points;
        } else if (col.type === 'multiple' && Array.isArray(normalizedVal)) {
          (normalizedVal as string[]).forEach((v) => {
            const entry = matrixParseOptionEntry(optionPointsRaw[v]);
            if (entry.isCorrect && entry.points >= 0) earned += entry.points;
          });
        }
      }
      if (enablePassFail) {
        passPossible += 1;
        if (col.type === 'choice' && typeof normalizedVal === 'string') {
          const entry = matrixParseOptionEntry(optionPointsRaw[normalizedVal]);
          if (entry.isCorrect) passEarned += 1;
        } else if (col.type === 'multiple' && Array.isArray(normalizedVal)) {
          const selected = normalizedVal as string[];
          const allCorrect =
            selected.length > 0 &&
            selected.every((v) => matrixParseOptionEntry(optionPointsRaw[v]).isCorrect);
          if (allCorrect) passEarned += 1;
        }
      }
    }

    perRow.push({ rowId, earned, possible, passEarned, passPossible });
    totalEarned += earned;
    totalPossible += possible;
    totalPassEarned += passEarned;
    totalPassPossible += passPossible;
  }

  return {
    perRow,
    totalEarned,
    totalPossible,
    totalPassEarned,
    totalPassPossible,
  };
}

// ----- Normalized record type -----
export interface NormalizedAnswer {
  qid: string;
  qtype: string;
  prompt: string;
  value: string;
  valueRaw: unknown;
  tags: string[];
  pointsEarned: number;
  pointsPossible: number;
  passEarned: number;
  passPossible: number;
}

export interface NormalizedRecord {
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
  createdAt: Date | null;
  updatedAt: Date | null;
  finalizedAt: Date | null;
  isApproved: boolean;
  answers: NormalizedAnswer[];
  tagTotals: Map<string, { earned: number; possible: number; passEarned: number; passPossible: number }>;
  pointsEarnedTotal: number;
  pointsPossibleTotal: number;
  pointsPct: number | null;
  passEarnedTotal: number;
  passPossibleTotal: number;
  passPct: number | null;
}

export interface AnalyticsMeta {
  tagName: Map<string, string>;
  subjectName: Map<string, string>;
  templateName: Map<string, string>;
  schemaMeta: Map<string, { version: number | null; templateId: string }>;
  baseline: Map<string, NormalizedRecord>;
}

// ----- Normalize raw payload to records + meta -----
/** Extract the content array from submission answers (handles doc, array, nested, or stringified). */
function getSubmissionContent(sub: { answers?: unknown }): JsonNode[] {
  let answers = sub?.answers;
  if (answers == null) return [];
  // Some backends return stringified JSON
  if (typeof answers === 'string') {
    try {
      answers = JSON.parse(answers) as unknown;
    } catch {
      return [];
    }
  }
  // TipTap doc: { type: 'doc', content: [...] } — matches submission-summary-example.json
  if (typeof answers === 'object' && Array.isArray((answers as { content?: JsonNode[] }).content)) {
    return (answers as { content: JsonNode[] }).content;
  }
  // Top-level array (some APIs)
  if (Array.isArray(answers)) return answers as JsonNode[];
  // Nested: { data: { content: [...] } }
  const data = (answers as { data?: { content?: JsonNode[] } })?.data;
  if (data && Array.isArray(data.content)) return data.content;
  return [];
}

export function normalize(raw: AnalyticsRawPayload): {
  records: NormalizedRecord[];
  meta: AnalyticsMeta;
} {
  const assignmentsById = new Map(
    raw.assignments.map((a) => [String(a._id ?? ''), a as AssignmentLike & { _id: string }])
  );
  const subjectDisplayFn = buildSubjectDisplay(raw.assignments as AssignmentLike[]);

  const meta: AnalyticsMeta = {
    tagName: new Map(),
    subjectName: new Map(),
    templateName: new Map(),
    schemaMeta: new Map(),
    baseline: new Map(),
  };

  for (const t of raw.tags ?? []) {
    const id = String(t._id ?? '');
    if (!id || t.deletedAt) continue;
    meta.tagName.set(id, String(t.name || `Tag • ${shortId(id)}`));
  }

  for (const t of raw.templates) {
    const tid = String(t._id ?? '');
    meta.templateName.set(tid, t.name || `Template • ${shortId(tid)}`);
  }

  for (const s of raw.schemas) {
    const sid = String(s._id ?? '');
    meta.schemaMeta.set(sid, {
      version: s.version ?? null,
      templateId: String(s.formTemplate ?? ''),
    });
  }

  const recs: NormalizedRecord[] = [];

  for (const sub of raw.submissions) { //  as SubmissionLike[]
    const submissionId = String(sub._id ?? '');
    const assignmentId = getIdFromRef(sub.assignment);
    const assigneeId = getIdFromRef(sub.assignee);
    const subjectId = getIdFromRef(sub.subject);
    const schemaId = getIdFromRef(sub.formTemplateSchema);

    const assignment = assignmentsById.get(assignmentId) as
      | (AssignmentLike & { formTemplate?: { _id?: string } | string })
      | undefined;
    const templateId = assignment
      ? String(
          typeof assignment.formTemplate === 'object'
            ? assignment.formTemplate?._id ?? ''
            : (assignment.formTemplate as string) ?? ''
        )
      : meta.schemaMeta.get(schemaId)?.templateId ?? null;
    const templateName = templateId
      ? meta.templateName.get(templateId) || `Template • ${shortId(templateId)}`
      : '—';
    const schemaVersion = meta.schemaMeta.get(schemaId)?.version ?? null;

    const createdAt = odate(sub.createdAt);
    const updatedAt = odate(sub.updatedAt);
    const isApproved = String(sub.approvalStatus ?? '').toLowerCase() === 'approved';
    const finalizedAt = isApproved ? updatedAt : null;

    const subjectDisplayName = subjectDisplayFn(subjectId);
    meta.subjectName.set(subjectId, subjectDisplayName);

    let pointsEarnedTotal = 0,
      pointsPossibleTotal = 0;
    let passEarnedTotal = 0,
      passPossibleTotal = 0;
    const tagTotals = new Map<
      string,
      { earned: number; possible: number; passEarned: number; passPossible: number }
    >();
    const answers: NormalizedAnswer[] = [];

    const content = getSubmissionContent(sub);
    for (const n of content) {
      if (!n || typeof n !== 'object') continue;
      const nodeType = String(n.type);
      const attrs = (n.attrs ?? {}) as Record<string, unknown>;

      // Matrix field: rows have tags; sum row points/pass-fail per tag
      if (nodeType === 'matrixField') {
        const matrixId = String(attrs.id ?? attrs.name ?? '');
        const matrixLabel = String(attrs.label ?? 'Matrix');
        const matrixStats = computeMatrixRowStats({
          columns: attrs.columns as Array<{ id?: string; type?: string; options?: string[]; optionPoints?: Record<string, unknown>; enablePoints?: unknown; enablePassFail?: unknown }>,
          rows: attrs.rows as Array<{ id: string; tags?: string[] }>,
          cells: attrs.cells as Record<string, Record<string, unknown>>,
          nodeGroupValues: attrs.nodeGroupValues as Record<string, Record<string, Record<string, unknown>>>,
        });
        pointsEarnedTotal += matrixStats.totalEarned;
        pointsPossibleTotal += matrixStats.totalPossible;
        passEarnedTotal += matrixStats.totalPassEarned;
        passPossibleTotal += matrixStats.totalPassPossible;
        for (const rowStat of matrixStats.perRow) {
          const row = (Array.isArray(attrs.rows) ? attrs.rows : []).find(
            (r: { id?: string }) => String(r?.id) === rowStat.rowId
          ) as { tags?: string[] } | undefined;
          const rowTags = (row && Array.isArray(row.tags) ? row.tags : []).map(String);
          for (const tagId of rowTags) {
            if (!tagId) continue;
            if (!tagTotals.has(tagId))
              tagTotals.set(tagId, { earned: 0, possible: 0, passEarned: 0, passPossible: 0 });
            const t = tagTotals.get(tagId)!;
            t.earned += rowStat.earned;
            t.possible += rowStat.possible;
            t.passEarned += rowStat.passEarned;
            t.passPossible += rowStat.passPossible;
          }
        }
        answers.push({
          qid: matrixId || 'matrix',
          qtype: 'matrixField',
          prompt: matrixLabel,
          value: '',
          valueRaw: attrs.cells ?? {},
          tags: Array.from(
            new Set(
              (Array.isArray(attrs.rows) ? attrs.rows : []).flatMap(
                (r: { tags?: string[] }) => (Array.isArray(r?.tags) ? r.tags.map(String) : [])
              )
            )
          ),
          pointsEarned: matrixStats.totalEarned,
          pointsPossible: matrixStats.totalPossible,
          passEarned: matrixStats.totalPassEarned,
          passPossible: matrixStats.totalPassPossible,
        });
        continue;
      }

      if (!['shortText', 'singleChoice', 'multipleChoice'].includes(nodeType)) continue;
      const qid = String(attrs.id ?? attrs.name ?? '');
      if (!qid) continue;

      const qtype = nodeType;
      const prompt = questionPromptFromNode(n);
      const tags = (Array.isArray(attrs.tags) ? attrs.tags : []).map(String);

      let valueRaw = attrs.value;
      let value = '';
      if (qtype === 'shortText' || qtype === 'singleChoice') {
        value = (valueRaw ?? '').toString();
      } else {
        value = Array.isArray(valueRaw) ? valueRaw.join(', ') : (valueRaw ?? '').toString();
      }

      const pointsPossible = computeMaxPoints(attrs, qtype);
      const pointsEarned = computeEarnedPoints(attrs, qtype);
      const pf = computePassFail(attrs, qtype);

      pointsEarnedTotal += pointsEarned;
      pointsPossibleTotal += pointsPossible;
      passEarnedTotal += pf.passEarned;
      passPossibleTotal += pf.passPossible;

      for (const tagId of tags) {
        if (!tagTotals.has(tagId))
          tagTotals.set(tagId, { earned: 0, possible: 0, passEarned: 0, passPossible: 0 });
        const t = tagTotals.get(tagId)!;
        t.earned += pointsEarned;
        t.possible += pointsPossible;
        t.passEarned += pf.passEarned;
        t.passPossible += pf.passPossible;
      }

      answers.push({
        qid,
        qtype,
        prompt,
        value,
        valueRaw,
        tags,
        pointsEarned,
        pointsPossible,
        passEarned: pf.passEarned,
        passPossible: pf.passPossible,
      });
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
      assigneeDisplay: getAssigneeDisplay(sub.assignee, assigneeId),
      status: String(sub.status ?? '—'),
      approvalStatus: String(sub.approvalStatus ?? '—'),
      disputeStatus: String(sub.disputeStatus ?? '—'),
      createdAt,
      updatedAt,
      finalizedAt,
      isApproved,
      answers,
      tagTotals,
      pointsEarnedTotal,
      pointsPossibleTotal,
      pointsPct,
      passEarnedTotal,
      passPossibleTotal,
      passPct,
    });
  }

  const approved = recs
    .filter((r) => r.isApproved && r.finalizedAt)
    .sort((a, b) => (a.finalizedAt!.getTime() - b.finalizedAt!.getTime()));
  for (const r of approved) {
    const key = `${r.templateId}|${r.subjectId}`;
    if (!meta.baseline.has(key)) meta.baseline.set(key, r);
  }

  return { records: recs, meta };
}

// ----- Filters -----
export interface AnalyticsFilters {
  templateIds: string[];
  subjectIds: string[];
  tagIds: string[];
  schemaVersions: (number | string)[];
  metric: 'points' | 'pass';
  bucket: string;
  approvedOnly: boolean;
  useDates: boolean;
  start: Date | null;
  end: Date | null;
  timelineAvg: string;
  smooth: string;
  search: string;
  topN: number;
  assigneeId: string;
  questionMode: string;
  showHeatmap: boolean;
  showAssignee: boolean;
}

export function recordMatchesSearch(r: NormalizedRecord, search: string): boolean {
  if (!search) return true;
  const hay = [
    r.subjectDisplay,
    r.templateName,
    r.assigneeDisplay,
    r.approvalStatus,
    r.status,
    ...r.answers.map((a) => a.prompt),
    ...r.answers.map((a) => (typeof a.value === 'string' ? a.value : '')),
    ...r.answers.flatMap((a) => a.tags),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(search.toLowerCase());
}

export function applyFilters(
  records: NormalizedRecord[],
  f: AnalyticsFilters
): NormalizedRecord[] {
  return records.filter((r) => {
    // if (f.approvedOnly && !r.isApproved) return false;
    // if (f.useDates && !withinRange(r.finalizedAt, f.start, f.end)) return false;
    if (f.templateIds.length && !f.templateIds.includes(String(r.templateId))) return false;
    if (f.subjectIds.length && !f.subjectIds.includes(String(r.subjectId))) return false;
    if (f.assigneeId && String(r.assigneeId) !== String(f.assigneeId)) return false;
    if (f.schemaVersions.length) {
      const v = r.schemaVersion;
      if (!f.schemaVersions.some((x) => Number(x) === Number(v))) return false;
    }
    if (!recordMatchesSearch(r, f.search)) return false;
    if (f.tagIds.length) {
      let ok = false;
      for (const tid of f.tagIds) {
        if (r.tagTotals.has(String(tid))) {
          ok = true;
          break;
        }
      }
      if (!ok) return false;
    }
    return true;
  });
}

export function metricValue(r: NormalizedRecord, metric: 'points' | 'pass'): number | null {
  return metric === 'pass' ? r.passPct : r.pointsPct;
}

export function metricLabel(metric: 'points' | 'pass'): string {
  return metric === 'pass' ? 'Pass %' : 'Points %';
}

// ----- Aggregations -----
export function aggBy<K extends string>(
  records: NormalizedRecord[],
  keyFn: (r: NormalizedRecord) => K
): Map<K, NormalizedRecord[]> {
  const m = new Map<K, NormalizedRecord[]>();
  for (const r of records) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

export function avgMetric(
  records: NormalizedRecord[],
  metric: 'points' | 'pass'
): number | null {
  const vals = records
    .map((r) => metricValue(r, metric))
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function weightedMetric(
  records: NormalizedRecord[],
  metric: 'points' | 'pass'
): number | null {
  let earned = 0,
    possible = 0;
  for (const r of records) {
    if (metric === 'pass') {
      earned += r.passEarnedTotal;
      possible += r.passPossibleTotal;
    } else {
      earned += r.pointsEarnedTotal;
      possible += r.pointsPossibleTotal;
    }
  }
  return possible > 0 ? earned / possible : null;
}

// Bucket timeline: groupKey -> bucketKey -> { n, metricVals, pointsEarned, ... }
export interface TimelinePoint {
  x: string;
  y: number | null;
  n: number;
  pointsEarned: number;
  pointsPossible: number;
  passEarned: number;
  passPossible: number;
  submissionIds: string[];
}

export interface TimelineSeries {
  key: string;
  label: string;
  points: TimelinePoint[];
}

interface TimelineCellAcc {
  x: string;
  n: number;
  metricVals: number[];
  pointsEarned: number;
  pointsPossible: number;
  passEarned: number;
  passPossible: number;
  submissionIds: string[];
}

export function bucketTimeline(
  records: NormalizedRecord[],
  f: AnalyticsFilters,
  groupLabel: (key: string) => string,
  groupKeyFn: (r: NormalizedRecord) => string
): TimelineSeries[] {
  const bucket = f.bucket;
  const metric = f.metric;
  const avgMode = f.timelineAvg;

  const groups = new Map<string, Map<string, TimelineCellAcc>>();

  for (const r of records) {
    const gk = groupKeyFn(r);
    const b = bucketKey(r.finalizedAt, bucket);
    if (!b) continue;
    if (!groups.has(gk)) groups.set(gk, new Map());
    const m = groups.get(gk)!;
    if (!m.has(b)) {
      m.set(b, {
        x: b,
        n: 0,
        metricVals: [],
        pointsEarned: 0,
        pointsPossible: 0,
        passEarned: 0,
        passPossible: 0,
        submissionIds: [],
      });
    }
    const cell = m.get(b)!;
    cell.n += 1;
    const mv = metricValue(r, metric);
    if (mv != null) cell.metricVals.push(mv);
    cell.pointsEarned += r.pointsEarnedTotal;
    cell.pointsPossible += r.pointsPossibleTotal;
    cell.passEarned += r.passEarnedTotal;
    cell.passPossible += r.passPossibleTotal;
    cell.submissionIds.push(r.submissionId);
  }

  const series: TimelineSeries[] = [];
  for (const [gk, bm] of groups.entries()) {
    const points: TimelinePoint[] = [];
    for (const [, cell] of bm.entries()) {
      let y: number | null = null;
      if (avgMode === 'weighted') {
        if (metric === 'pass')
          y = cell.passPossible > 0 ? cell.passEarned / cell.passPossible : null;
        else
          y = cell.pointsPossible > 0 ? cell.pointsEarned / cell.pointsPossible : null;
      } else {
        const vals = cell.metricVals.filter((v) => Number.isFinite(v));
        y = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      }
      points.push({
        x: cell.x,
        y,
        n: cell.n,
        pointsEarned: Math.round(cell.pointsEarned * 10) / 10,
        pointsPossible: Math.round(cell.pointsPossible * 10) / 10,
        passEarned: cell.passEarned,
        passPossible: cell.passPossible,
        submissionIds: cell.submissionIds,
      });
    }
    points.sort((a, b) => a.x.localeCompare(b.x));
    series.push({ key: gk, label: groupLabel(gk), points });
  }
  return series;
}

// Tag label helper using meta
export function tagLabelFromMeta(meta: AnalyticsMeta): (tagId: string) => string {
  return (tagId: string) => {
    const name = meta.tagName.get(String(tagId));
    return name ?? `Tag • ${shortId(tagId)}`;
  };
}

// Group answers by template + qid for questions summary export (version-agnostic key)
export interface QuestionGroup {
  templateId: string | null;
  templateName: string;
  qid: string;
  schemaVersions: (number | string)[];
  prompt: string;
  tags: string[];
  nAnswers: number;
  pointsEarned: number;
  pointsPossible: number;
  passEarned: number;
  passPossible: number;
  pointsPct: number | null;
  passPct: number | null;
  gapPts: number;
  optionCounts: Map<string, number>;
}

export function groupQuestions(records: NormalizedRecord[]): QuestionGroup[] {
  const groups = new Map<string, QuestionGroup>();

  for (const r of records) {
    for (const a of r.answers) {
      const hasPoints = a.pointsPossible > 0;
      const hasPass = a.passPossible > 0;
      if (!hasPoints && !hasPass) continue;

      const key = `${r.templateId ?? ''}|${a.qid}`;
      if (!groups.has(key)) {
        groups.set(key, {
          templateId: r.templateId,
          templateName: r.templateName,
          qid: a.qid,
          schemaVersions: [],
          prompt: a.prompt,
          tags: [],
          nAnswers: 0,
          pointsEarned: 0,
          pointsPossible: 0,
          passEarned: 0,
          passPossible: 0,
          pointsPct: null,
          passPct: null,
          gapPts: 0,
          optionCounts: new Map(),
        });
      }
      const g = groups.get(key)!;
      const sv = r.schemaVersion ?? '—';
      if (!g.schemaVersions.includes(sv)) g.schemaVersions.push(sv);
      for (const t of a.tags) if (!g.tags.includes(t)) g.tags.push(t);
      g.nAnswers += 1;
      g.pointsEarned += a.pointsEarned;
      g.pointsPossible += a.pointsPossible;
      g.passEarned += a.passEarned;
      g.passPossible += a.passPossible;

      const val =
        a.qtype === 'multipleChoice' && Array.isArray(a.valueRaw)
          ? (a.valueRaw as unknown[]).map((v) => String(v).trim()).filter(Boolean)
          : [String(a.valueRaw ?? a.value ?? '').trim()].filter(Boolean);
      for (const v of val) {
        g.optionCounts.set(v, (g.optionCounts.get(v) ?? 0) + 1);
      }
    }
  }

  const out: QuestionGroup[] = [];
  for (const g of groups.values()) {
    const pointsPct = g.pointsPossible > 0 ? g.pointsEarned / g.pointsPossible : null;
    const passPct = g.passPossible > 0 ? g.passEarned / g.passPossible : null;
    const gapPts = g.pointsPossible - g.pointsEarned;
    out.push({
      ...g,
      schemaVersions: [...new Set(g.schemaVersions)],
      pointsPct,
      passPct,
      gapPts,
    });
  }
  out.sort((a, b) => b.gapPts - a.gapPts || b.pointsPossible - a.pointsPossible || b.nAnswers - a.nAnswers);
  return out;
}
