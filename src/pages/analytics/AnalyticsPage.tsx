import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  theme,
  Grid,
  message,
} from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { Line, Column } from '@ant-design/charts';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import dayjs from 'dayjs';
import { fetchAnalyticsData, buildProfileLookup, getProfileDisplayName, getProfileAvatarKey, type AnalyticsFetchPhase, type ProfileData } from '../../services/analyticsApi';
import type { AnalyticsRawPayload } from '../../services/analyticsApi';
import { AssetAvatar } from '../../components/AssetAvatar/AssetAvatar';
import { downloadAnalyticsPdf } from '../../utils/analyticsPdfExport';
import {
  normalize,
  applyFilters,
  bucketTimeline,
  aggBy,
  weightedMetric,
  metricValue,
  metricLabel,
  tagLabelFromMeta,
  pct1,
  fmtDateTime,
  shortId,
  clamp,
  stddev,
  groupQuestions,
  type NormalizedRecord,
  type AnalyticsFilters,
  type AnalyticsMeta,
  type TimelineSeries,
} from './analyticsUtils';

const { RangePicker } = DatePicker;
const { Text } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;

const DEFAULT_FILTERS: AnalyticsFilters = {
  templateIds: [],
  subjectIds: [],
  tagIds: [],
  schemaVersions: [],
  metric: 'points',
  bucket: 'week',
  approvedOnly: true,
  useDates: true,
  start: null,
  end: null,
  timelineAvg: 'per_submission',
  smooth: 'none',
  search: '',
  topN: 15,
  assigneeId: '',
  questionMode: 'off',
  showHeatmap: true,
  showAssignee: true,
};

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return cols.join(',') + '\n' + rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
}

function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function AnalyticsPage() {
  const { token } = useToken();
  const screens = useBreakpoint();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.isAdmin === true;

  const [raw, setRaw] = useState<AnalyticsRawPayload | null>(null);
  const [records, setRecords] = useState<NormalizedRecord[]>([]);
  const [meta, setMeta] = useState<AnalyticsMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileLookup, setProfileLookup] = useState<Record<string, ProfileData>>({});
  const [fetchPhase, setFetchPhase] = useState<AnalyticsFetchPhase | null>(null);
  const [fetchProgress, setFetchProgress] = useState<number>(0);
  const [fetchDetails, setFetchDetails] = useState<string>('');
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<'graphs' | 'tables'>('graphs');
  const [tableTab, setTableTab] = useState('submissions');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const chartRefs = useRef<Record<string, unknown>>({});
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillContent, setDrillContent] = useState<{ 
    title: string; 
    meta: string; 
    records: NormalizedRecord[];
    tagBreakdown?: Array<{
      tagId: string;
      label: string;
      pointsEarned: number;
      pointsPossible: number;
      pointsPct: number | null;
      passEarned: number;
      passPossible: number;
      passPct: number | null;
      orgPct: number | null;
      delta: number | null;
      submissions: number;
    }>;
  } | null>(null);
  const [submissionDetailRecord, setSubmissionDetailRecord] = useState<NormalizedRecord | null>(null);

  // NOTE: Web worker implementation reserved for future performance optimization
  // See: src/pages/analytics/workers/analytics.worker.ts

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    setFetchPhase('loading_assignments');
    setFetchProgress(0);
    setFetchDetails('Starting...');

    const handleProgress: Parameters<typeof fetchAnalyticsData>[0] = (phase, progress, details) => {
      setFetchPhase(phase);
      setFetchProgress(progress);
      setFetchDetails(details ?? '');
    };

    try {
      const payload = await fetchAnalyticsData(handleProgress);
      setRaw(payload);

      // Build profile lookup from fetched profiles
      const lookup = buildProfileLookup(payload.profiles);
      setProfileLookup(lookup.byId);

      // Process normalization - prefer worker if available, otherwise sync
      setFetchPhase('processing');
      setFetchProgress(50);
      setFetchDetails('Processing analytics...');

      const { records: recs, meta: m } = normalize(payload);
      
      // Update subjectName map with profile-based names
      const updatedMeta = { ...m };
      updatedMeta.subjectName = new Map(m.subjectName);
      
      // Enhance subject names with profile data
      for (const [subjectId] of updatedMeta.subjectName) {
        const profile = lookup.byId[subjectId];
        if (profile) {
          const displayName = getProfileDisplayName(profile, updatedMeta.subjectName.get(subjectId) ?? subjectId);
          updatedMeta.subjectName.set(subjectId, displayName);
        }
      }

      setRecords(recs);
      setMeta(updatedMeta);

      const approved = recs.filter((r) => r.isApproved && r.finalizedAt).map((r) => r.finalizedAt!);
      if (approved.length && (!filters.start || !filters.end)) {
        setFilters((prev) => ({
          ...prev,
          start: new Date(Math.min(...approved.map((d) => d.getTime()))),
          end: new Date(Math.max(...approved.map((d) => d.getTime()))),
        }));
      }
      
      setFetchProgress(100);
      setFetchDetails('Complete!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics data');
      message.error('Failed to load analytics data');
    } finally {
      setLoading(false);
      setFetchPhase(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && !raw) loadData();
  }, [isAdmin, raw, loadData]);

  const tagLabel = useMemo(() => (meta ? tagLabelFromMeta(meta) : () => '—'), [meta]);

  const filteredRecords = useMemo(
    () => (records.length ? applyFilters(records, filters) : []),
    [records, filters]
  );

  // Compute organization-wide tag averages for delta comparison (before subjectAgg)
  const orgTagAvg = useMemo(() => {
    const m = new Map<string, { pointsEarned: number; pointsPossible: number; passEarned: number; passPossible: number; submissions: number }>();
    for (const r of filteredRecords) {
      for (const [tid, t] of r.tagTotals.entries()) {
        const tagId = String(tid);
        if (!m.has(tagId)) {
          m.set(tagId, { pointsEarned: 0, pointsPossible: 0, passEarned: 0, passPossible: 0, submissions: 0 });
        }
        const x = m.get(tagId)!;
        x.pointsEarned += t.earned;
        x.pointsPossible += t.possible;
        x.passEarned += t.passEarned;
        x.passPossible += t.passPossible;
        x.submissions += 1;
      }
    }
    // Compute percentages
    const result = new Map<string, { pointsPct: number | null; passPct: number | null; submissions: number }>();
    for (const [tagId, v] of m.entries()) {
      result.set(tagId, {
        pointsPct: v.pointsPossible > 0 ? v.pointsEarned / v.pointsPossible : null,
        passPct: v.passPossible > 0 ? v.passEarned / v.passPossible : null,
        submissions: v.submissions,
      });
    }
    return result;
  }, [filteredRecords]);

  // Compute subject-tag performance with delta vs org
  const subjectTagAgg = useMemo(() => {
    const bySubject = aggBy(filteredRecords, (r) => r.subjectId);
    const m = new Map<string, Map<string, { pointsEarned: number; pointsPossible: number; passEarned: number; passPossible: number; pointsPct: number | null; passPct: number | null; delta: number | null }>>();
    for (const [sid, rs] of bySubject.entries()) {
      const subjectTags = new Map<string, { pointsEarned: number; pointsPossible: number; passEarned: number; passPossible: number }>();
      for (const r of rs) {
        for (const [tid, t] of r.tagTotals.entries()) {
          const tagId = String(tid);
          if (!subjectTags.has(tagId)) {
            subjectTags.set(tagId, { pointsEarned: 0, pointsPossible: 0, passEarned: 0, passPossible: 0 });
          }
          const x = subjectTags.get(tagId)!;
          x.pointsEarned += t.earned;
          x.pointsPossible += t.possible;
          x.passEarned += t.passEarned;
          x.passPossible += t.passPossible;
        }
      }
      // Compute percentages and delta vs org
      const tagData = new Map<string, { pointsEarned: number; pointsPossible: number; passEarned: number; passPossible: number; pointsPct: number | null; passPct: number | null; delta: number | null }>();
      for (const [tagId, v] of subjectTags.entries()) {
        const orgData = orgTagAvg.get(tagId);
        const pointsPct = v.pointsPossible > 0 ? v.pointsEarned / v.pointsPossible : null;
        const passPct = v.passPossible > 0 ? v.passEarned / v.passPossible : null;
        let delta: number | null = null;
        if (pointsPct != null && orgData?.pointsPct != null) {
          delta = pointsPct - orgData.pointsPct;
        }
        tagData.set(tagId, {
          pointsEarned: v.pointsEarned,
          pointsPossible: v.pointsPossible,
          passEarned: v.passEarned,
          passPossible: v.passPossible,
          pointsPct,
          passPct,
          delta,
        });
      }
      m.set(sid, tagData);
    }
    return m;
  }, [filteredRecords, orgTagAvg]);

  const subjectAgg = useMemo(() => {
    const bySubject = aggBy(filteredRecords, (r) => r.subjectId);
    // Calculate org average for the current metric
    const orgAvg = weightedMetric(filteredRecords, filters.metric);
    const m = new Map<
      string,
      {
        subjectId: string;
        subjectDisplay: string;
        rs: NormalizedRecord[];
        score: number | null;
        submissions: number;
        templatesSet: Set<string | null>;
        baseDelta: number | null;
        orgDelta: number | null;
        topTags: Array<{ tagId: string; label: string; pointsEarned: number; pointsPossible: number; pointsPct: number | null; passEarned: number; passPossible: number; passPct: number | null; delta: number | null }>;
      }
    >();
    for (const [sid, rs] of bySubject.entries()) {
      const score = weightedMetric(rs, filters.metric);
      const templatesSet = new Set(rs.map((r) => r.templateId));
      const byPair = aggBy(rs, (r) => `${r.templateId}|${r.subjectId}`);
      let wSum = 0,
        dSum = 0;
      for (const [k, prs] of byPair.entries()) {
        const base = meta?.baseline.get(k);
        if (!base) continue;
        const cur = weightedMetric(prs, filters.metric);
        const b = metricValue(base, filters.metric);
        if (cur == null || b == null) continue;
        dSum += (cur - b) * prs.length;
        wSum += prs.length;
      }
      const baseDelta = wSum ? dSum / wSum : null;
      // Org delta: how this subject compares to organization average
      const orgDelta = score != null && orgAvg != null ? score - orgAvg : null;

      // Get top tags for this subject
      const subjectTagsMap = subjectTagAgg.get(sid);
      let topTags: Array<{ tagId: string; label: string; pointsEarned: number; pointsPossible: number; pointsPct: number | null; passEarned: number; passPossible: number; passPct: number | null; delta: number | null }> = [];
      if (subjectTagsMap) {
        // Sort by contribution (pointsPossible * coverage) to get most meaningful tags
        topTags = Array.from(subjectTagsMap.entries())
          .map(([tagId, data]: [string, { pointsEarned: number; pointsPossible: number; passEarned: number; passPossible: number; pointsPct: number | null; passPct: number | null; delta: number | null }]) => ({
            tagId,
            label: meta?.tagName.get(tagId) ?? `Tag • ${shortId(tagId)}`,
            pointsEarned: data.pointsEarned,
            pointsPossible: data.pointsPossible,
            pointsPct: data.pointsPct,
            passEarned: data.passEarned,
            passPossible: data.passPossible,
            passPct: data.passPct,
            delta: data.delta,
            contribution: data.pointsPossible * (data.pointsPct ?? 0), // weighted by performance
          }))
          .filter((t) => t.pointsPossible > 0) // Only show tags with data
          .sort((a, b) => b.contribution - a.contribution) // Most meaningful first
          .slice(0, 5) // Top 5 tags
          .map(({ contribution, ...rest }) => rest); // Remove the temp field
      }

      m.set(sid, {
        subjectId: sid,
        subjectDisplay: rs[0]?.subjectDisplay ?? meta?.subjectName.get(sid) ?? sid,
        rs,
        score,
        submissions: rs.length,
        templatesSet,
        baseDelta,
        orgDelta,
        topTags,
      });
    }
    return m;
  }, [filteredRecords, filters.metric, meta, subjectTagAgg]);

  const timelineSeries = useMemo(() => {
    const bySubject = aggBy(filteredRecords, (r) => r.subjectId);
    let subjectIds = filters.subjectIds.slice();
    if (!subjectIds.length) {
      subjectIds = Array.from(bySubject.entries())
        .map(([sid, rs]) => ({ sid, n: rs.length }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 5)
        .map((x) => x.sid);
    }
    const teamSeries = bucketTimeline(
      filteredRecords,
      filters,
      () => 'Team average',
      () => '__team__'
    );
    const subjSeries = bucketTimeline(
      filteredRecords.filter((r) => subjectIds.includes(r.subjectId)),
      filters,
      (sid) => meta?.subjectName.get(sid) ?? `Subject • ${shortId(sid)}`,
      (r) => r.subjectId
    );
    const series: TimelineSeries[] = [];
    if (teamSeries.length) series.push({ ...teamSeries[0], label: 'Team average' });
    subjSeries.forEach((s) => {
      if (!series.find((x) => x.key === s.key)) series.push(s);
    });
    return series;
  }, [filteredRecords, filters, meta]);

  const leaderboardItems = useMemo(() => {
    const rows = Array.from(subjectAgg.values())
      .filter((x) => x.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, filters.topN);
    return rows.map((s, i) => ({
      label: `${i + 1}. ${s.subjectDisplay}`,
      value: s.score ?? 0,
      subjectId: s.subjectId,
      submissionIds: s.rs.map((r) => r.submissionId),
      sub: `${s.submissions} submissions • ${s.templatesSet.size} templates`,
    }));
  }, [subjectAgg, filters.topN]);

  const tagAgg = useMemo(() => {
    const m = new Map<
      string,
      { tagId: string; earned: number; possible: number; passEarned: number; passPossible: number; submissions: number; submissionIds: string[] }
    >();
    for (const r of filteredRecords) {
      for (const [tid, t] of r.tagTotals.entries()) {
        const tagId = String(tid);
        if (!m.has(tagId))
          m.set(tagId, {
            tagId,
            earned: 0,
            possible: 0,
            passEarned: 0,
            passPossible: 0,
            submissions: 0,
            submissionIds: [],
          });
        const x = m.get(tagId)!;
        x.earned += t.earned;
        x.possible += t.possible;
        x.passEarned += t.passEarned;
        x.passPossible += t.passPossible;
        x.submissions += 1;
        x.submissionIds.push(r.submissionId);
      }
    }
    return m;
  }, [filteredRecords]);

  const tagLeaderboardItems = useMemo(() => {
    return Array.from(tagAgg.values())
      .map((t) => ({
        label: tagLabel(t.tagId),
        value: filters.metric === 'pass' ? (t.passPossible > 0 ? t.passEarned / t.passPossible : null) : t.possible > 0 ? t.earned / t.possible : null,
        tagId: t.tagId,
        submissionIds: t.submissionIds,
        submissions: t.submissions,
      }))
      .filter((r) => r.value != null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, filters.topN);
  }, [tagAgg, filters.metric, filters.topN, tagLabel]);

  const templateItems = useMemo(() => {
    const byTemplate = aggBy(filteredRecords, (r) => String(r.templateId ?? ''));
    return Array.from(byTemplate.entries()).map(([tid, rs]) => {
      const pointsEarned = rs.reduce((sum, r) => sum + (r.pointsEarnedTotal ?? 0), 0);
      const pointsPossible = rs.reduce((sum, r) => sum + (r.pointsPossibleTotal ?? 0), 0);
      const passEarned = rs.filter((r) => (r.passPct ?? 0) >= 0.7).length;
      const passPossible = rs.length;
      return {
        templateId: tid,
        label: meta?.templateName.get(tid) ?? `Template • ${shortId(tid)}`,
        value: weightedMetric(rs, filters.metric),
        submissions: rs.length,
        submissionIds: rs.map((r) => r.submissionId),
        pointsEarned,
        pointsPossible,
        passEarned,
        passPossible,
      };
    }).filter((x) => x.value != null);
  }, [filteredRecords, filters.metric, meta]);

  const templateAvg = useMemo(
    () => weightedMetric(filteredRecords, filters.metric),
    [filteredRecords, filters.metric]
  );

  const assigneeItems = useMemo(() => {
    const byAssignee = aggBy(filteredRecords, (r) => r.assigneeId);
    return Array.from(byAssignee.entries()).map(([aid, rs]) => {
      const value = weightedMetric(rs, filters.metric);
      const pointsEarned = rs.reduce((sum, r) => sum + (r.pointsEarnedTotal ?? 0), 0);
      const pointsPossible = rs.reduce((sum, r) => sum + (r.pointsPossibleTotal ?? 0), 0);
      const passEarned = rs.filter((r) => (r.passPct ?? 0) >= 0.7).length;
      const passPossible = rs.length;
      
      // Calculate consistency (coefficient of variation - lower is more consistent)
      // Using passPct values
      const passPcts = rs.map((r) => r.passPct).filter((p): p is number => p != null);
      let consistency: number | null = null;
      if (passPcts.length >= 5) {
        const mean = passPcts.reduce((a, b) => a + b, 0) / passPcts.length;
        const variance = passPcts.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / passPcts.length;
        const stdDev = Math.sqrt(variance);
        // Coefficient of variation (CV) = stdDev / mean
        // Convert to consistency score: 100% - (CV * 100), capped at 0-100
        consistency = mean > 0 ? Math.max(0, Math.min(100, (1 - stdDev / mean) * 100)) : null;
      }
      
      return {
        assigneeId: aid,
        label: rs[0]?.assigneeDisplay ?? `Assignee • ${shortId(aid)}`,
        value,
        submissions: rs.length,
        submissionIds: rs.map((r) => r.submissionId),
        deviation: value != null && templateAvg != null ? value - templateAvg : null,
        pointsEarned,
        pointsPossible,
        passEarned,
        passPossible,
        consistency,
      };
    }).filter((x) => x.value != null);
  }, [filteredRecords, filters.metric, templateAvg]);

  const singleTemplateId = filters.templateIds.length === 1 ? filters.templateIds[0]! : null;
  const templateDeepDiveRecords = useMemo(
    () => (singleTemplateId ? filteredRecords.filter((r) => r.templateId === singleTemplateId) : []),
    [filteredRecords, singleTemplateId]
  );
  const versionComparison = useMemo(() => {
    if (!templateDeepDiveRecords.length) return [];
    const byVersion = aggBy(templateDeepDiveRecords, (r) => String(r.schemaVersion ?? 'null'));
    return Array.from(byVersion.entries())
      .map(([ver, rs]) => ({
        version: ver,
        label: ver === 'null' ? '—' : `Version ${ver}`,
        value: weightedMetric(rs, filters.metric),
        submissions: rs.length,
      }))
      .filter((x) => x.value != null)
      .sort((a, b) => Number(a.version) - Number(b.version));
  }, [templateDeepDiveRecords, filters.metric]);

  const tagByTemplate = useMemo(() => {
    const m = new Map<string, { earned: number; possible: number; passEarned: number; passPossible: number }>();
    for (const r of templateDeepDiveRecords) {
      for (const [tid, t] of r.tagTotals.entries()) {
        if (!m.has(tid)) m.set(tid, { earned: 0, possible: 0, passEarned: 0, passPossible: 0 });
        const x = m.get(tid)!;
        x.earned += t.earned;
        x.possible += t.possible;
        x.passEarned += t.passEarned;
        x.passPossible += t.passPossible;
      }
    }
    return Array.from(m.entries()).map(([tagId, t]) => ({
      tagId,
      tagName: tagLabel(tagId),
      value: filters.metric === 'pass'
        ? (t.passPossible > 0 ? t.passEarned / t.passPossible : null)
        : (t.possible > 0 ? t.earned / t.possible : null),
      submissions: templateDeepDiveRecords.length,
    })).filter((x) => x.value != null);
  }, [templateDeepDiveRecords, filters.metric, tagLabel]);

  const singleSubjectId = filters.subjectIds.length === 1 ? filters.subjectIds[0]! : null;

  const subjectProfile = useMemo(() => {
    if (!singleSubjectId) return null;
    const subj = subjectAgg.get(singleSubjectId);
    if (!subj) return null;
    const tagIds = new Set<string>();
    for (const r of subj.rs) {
      for (const tid of r.tagTotals.keys()) tagIds.add(tid);
    }
    const tagBreakdown = Array.from(tagIds).map((tagId) => {
      let earned = 0, possible = 0, passEarned = 0, passPossible = 0;
      for (const r of subj.rs) {
        const t = r.tagTotals.get(tagId);
        if (t) {
          earned += t.earned;
          possible += t.possible;
          passEarned += t.passEarned;
          passPossible += t.passPossible;
        }
      }
      return {
        tagId,
        tagName: tagLabel(tagId),
        value: filters.metric === 'pass'
          ? (passPossible > 0 ? passEarned / passPossible : null)
          : (possible > 0 ? earned / possible : null),
      };
    }).filter((x) => x.value != null);
    return { ...subj, tagBreakdown };
  }, [singleSubjectId, subjectAgg, filters.metric, tagLabel]);

  const lineChartData = useMemo(() => {
    const data: { date: string; value: number; series: string; submissionIds: string[]; n: number }[] = [];
    timelineSeries.forEach((s) => {
      s.points.forEach((p) => {
        if (p.y != null)
          data.push({
            date: p.x,
            value: Math.round(p.y * 1000) / 10,
            series: s.label,
            submissionIds: p.submissionIds ?? [],
            n: p.n ?? 0,
          });
      });
    });
    return data;
  }, [timelineSeries]);

  const handleResetFilters = useCallback(() => {
    const approved = records.filter((r) => r.isApproved && r.finalizedAt).map((r) => r.finalizedAt!);
    setFilters({
      ...DEFAULT_FILTERS,
      start: approved.length ? new Date(Math.min(...approved.map((d) => d.getTime()))) : null,
      end: approved.length ? new Date(Math.max(...approved.map((d) => d.getTime()))) : null,
    });
    setView('graphs');
    setTableTab('submissions');
  }, [records]);

  const openDrillModal = useCallback((submissionIds: string[], title: string, metaStr: string, subjectId?: string) => {
    const recs = submissionIds
      .map((id) => records.find((r) => r.submissionId === id))
      .filter((r): r is NormalizedRecord => !!r)
      .sort((a, b) => (b.finalizedAt?.getTime() ?? 0) - (a.finalizedAt?.getTime() ?? 0));

    // If we have a subjectId, include tag breakdown
    let tagBreakdown: typeof drillContent extends null ? never : NonNullable<typeof drillContent>['tagBreakdown'] = undefined;
    if (subjectId) {
      const subjectTags = subjectTagAgg.get(subjectId);
      if (subjectTags) {
        tagBreakdown = Array.from(subjectTags.entries())
          .map(([tagId, data]: [string, any]) => {
            const orgData = orgTagAvg.get(tagId);
            return {
              tagId,
              label: meta?.tagName.get(tagId) ?? `Tag • ${shortId(tagId)}`,
              pointsEarned: data.pointsEarned,
              pointsPossible: data.pointsPossible,
              pointsPct: data.pointsPct,
              passEarned: data.passEarned,
              passPossible: data.passPossible,
              passPct: data.passPct,
              orgPct: orgData?.pointsPct ?? null,
              delta: data.delta,
              submissions: data.pointsPossible > 0 ? Math.ceil(data.pointsPossible / 100) : 0, // Approximate
            };
          })
          .filter((t) => t.pointsPossible > 0)
          .sort((a, b) => (b.pointsPct ?? 0) - (a.pointsPct ?? 0));
      }
    }

    setDrillContent({ title, meta: metaStr, records: recs, tagBreakdown });
    setDrillModalOpen(true);
  }, [records, meta, subjectTagAgg, orgTagAvg]);

  const handleDownloadPdf = useCallback(async () => {
    const templateLabels =
      filters.templateIds.length > 0
        ? filters.templateIds.map((id) => meta?.templateName.get(id) ?? shortId(id)).join(', ')
        : 'All';
    const subjectPart =
      filters.subjectIds.length > 0
        ? `Subjects: ${filters.subjectIds.length} selected`
        : 'Subjects: All';
    const datePart =
      filters.useDates && filters.start && filters.end
        ? `${dayjs(filters.start).format('YYYY-MM-DD')} to ${dayjs(filters.end).format('YYYY-MM-DD')}`
        : 'Full range';
    const filterSummary = [
      `Templates: ${templateLabels}`,
      subjectPart,
      `Date: ${datePart}`,
      `Bucket: ${filters.bucket}`,
      `Metric: ${metricLabel(filters.metric)}`,
      filters.approvedOnly ? 'Approved only' : 'All statuses',
      filters.assigneeId ? 'Single assignee' : 'All assignees',
      filters.schemaVersions.length ? `Schema versions: ${filters.schemaVersions.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('  •  ');

    setPdfLoading(true);
    try {
      let logoDataUrl: string | undefined;
      const tryLogo = async (url: string): Promise<string | undefined> => {
        try {
          const r = await fetch(url);
          if (!r.ok) return undefined;
          const blob = await r.blob();
          if (!blob.type.startsWith('image/')) return undefined;
          return await new Promise<string>((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result as string);
            fr.onerror = rej;
            fr.readAsDataURL(blob);
          });
        } catch {
          return undefined;
        }
      };
      logoDataUrl = await tryLogo('/logo.png') ?? await tryLogo('/favicon.ico');
      // When Tables view: pass all table data so PDF includes every table
      const subjectTableRows =
        view === 'tables'
          ? Array.from(subjectAgg.values())
              .filter((x) => x.score != null)
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
              .map((s) => ({
                subject: s.subjectDisplay,
                score: pct1(s.score),
                submissions: s.submissions,
                baselineDelta:
                  s.baseDelta != null ? (s.baseDelta >= 0 ? `+${(s.baseDelta * 100).toFixed(1)}%` : `${(s.baseDelta * 100).toFixed(1)}%`) : '—',
              }))
          : undefined;
      const tagTableRows =
        view === 'tables'
          ? Array.from(tagAgg.values()).map((t) => ({
              tag: tagLabel(t.tagId),
              score: pct1(
                filters.metric === 'pass'
                  ? (t.passPossible > 0 ? t.passEarned / t.passPossible : null)
                  : t.possible > 0
                    ? t.earned / t.possible
                    : null
              ),
              submissions: t.submissions,
              gapPts: t.possible - t.earned,
            }))
          : undefined;
      const submissionRowsForPdf =
        view === 'tables'
          ? filteredRecords.slice(0, 50).map((r) => ({
              templateName: r.templateName,
              subjectDisplay: r.subjectDisplay,
              assigneeDisplay: r.assigneeDisplay,
              metricValue: pct1(filters.metric === 'points' ? r.pointsPct : r.passPct),
              finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString().slice(0, 10) : '—',
            }))
          : undefined;

      // Capture chart images from the live DOM so PDF always gets current data (refs can be stale after re-renders)
      const chartKeys = ['timeline', 'subjectRanking', 'tagPerformance', 'templateComparison', 'assigneeScoring'] as const;
      const chartImages =
        view === 'graphs'
          ? await new Promise<{
              timeline?: string;
              subjectRanking?: string;
              tagPerformance?: string;
              templateComparison?: string;
              assigneeScoring?: string;
            }>((resolve) => {
              const capture = () => {
                const out: {
                  timeline?: string;
                  subjectRanking?: string;
                  tagPerformance?: string;
                  templateComparison?: string;
                  assigneeScoring?: string;
                } = {};
                for (const key of chartKeys) {
                  const wrapper = document.querySelector(`[data-pdf-chart="${key}"]`);
                  const canvas = wrapper?.querySelector?.('canvas');
                  if (canvas && typeof (canvas as HTMLCanvasElement).toDataURL === 'function') {
                    try {
                      const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
                      if (url) out[key] = url;
                    } catch {
                      // skip
                    }
                  }
                }
                resolve(out);
              };
              requestAnimationFrame(() => requestAnimationFrame(capture));
            })
          : undefined;

      downloadAnalyticsPdf({
        filterSummary,
        metricLabel: metricLabel(filters.metric),
        view,
        tableTab,
        chartImages,
        kpis: {
          filteredSubmissions: filteredRecords.length,
          totalSubmissions: records.length,
          avgMetric: pct1(weightedMetric(filteredRecords, filters.metric)),
          subjectsCount: new Set(filteredRecords.map((r) => r.subjectId)).size,
          tagsCount: tagAgg.size,
          templatesCount: new Set(filteredRecords.map((r) => r.templateId).filter(Boolean)).size,
        },
        leaderboardItems: leaderboardItems.map((s) => ({ label: s.label, value: s.value, sub: s.sub })),
        tagLeaderboardItems: tagLeaderboardItems.map((t) => ({
          label: t.label,
          value: t.value,
          submissions: t.submissions,
        })),
        templateItems: templateItems.map((t) => ({ label: t.label, value: t.value, submissions: t.submissions })),
        assigneeItems: filters.showAssignee ? assigneeItems.map((a) => ({ label: a.label, value: a.value, submissions: a.submissions, deviation: a.deviation })) : undefined,
        subjectTableRows,
        tagTableRows,
        submissionRows: submissionRowsForPdf,
        logoDataUrl,
      });
      message.success('PDF downloaded');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  }, [
    filters,
    meta,
    view,
    tableTab,
    filteredRecords,
    records.length,
    tagAgg,
    subjectAgg,
    weightedMetric,
    leaderboardItems,
    tagLeaderboardItems,
    templateItems,
    assigneeItems,
    tagLabel,
  ]);

  const exportSubmissionsCSV = useCallback(() => {
    const rows = filteredRecords.map((r) => ({
      submissionId: r.submissionId,
      templateId: r.templateId ?? '',
      templateName: r.templateName,
      schemaVersion: r.schemaVersion ?? '',
      subjectId: r.subjectId,
      subject: r.subjectDisplay,
      assigneeId: r.assigneeId,
      assignee: r.assigneeDisplay,
      finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : '',
      pointsEarned: r.pointsEarnedTotal,
      pointsPossible: r.pointsPossibleTotal,
      pointsPct: r.pointsPct ?? '',
      passEarned: r.passEarnedTotal,
      passPossible: r.passPossibleTotal,
      passPct: r.passPct ?? '',
      approvalStatus: r.approvalStatus,
      status: r.status,
      disputeStatus: r.disputeStatus,
    }));
    downloadCSV('submissions_scope.csv', toCSV(rows));
    message.success('Exported submissions CSV');
  }, [filteredRecords]);

  const exportAnswersCSV = useCallback(() => {
    const rows: Record<string, unknown>[] = [];
    for (const r of filteredRecords) {
      for (const a of r.answers) {
        rows.push({
          submissionId: r.submissionId,
          finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : '',
          templateName: r.templateName,
          schemaVersion: r.schemaVersion ?? '',
          subject: r.subjectDisplay,
          assignee: r.assigneeDisplay,
          qid: a.qid,
          qtype: a.qtype,
          question: a.prompt,
          answer: a.qtype === 'matrixField' ? '(Matrix)' : a.value,
          tags: (a.tags ?? []).map((tid) => tagLabel(tid)).join('; '),
          pointsEarned: a.pointsEarned,
          pointsPossible: a.pointsPossible,
          passEarned: a.passEarned,
          passPossible: a.passPossible,
        });
      }
    }
    downloadCSV('answers_scope.csv', toCSV(rows));
    message.success('Exported answers CSV');
  }, [filteredRecords, tagLabel]);

  const exportSubjectsCSV = useCallback(() => {
    const ordered = Array.from(subjectAgg.values())
      .filter((x) => x.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const rows = ordered.map((s) => {
      const lastDate =
        s.rs
          .map((r) => r.finalizedAt)
          .filter((d): d is Date => !!d)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const vals = s.rs.map((r) => metricValue(r, filters.metric));
      const vol = stddev(vals);
      const withDate = s.rs.filter((r) => r.finalizedAt).sort((a, b) => (a.finalizedAt!.getTime() - b.finalizedAt!.getTime()));
      const vs = withDate.map((r) => metricValue(r, filters.metric)).filter((v): v is number => v != null && Number.isFinite(v));
      let momentum: number | null = null;
      if (vs.length >= 2) {
        const k = Math.min(3, vs.length);
        const first = vs.slice(0, k).reduce((sum, v) => sum + v, 0) / k;
        const last = vs.slice(-k).reduce((sum, v) => sum + v, 0) / k;
        momentum = last - first;
      }
      return {
        subjectId: s.subjectId,
        subject: s.subjectDisplay,
        score: s.score ?? '',
        baselineDelta: s.baseDelta ?? '',
        volatility: vol,
        momentum: momentum ?? '',
        submissions: s.submissions,
        templates: s.templatesSet.size,
        lastApproved: lastDate ? lastDate.toISOString() : '',
      };
    });
    downloadCSV('subjects_scope.csv', toCSV(rows));
    message.success('Exported subjects CSV');
  }, [subjectAgg, filters.metric]);

  const exportTagsSummaryCSV = useCallback(() => {
    const rows = Array.from(tagAgg.values()).map((t) => ({
      tagId: t.tagId,
      tag: tagLabel(t.tagId),
      score:
        filters.metric === 'pass'
          ? (t.passPossible > 0 ? t.passEarned / t.passPossible : null)
          : t.possible > 0
            ? t.earned / t.possible
            : null,
      gapPts: t.possible - t.earned,
      coveragePts: t.possible,
      submissions: t.submissions,
      pointsEarned: t.earned,
      pointsPossible: t.possible,
      passEarned: t.passEarned,
      passPossible: t.passPossible,
    }));
    downloadCSV('tags_scope.csv', toCSV(rows));
    message.success('Exported tags summary CSV');
  }, [tagAgg, tagLabel, filters.metric]);

  const exportQuestionsCSV = useCallback(() => {
    const groups = groupQuestions(filteredRecords).slice(0, 500);
    const rows = groups.map((g) => ({
      templateName: g.templateName,
      qid: g.qid,
      versions: g.schemaVersions.join('|'),
      question: g.prompt,
      tags: g.tags.map((tid) => tagLabel(tid)).join('; '),
      pointsPct: g.pointsPct ?? '',
      passPct: g.passPct ?? '',
      gapPts: g.gapPts,
      answers: g.nAnswers,
      topOptions: Array.from(g.optionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, c]) => `${k}:${c}`)
        .join(' | '),
    }));
    downloadCSV('questions_scope.csv', toCSV(rows));
    message.success('Exported questions CSV');
  }, [filteredRecords, tagLabel]);

  const exportTagLeaderboardCSV = useCallback(() => {
    const rows = tagLeaderboardItems.map((t, i) => ({
      rank: i + 1,
      tag: t.label,
      tagId: t.tagId,
      [filters.metric === 'pass' ? 'passPct' : 'pointsPct']: t.value != null ? (t.value * 100).toFixed(1) + '%' : '',
      submissions: t.submissions,
    }));
    downloadCSV('tag_leaderboard.csv', toCSV(rows));
    message.success('Exported tag leaderboard CSV');
  }, [tagLeaderboardItems, filters.metric]);

  const exportTagBySubjectCSV = useCallback(() => {
    const subjectTagRows: Record<string, unknown>[] = [];
    const tagIds = Array.from(tagAgg.keys());
    for (const subj of subjectAgg.values()) {
      const byTag: Record<string, number | null> = {};
      for (const tid of tagIds) {
        let earned = 0, possible = 0, passEarned = 0, passPossible = 0;
        for (const r of subj.rs) {
          const t = r.tagTotals.get(tid);
          if (t) {
            earned += t.earned;
            possible += t.possible;
            passEarned += t.passEarned;
            passPossible += t.passPossible;
          }
        }
        byTag[tid] = filters.metric === 'pass'
          ? (passPossible > 0 ? passEarned / passPossible : null)
          : (possible > 0 ? earned / possible : null);
      }
      subjectTagRows.push({
        subject: subj.subjectDisplay,
        subjectId: subj.subjectId,
        submissions: subj.submissions,
        ...Object.fromEntries(
          tagIds.map((tid) => [tagLabel(tid), byTag[tid] != null ? (byTag[tid]! * 100).toFixed(1) + '%' : ''])
        ),
      });
    }
    downloadCSV('tag_by_subject.csv', toCSV(subjectTagRows));
    message.success('Exported tag-by-subject CSV');
  }, [subjectAgg, tagAgg, tagLabel, filters.metric]);

  if (!isAdmin) {
    return (
      <Alert
        type="warning"
        message="Access restricted"
        description="Analytics is available only for super administrators."
        showIcon
        style={{ margin: 24 }}
      />
    );
  }

  const isMobile = !screens.md;

  // Build enhanced subject options with profile names and avatars
  const subjectOptions = useMemo(() => {
    const uniqueIds = Array.from(new Set(records.map((r) => r.subjectId)));
    const options = uniqueIds.map((id) => {
      const profile = profileLookup[id];
      // Priority: profile name > meta fallback > Unknown user with ID
      let displayName: string;
      let secondary: string | undefined;
      
      if (profile) {
        const profileName = getProfileDisplayName(profile, '');
        if (profileName) {
          displayName = profileName;
        } else {
          displayName = 'Unknown user';
          secondary = shortId(id);
        }
      } else {
        const metaName = meta?.subjectName.get(id);
        if (metaName && !metaName.includes('Subject •') && !metaName.includes('Group:')) {
          displayName = metaName;
        } else {
          displayName = 'Unknown user';
          secondary = shortId(id);
        }
      }
      
      const avatarKey = profile ? getProfileAvatarKey(profile) : null;
      return {
        value: id,
        label: displayName,
        secondary,
        avatarKey,
        profile,
      };
    });
    // Sort alphabetically by display name
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [records, meta, profileLookup]);

  // Build enhanced assignee options with profile names and avatars
  const assigneeOptions = useMemo(() => {
    const uniqueIds = Array.from(new Set(records.map((r) => r.assigneeId).filter(Boolean)));
    const options = uniqueIds.map((id) => {
      if (!id) return null;
      const profile = profileLookup[id];
      // Priority: profile name > record fallback > Unknown user with ID
      let displayName: string;
      let secondary: string | undefined;
      
      if (profile) {
        const profileName = getProfileDisplayName(profile, '');
        if (profileName) {
          displayName = profileName;
        } else {
          displayName = 'Unknown user';
          secondary = shortId(id);
        }
      } else {
        const recordName = records.find((r) => r.assigneeId === id)?.assigneeDisplay;
        if (recordName && !recordName.includes('Assignee •')) {
          displayName = recordName;
        } else {
          displayName = 'Unknown user';
          secondary = shortId(id);
        }
      }
      
      const avatarKey = profile ? getProfileAvatarKey(profile) : null;
      return {
        value: id,
        label: displayName,
        secondary,
        avatarKey,
        profile,
      };
    }).filter(Boolean) as Array<{ value: string; label: string; secondary?: string; avatarKey: string | null; profile?: ProfileData }>;
    // Sort alphabetically by display name
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [records, profileLookup]);

  const templateOptions = useMemo(() => {
    const uniqueIds = Array.from(new Set(records.map((r) => r.templateId).filter(Boolean)));
    return uniqueIds.map((id) => {
      const name = meta?.templateName.get(id!) ?? '';
      // Better fallback: show 'Unknown template' as primary, ID as secondary
      const displayName = name && !name.includes('Template •') ? name : null;
      return {
        value: id!,
        label: displayName ?? 'Unknown template',
        secondary: displayName ? undefined : shortId(id!),
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [records, meta]);

  // Only show tags that have data in records
  const tagOptions = useMemo(() => {
    const tagIdsWithData = new Set<string>();
    for (const r of records) {
      for (const [tagId] of r.tagTotals) {
        tagIdsWithData.add(tagId);
      }
    }
    return Array.from(tagIdsWithData).map((id) => ({
      value: id,
      label: meta?.tagName.get(id) ?? `Tag • ${shortId(id)}`,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [records, meta]);
  const schemaVersionOptions = useMemo(() => {
    const seen = new Set<number | null>();
    const out: { value: number | string; label: string }[] = [];
    for (const r of records) {
      const v = r.schemaVersion;
      if (v != null && !seen.has(v)) {
        seen.add(v);
        out.push({ value: v, label: `Version ${v}` });
      }
    }
    return out.sort((a, b) => Number(a.value) - Number(b.value));
  }, [records]);

  return (
    <div style={{ padding: isMobile ? 12 : 24, maxWidth: 1620, margin: '0 auto' }}>
      <Card
        style={{ marginBottom: 16, borderRadius: token.borderRadiusLG, boxShadow: token.boxShadowSecondary }}
      >
        <Row gutter={[12, 12]} align="middle" wrap>
          <Col flex="auto">
            <Space wrap direction="vertical" align="start">
              <Space wrap>
                <Text strong style={{ fontSize: 16 }}>EvalHero — Analytics</Text>
                <Tag color="blue">{records.length.toLocaleString()} submissions loaded</Tag>
                <Tag color="green">{filteredRecords.length.toLocaleString()} in scope</Tag>
              </Space>
              {loading && fetchPhase && (
                <Space direction="vertical" size={2}>
                  <Progress
                    percent={Math.round(fetchProgress)}
                    size="small"
                    status="active"
                    format={() => fetchDetails}
                    style={{ width: 300 }}
                  />
                </Space>
              )}
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Button
                type={view === 'graphs' ? 'primary' : 'default'}
                onClick={() => setView('graphs')}
              >
                Graphs
              </Button>
              <Button
                type={view === 'tables' ? 'primary' : 'default'}
                onClick={() => setView('tables')}
              >
                Tables
              </Button>
              <Button
                icon={<PrinterOutlined />}
                loading={pdfLoading}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </Button>
              <Button onClick={() => setExportModalOpen(true)}>
                Export CSV
              </Button>
              <Button danger onClick={handleResetFilters}>
                Reset
              </Button>
              <Button type="primary" loading={loading} onClick={loadData}>
                Refresh data
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert
          type="error"
          message="Could not load data"
          description={error}
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={loadData}>
              Retry
            </Button>
          }
        />
      )}

      <Collapse
        defaultActiveKey={['filters']}
        items={[
          {
            key: 'filters',
            label: 'Filters & scope',
            children: (
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12} md={8}>
                  <Tooltip title="Filter analytics to submissions from selected templates">
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Templates</Text>
                  </Tooltip>
                  <Select
                    mode="multiple"
                    placeholder="All templates"
                    options={templateOptions}
                    value={filters.templateIds}
                    onChange={(v) => setFilters((p) => ({ ...p, templateIds: v ?? [] }))}
                    style={{ width: '100%' }}
                    maxTagCount="responsive"
                    optionFilterProp="label"
                    optionRender={(option) => {
                      const opt = option.data as { secondary?: string };
                      return (
                        <Space direction="vertical" size={0}>
                          <span>{option.label as string}</span>
                          {opt?.secondary && <Text type="secondary" style={{ fontSize: 12 }}>{opt.secondary}</Text>}
                        </Space>
                      );
                    }}
                  />
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Tooltip title="Filter analytics to submissions from selected subjects">
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Subjects</Text>
                  </Tooltip>
                  <Select
                    mode="multiple"
                    placeholder="All subjects"
                    options={subjectOptions}
                    value={filters.subjectIds}
                    onChange={(v) => setFilters((p) => ({ ...p, subjectIds: v ?? [] }))}
                    style={{ width: '100%' }}
                    maxTagCount="responsive"
                    optionFilterProp="label"
                    optionRender={(option) => {
                      const opt = option.data as { avatarKey?: string | null; secondary?: string };
                      return (
                        <Space direction="vertical" size={0}>
                          <Space>
                            <AssetAvatar avatarKey={opt?.avatarKey ?? null} size="small" />
                            <span>{option.label as string}</span>
                          </Space>
                          {opt?.secondary && <Text type="secondary" style={{ fontSize: 12 }}>{opt.secondary}</Text>}
                        </Space>
                      );
                    }}
                    tagRender={(props) => {
                      const opt = subjectOptions.find((o) => o.value === props.value);
                      return (
                        <Tag
                          {...props}
                          closable={props.closable}
                          onClose={props.onClose}
                          className="ant-tag-with-avatar"
                        >
                          <Space size={4}>
                            <AssetAvatar avatarKey={opt?.avatarKey ?? null} size="small" />
                            <span>{props.label}</span>
                          </Space>
                        </Tag>
                      );
                    }}
                  />
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Tooltip title="Filter analytics to submissions with selected tags">
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Tags</Text>
                  </Tooltip>
                  <Select
                    mode="multiple"
                    placeholder="All tags"
                    options={tagOptions}
                    value={filters.tagIds}
                    onChange={(v) => setFilters((p) => ({ ...p, tagIds: v ?? [] }))}
                    style={{ width: '100%' }}
                    maxTagCount="responsive"
                    optionFilterProp="label"
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Tooltip title="Filter analytics to submissions assigned to selected people">
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Assignee</Text>
                  </Tooltip>
                  <Select
                    placeholder="All assignees"
                    options={[{ value: '', label: 'All assignees', avatarKey: null, secondary: undefined }, ...assigneeOptions]}
                    value={filters.assigneeId || undefined}
                    onChange={(v) => setFilters((p) => ({ ...p, assigneeId: v ?? '' }))}
                    style={{ width: '100%' }}
                    optionFilterProp="label"
                    optionRender={(option) => {
                      if (option.value === '') {
                        return <span>{option.label as string}</span>;
                      }
                      const opt = option.data as { avatarKey?: string | null; secondary?: string };
                      return (
                        <Space direction="vertical" size={0}>
                          <Space>
                            <AssetAvatar avatarKey={opt?.avatarKey ?? null} size="small" />
                            <span>{option.label as string}</span>
                          </Space>
                          {opt?.secondary && <Text type="secondary" style={{ fontSize: 12 }}>{opt.secondary}</Text>}
                        </Space>
                      );
                    }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Tooltip title="Filter by schema version (form structure)">
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Template version</Text>
                  </Tooltip>
                  <Select
                    mode="multiple"
                    placeholder="All versions"
                    options={schemaVersionOptions}
                    value={filters.schemaVersions}
                    onChange={(v) => setFilters((p) => ({ ...p, schemaVersions: v ?? [] }))}
                    style={{ width: '100%' }}
                    maxTagCount="responsive"
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Tooltip title="Choose which metric to display in charts and tables">
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Metric</Text>
                  </Tooltip>
                  <Select
                    options={[
                      { value: 'points', label: 'Points %' },
                      { value: 'pass', label: 'Pass %' },
                    ]}
                    value={filters.metric}
                    onChange={(v) => setFilters((p) => ({ ...p, metric: v ?? 'points' }))}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Tooltip title="Group timeline data by time period">
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Bucket</Text>
                  </Tooltip>
                  <Select
                    options={[
                      { value: 'day', label: 'Day' },
                      { value: 'week', label: 'Week' },
                      { value: 'month', label: 'Month' },
                      { value: 'quarter', label: 'Quarter' },
                    ]}
                    value={filters.bucket}
                    onChange={(v) => setFilters((p) => ({ ...p, bucket: v ?? 'week' }))}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Date range</Text>
                  <RangePicker
                    style={{ width: '100%' }}
                    value={
                      filters.start && filters.end
                        ? [dayjs(filters.start), dayjs(filters.end)]
                        : null
                    }
                    onChange={(dates) =>
                      setFilters((p) => ({
                        ...p,
                        start: dates?.[0]?.toDate() ?? null,
                        end: dates?.[1]?.toDate() ?? null,
                      }))
                    }
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Top N</Text>
                  <InputNumber
                    min={5}
                    max={50}
                    value={filters.topN}
                    onChange={(v) => setFilters((p) => ({ ...p, topN: clamp(v ?? 15, 5, 50) }))}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={12}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Search</Text>
                  <Input
                    placeholder="Search question text, answer, tag…"
                    value={filters.search}
                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                    allowClear
                  />
                </Col>
                <Col span={24}>
                  <Space wrap>
                    <Checkbox
                      checked={filters.approvedOnly}
                      onChange={(e) => setFilters((p) => ({ ...p, approvedOnly: e.target.checked }))}
                    >
                      Approved only
                    </Checkbox>
                    <Checkbox
                      checked={filters.useDates}
                      onChange={(e) => setFilters((p) => ({ ...p, useDates: e.target.checked }))}
                    >
                      Apply date range
                    </Checkbox>
                    <Checkbox
                      checked={filters.showHeatmap}
                      onChange={(e) => setFilters((p) => ({ ...p, showHeatmap: e.target.checked }))}
                    >
                      Show tag heatmap
                    </Checkbox>
                    <Checkbox
                      checked={filters.showAssignee}
                      onChange={(e) => setFilters((p) => ({ ...p, showAssignee: e.target.checked }))}
                    >
                      Show assignee panel
                    </Checkbox>
                  </Space>
                </Col>
              </Row>
            ),
          },
        ]}
        style={{ marginBottom: 16 }}
      />

      {view === 'graphs' && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card size="small">
                <Statistic
                  title="Filtered submissions"
                  value={filteredRecords.length}
                  suffix={`/ ${records.length} total`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card size="small">
                <Statistic
                  title={`Avg ${metricLabel(filters.metric)} (weighted)`}
                  value={pct1(weightedMetric(filteredRecords, filters.metric))}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card size="small">
                <Statistic
                  title="Subjects in scope"
                  value={new Set(filteredRecords.map((r) => r.subjectId)).size}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card size="small">
                <Statistic title="Tags covered" value={tagAgg.size} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card size="small">
                <Statistic title="Templates in scope" value={new Set(filteredRecords.map((r) => r.templateId).filter(Boolean)).size} />
              </Card>
            </Col>
          </Row>

          <Card title="Growth timeline" style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Click a point to view submissions in that bucket (multiple submissions are averaged).
            </Text>
            {lineChartData.length > 0 ? (
              <div data-pdf-chart="timeline">
                <Line
                  chartRef={(ch) => { chartRefs.current.timeline = ch ?? undefined; }}
                data={lineChartData}
                xField="date"
                yField="value"
                seriesField="series"
                smooth
                point={{ size: 3 }}
                height={320}
                legend={{ position: 'top-right' }}
                color={[token.colorPrimary, token.green, token.orange, token.purple, token.cyan]}
                onEvent={(_, event) => {
                  const d = (event as { data?: { submissionIds?: string[]; series?: string; date?: string; n?: number } })?.data;
                  if (d?.submissionIds?.length)
                    openDrillModal(d.submissionIds, `${d.series ?? ''} • ${d.date ?? ''}`, `${d.n ?? 0} submission(s)`);
                }}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <Text type="secondary">
                  No timeline data for current filters.<br />
                  Try adjusting your filters or check if submissions exist in the selected date range.
                </Text>
              </div>
            )}
          </Card>

          <Card title="Subject ranking" style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Click a bar to view that subject&apos;s submissions.
            </Text>
            {leaderboardItems.length > 0 ? (
              <div data-pdf-chart="subjectRanking">
                <Column
                  chartRef={(ch) => { chartRefs.current.subjectRanking = ch ?? undefined; }}
                  data={leaderboardItems.map((d) => ({ label: d.label, value: (d.value ?? 0) * 100, submissionIds: d.submissionIds }))}
                xField="label"
                yField="value"
                height={Math.min(400, leaderboardItems.length * 32)}
                columnStyle={{ cursor: 'pointer' }}
                color={token.colorPrimary}
                onEvent={(_, event) => {
                  const d = (event as { data?: { submissionIds?: string[]; label?: string } })?.data;
                  if (d?.submissionIds?.length)
                    openDrillModal(d.submissionIds, d.label ?? 'Subject submissions', `${d.submissionIds.length} submission(s)`);
                }}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <Text type="secondary">
                  No subject data available.<br />
                  Subjects will appear here once submissions are recorded.
                </Text>
              </div>
            )}
          </Card>

          {singleSubjectId && subjectProfile && (
            <Card title="Subject profile" style={{ marginBottom: 16 }}>
              <Row gutter={[12, 12]}>
                <Col span={24}>
                  <Text strong>{subjectProfile.subjectDisplay}</Text> — {subjectProfile.submissions} submissions, {subjectProfile.templatesSet.size} template(s)
                </Col>
                <Col span={12}>
                  <Statistic title="Baseline Δ (vs first finalized)" value={subjectProfile.baseDelta != null ? (subjectProfile.baseDelta >= 0 ? `+${(subjectProfile.baseDelta * 100).toFixed(1)}%` : `${(subjectProfile.baseDelta * 100).toFixed(1)}%`) : '—'} />
                </Col>
                <Col span={12}>
                  <Statistic title={`Avg ${metricLabel(filters.metric)}`} value={pct1(subjectProfile.score)} />
                </Col>
                {subjectProfile.tagBreakdown.length > 0 && (
                  <Col span={24}>
                    <Text type="secondary">Tag skill breakdown</Text>
                    <Table
                      size="small"
                      dataSource={subjectProfile.tagBreakdown}
                      rowKey="tagId"
                      columns={[
                        { title: 'Tag', dataIndex: 'tagName', key: 'tagName' },
                        { title: metricLabel(filters.metric), dataIndex: 'value', key: 'value', render: (v: number | null) => pct1(v) },
                      ]}
                      pagination={false}
                      style={{ marginTop: 8 }}
                    />
                  </Col>
                )}
              </Row>
            </Card>
          )}

          {filters.showAssignee && assigneeItems.length > 0 && (
            <Card title="Assignee scoring" style={{ marginBottom: 16 }}>
              {templateAvg != null && (
                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                  Template average: {pct1(templateAvg)} — bars show deviation from this average.
                </Text>
              )}
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                Click a bar to view that assignee&apos;s submissions.
              </Text>
              <div data-pdf-chart="assigneeScoring">
                <Column
                  chartRef={(ch) => { chartRefs.current.assigneeScoring = ch ?? undefined; }}
                  data={assigneeItems.map((d) => ({ label: d.label, value: (d.value ?? 0) * 100, submissionIds: d.submissionIds }))}
                xField="label"
                yField="value"
                height={280}
                columnStyle={{ cursor: 'pointer' }}
                color={token.colorPrimary}
                onEvent={(_, event) => {
                  const d = (event as { data?: { submissionIds?: string[] } })?.data;
                  if (d?.submissionIds?.length)
                    openDrillModal(d.submissionIds, 'Assignee submissions', `${d.submissionIds.length} submission(s)`);
                }}
                />
              </div>
            </Card>
          )}

          <Card title="Tag performance" style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Click a bar to view submissions that contributed to this tag.
            </Text>
            {tagLeaderboardItems.length > 0 ? (
              <div data-pdf-chart="tagPerformance">
                <Column
                  chartRef={(ch) => { chartRefs.current.tagPerformance = ch ?? undefined; }}
                  data={tagLeaderboardItems.map((d) => ({ label: d.label, value: (d.value ?? 0) * 100, submissionIds: d.submissionIds }))}
                xField="label"
                yField="value"
                height={Math.min(400, tagLeaderboardItems.length * 32)}
                columnStyle={{ cursor: 'pointer' }}
                color={token.volcano}
                onEvent={(_, event) => {
                  const d = (event as { data?: { submissionIds?: string[]; label?: string } })?.data;
                  if (d?.submissionIds?.length)
                    openDrillModal(d.submissionIds, `Tag: ${d.label ?? ''}`, `${d.submissionIds.length} submission(s)`);
                }}
                />
              </div>
            ) : (
              <Text type="secondary">No tag data.</Text>
            )}
          </Card>

          <Card title="Template comparison" style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Click a bar to view submissions for that template.
            </Text>
            {templateItems.length > 0 ? (
              <div data-pdf-chart="templateComparison">
                <Column
                  chartRef={(ch) => { chartRefs.current.templateComparison = ch ?? undefined; }}
                  data={templateItems.map((d) => ({ label: d.label, value: (d.value ?? 0) * 100, submissionIds: d.submissionIds }))}
                xField="label"
                yField="value"
                height={280}
                columnStyle={{ cursor: 'pointer' }}
                color={token.green}
                onEvent={(_, event) => {
                  const d = (event as { data?: { submissionIds?: string[]; label?: string } })?.data;
                  if (d?.submissionIds?.length)
                    openDrillModal(d.submissionIds, `Template: ${d.label ?? ''}`, `${d.submissionIds.length} submission(s)`);
                }}
                />
              </div>
            ) : (
              <Text type="secondary">No template data.</Text>
            )}
          </Card>

          {singleTemplateId && (versionComparison.length > 0 || tagByTemplate.length > 0) && (
            <Card title="Template deep dive" style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                {meta?.templateName.get(singleTemplateId) ?? shortId(singleTemplateId)} — version comparison & tag performance within this template.
              </Text>
              {versionComparison.length > 0 && (
                <>
                  <Text strong>Schema version comparison</Text>
                  <Table
                    size="small"
                    dataSource={versionComparison}
                    rowKey="version"
                    columns={[
                      { title: 'Version', dataIndex: 'label', key: 'label' },
                      { title: metricLabel(filters.metric), dataIndex: 'value', key: 'value', render: (v: number | null) => pct1(v) },
                      { title: 'Submissions', dataIndex: 'submissions', key: 'submissions' },
                    ]}
                    pagination={false}
                    style={{ marginBottom: 16 }}
                  />
                </>
              )}
              {tagByTemplate.length > 0 && (
                <>
                  <Text strong>Tag performance within template</Text>
                  <Table
                    size="small"
                    dataSource={tagByTemplate}
                    rowKey="tagId"
                    columns={[
                      { title: 'Tag', dataIndex: 'tagName', key: 'tagName' },
                      { title: metricLabel(filters.metric), dataIndex: 'value', key: 'value', render: (v: number | null) => pct1(v) },
                    ]}
                    pagination={false}
                  />
                </>
              )}
            </Card>
          )}
        </>
      )}

      {view === 'tables' && (
        <Card>
          <Tabs
            activeKey={tableTab}
            onChange={setTableTab}
            items={[
              {
                key: 'templates',
                label: 'Templates',
                children: (
                  <Table
                    size="small"
                    dataSource={templateItems as any}
                    rowKey="templateId"
                    columns={[
                      { 
                        title: 'Template', 
                        dataIndex: 'label', 
                        key: 'label',
                        render: (text: string, record: any) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{text}</div>
                            <Text type="secondary" style={{ fontSize: 12 }}>{(record.templateId ?? '').slice(-6)}</Text>
                          </div>
                        ),
                      },
                      {
                        title: 'Points',
                        key: 'points',
                        align: 'right',
                        render: (_: unknown, row: any) => {
                          const pointsEarned = row.pointsEarned ?? 0;
                          const pointsPossible = row.pointsPossible ?? 0;
                          const pct = pointsPossible > 0 ? pointsEarned / pointsPossible : null;
                          return pointsPossible > 0 
                            ? <><Text strong>{Math.round(pointsEarned)} / {Math.round(pointsPossible)}</Text> <Text type="secondary">({pct1(pct)})</Text></>
                            : '—';
                        },
                      },
                      {
                        title: 'Pass',
                        key: 'pass',
                        align: 'right',
                        render: (_: unknown, row: any) => {
                          const passEarned = row.passEarned ?? 0;
                          const passPossible = row.passPossible ?? 0;
                          const pct = passPossible > 0 ? passEarned / passPossible : null;
                          return passPossible > 0 
                            ? <><Text strong>{passEarned} / {passPossible}</Text> <Text type="secondary">({pct1(pct)})</Text></>
                            : '—';
                        },
                      },
                      { 
                        title: 'Submissions', 
                        dataIndex: 'submissions', 
                        key: 'submissions',
                        align: 'right',
                      },
                      {
                        title: '',
                        key: 'drill',
                        align: 'right',
                        render: (_: unknown, row: any) => (
                          <Button
                            size="small"
                            type="link"
                            onClick={() =>
                              openDrillModal(row.submissionIds ?? [], `Template: ${row.label}`, `${row.submissions} submissions`)
                            }
                          >
                            View
                          </Button>
                        ),
                      },
                    ]}
                    pagination={{ pageSize: 20 }}
                  />
                ),
              },
              {
                key: 'submissions',
                label: 'Submissions',
                children: (
                  <Table
                    size="small"
                    dataSource={filteredRecords as any}
                    rowKey="submissionId"
                    columns={[
                      { 
                        title: 'Submission / Subject', 
                        key: 'subject',
                        render: (_: unknown, r: any) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{r.subjectDisplay}</div>
                            <Text type="secondary" style={{ fontSize: 12 }}>{r.submissionId?.slice(-8)}</Text>
                          </div>
                        ),
                      },
                      { title: 'Template', dataIndex: 'templateName', key: 'templateName', ellipsis: true },
                      { title: 'Assignee', dataIndex: 'assigneeDisplay', key: 'assigneeDisplay', ellipsis: true },
                      {
                        title: 'Points',
                        key: 'points',
                        align: 'right',
                        render: (_: unknown, r: any) => r.pointsPossible > 0 
                          ? `${r.pointsEarned ?? 0} / ${r.pointsPossible} (${pct1(r.pointsPct)})`
                          : '—',
                      },
                      {
                        title: 'Pass',
                        key: 'pass',
                        align: 'right',
                        render: (_: unknown, r: any) => r.passPossible > 0 
                          ? `${r.passEarned ?? 0} / ${r.passPossible} (${pct1(r.passPct)})`
                          : '—',
                      },
                      {
                        title: 'Result',
                        key: 'result',
                        align: 'center',
                        render: (_: unknown, r: any) => {
                          const passed = r.passPct != null && r.passPct >= 0.7;
                          return passed ? (
                            <Tag color="green">Pass</Tag>
                          ) : (
                            <Tag color="red">Fail</Tag>
                          );
                        },
                      },
                      {
                        title: '',
                        key: 'drill',
                        align: 'right',
                        render: (_: unknown, r: any) => (
                          <Button
                            size="small"
                            type="link"
                            onClick={() => openDrillModal([r.submissionId ?? ''], `Submission: ${r.subjectDisplay}`, '1 submission')}
                          >
                            View
                          </Button>
                        ),
                      },
                    ]}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                  />
                ),
              },
              {
                key: 'subjects',
                label: 'Subjects',
                children: (
                  <Table
                    size="small"
                    dataSource={Array.from(subjectAgg.values()) as any}
                    rowKey="subjectId"
                    columns={[
                      { 
                        title: 'Subject', 
                        dataIndex: 'subjectDisplay', 
                        key: 'subjectDisplay',
                        render: (text: string, record: any) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{text}</div>
                            <Text type="secondary" style={{ fontSize: 12 }}>{(record.subjectId ?? '').slice(-6)}</Text>
                          </div>
                        ),
                      },
                      {
                        title: 'Points',
                        key: 'points',
                        align: 'right',
                        render: (_: unknown, row: any) => {
                          const pointsEarned = row.rs?.reduce((sum: number, r: NormalizedRecord) => sum + (r.pointsEarnedTotal ?? 0), 0) ?? 0;
                          const pointsPossible = row.rs?.reduce((sum: number, r: NormalizedRecord) => sum + (r.pointsPossibleTotal ?? 0), 0) ?? 0;
                          const pct = pointsPossible > 0 ? pointsEarned / pointsPossible : null;
                          return pointsPossible > 0 
                            ? <><Text strong>{Math.round(pointsEarned)} / {Math.round(pointsPossible)}</Text> <Text type="secondary">({pct1(pct)})</Text></>
                            : '—';
                        },
                      },
                      {
                        title: 'Pass',
                        key: 'pass',
                        align: 'right',
                        render: (_: unknown, row: any) => {
                          const passEarned = row.rs?.filter((r: NormalizedRecord) => (r.passPct ?? 0) >= 0.7).length ?? 0;
                          const passPossible = row.rs?.length ?? 0;
                          const pct = passPossible > 0 ? passEarned / passPossible : null;
                          return passPossible > 0 
                            ? <><Text strong>{passEarned} / {passPossible}</Text> <Text type="secondary">({pct1(pct)})</Text></>
                            : '—';
                        },
                      },
                      {
                        title: (
                          <Tooltip title="How this subject's score compares to the organization average">
                            Org Delta
                          </Tooltip>
                        ),
                        key: 'orgDelta',
                        align: 'right',
                        render: (_: unknown, row: any) => {
                          const delta = row.orgDelta;
                          if (delta == null || (row.submissions ?? 0) < 5) {
                            return <Text type="secondary">—</Text>;
                          }
                          return (
                            <Text style={{ color: delta >= 0 ? '#52c41a' : '#ff4d4f' }}>
                              {delta >= 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                            </Text>
                          );
                        },
                      },
                      {
                        title: (
                          <Tooltip title="Top performing tags for this subject (points earned × coverage)">
                            Top Tags
                          </Tooltip>
                        ),
                        key: 'topTags',
                        width: 280,
                        render: (_: unknown, row: any) => {
                          const topTags = row.topTags ?? [];
                          if (!topTags.length) {
                            return <Text type="secondary">—</Text>;
                          }
                          return (
                            <div style={{ fontSize: 12 }}>
                              {topTags.slice(0, 3).map((tag: any) => (
                                <div key={tag.tagId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                  <Text style={{ fontWeight: 500, marginRight: 8 }}>{tag.label}</Text>
                                  <Text type="secondary">
                                    {Math.round(tag.pointsEarned)}/{tag.pointsPossible} ({pct1(tag.pointsPct)})
                                    {tag.delta != null && (
                                      <Text style={{ color: tag.delta >= 0 ? '#52c41a' : '#ff4d4f', marginLeft: 4 }}>
                                        {tag.delta >= 0 ? '+' : ''}{(tag.delta * 100).toFixed(0)}%
                                      </Text>
                                    )}
                                  </Text>
                                </div>
                              ))}
                              {topTags.length > 3 && (
                                <Text type="secondary" style={{ fontSize: 11 }}>+{topTags.length - 3} more</Text>
                              )}
                            </div>
                          );
                        },
                      },
                      { 
                        title: 'Submissions', 
                        dataIndex: 'submissions', 
                        key: 'submissions',
                        align: 'right',
                      },
                      {
                        title: '',
                        key: 'drill',
                        align: 'right',
                        render: (_: unknown, row: any) => (
                          <Button
                            size="small"
                            type="link"
                            onClick={() =>
                              openDrillModal(
                                row.rs?.map((r: NormalizedRecord) => r.submissionId) ?? [],
                                `Subject: ${row.subjectDisplay}`,
                                `${row.submissions} submissions`,
                                row.subjectId
                              )
                            }
                          >
                            View
                          </Button>
                        ),
                      },
                    ]}
                    pagination={{ pageSize: 20 }}
                  />
                ),
              },
              {
                key: 'assignees',
                label: 'Assignees',
                children: (
                  <Table
                    size="small"
                    dataSource={assigneeItems as any}
                    rowKey="assigneeId"
                    columns={[
                      {
                        title: 'Assignee',
                        dataIndex: 'label',
                        key: 'label',
                        render: (text: string, record: any) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{text}</div>
                            <Text type="secondary" style={{ fontSize: 12 }}>{(record.assigneeId ?? '').slice(-6)}</Text>
                          </div>
                        ),
                      },
                      {
                        title: 'Points',
                        key: 'points',
                        align: 'right',
                        render: (_: unknown, row: any) => {
                          const pointsEarned = row.pointsEarned ?? 0;
                          const pointsPossible = row.pointsPossible ?? 0;
                          const pct = pointsPossible > 0 ? pointsEarned / pointsPossible : null;
                          return pointsPossible > 0 
                            ? <><Text strong>{Math.round(pointsEarned)} / {Math.round(pointsPossible)}</Text> <Text type="secondary">({pct1(pct)})</Text></>
                            : '—';
                        },
                      },
                      {
                        title: 'Pass',
                        key: 'pass',
                        align: 'right',
                        render: (_: unknown, row: any) => {
                          const passEarned = row.passEarned ?? 0;
                          const passPossible = row.passPossible ?? 0;
                          const pct = passPossible > 0 ? passEarned / passPossible : null;
                          return passPossible > 0 
                            ? <><Text strong>{passEarned} / {passPossible}</Text> <Text type="secondary">({pct1(pct)})</Text></>
                            : '—';
                        },
                      },
                      {
                        title: (
                          <Tooltip title="How this assignee's scoring compares to organization average">
                            Delta vs Org
                          </Tooltip>
                        ),
                        key: 'deviation',
                        align: 'right',
                        render: (_: unknown, row: any) => {
                          const delta = row.deviation;
                          if (delta == null || row.submissions < 5) {
                            return <Text type="secondary">—</Text>;
                          }
                          return (
                            <Text style={{ color: delta >= 0 ? '#52c41a' : '#ff4d4f' }}>
                              {delta >= 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                            </Text>
                          );
                        },
                      },
                      {
                        title: (
                          <Tooltip title="Scoring consistency based on variance in pass rates (requires 5+ submissions)">
                            Consistency
                          </Tooltip>
                        ),
                        key: 'consistency',
                        align: 'right',
                        render: (_: unknown, row: any) => {
                          if (row.consistency == null || row.submissions < 5) {
                            return <Text type="secondary">—</Text>;
                          }
                          const score = row.consistency;
                          let color = token.colorText;
                          if (score >= 70) color = '#52c41a';
                          else if (score >= 50) color = token.colorWarning;
                          else color = '#ff4d4f';
                          return <Text style={{ color }}>{score.toFixed(0)}%</Text>;
                        },
                      },
                      { 
                        title: 'Submissions', 
                        dataIndex: 'submissions', 
                        key: 'submissions',
                        align: 'right',
                      },
                      {
                        title: '',
                        key: 'drill',
                        align: 'right',
                        render: (_: unknown, row: any) => (
                          <Button
                            size="small"
                            type="link"
                            onClick={() =>
                              openDrillModal(row.submissionIds ?? [], `Assignee: ${row.label}`, `${row.submissions} submissions`)
                            }
                          >
                            View
                          </Button>
                        ),
                      },
                    ]}
                    pagination={{ pageSize: 20 }}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}

      <Modal
        title="Export CSV"
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        footer={null}
        width={1100}
      >
        <p>Exports use the <strong>current scope</strong> (filters, approved-only, date range, etc.).</p>
        <Space wrap style={{ marginTop: 12 }}>
          <Button onClick={() => { exportSubmissionsCSV(); setExportModalOpen(false); }}>
            Submissions (summary)
          </Button>
          <Button onClick={() => { exportAnswersCSV(); setExportModalOpen(false); }}>
            Answers (detail)
          </Button>
          <Button onClick={() => { exportSubjectsCSV(); setExportModalOpen(false); }}>
            Subjects (summary)
          </Button>
          <Button onClick={() => { exportTagsSummaryCSV(); setExportModalOpen(false); }}>
            Tags (summary)
          </Button>
          <Button onClick={() => { exportTagLeaderboardCSV(); setExportModalOpen(false); }}>
            Tag leaderboard
          </Button>
          <Button onClick={() => { exportTagBySubjectCSV(); setExportModalOpen(false); }}>
            Tag by subject
          </Button>
          <Button onClick={() => { exportQuestionsCSV(); setExportModalOpen(false); }}>
            Questions (summary)
          </Button>
        </Space>
        <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          Tip: For large exports, filter to a template and date range first.
        </Text>
      </Modal>

      <Modal
        title={drillContent?.title}
        open={drillModalOpen}
        onCancel={() => { setDrillModalOpen(false); setDrillContent(null); }}
        width={800}
        footer={null}
      >
        {drillContent && (
          <>
            <Text type="secondary">{drillContent.meta}</Text>

            {/* Tag breakdown table - shown when viewing a subject */}
            {drillContent.tagBreakdown && drillContent.tagBreakdown.length > 0 ? (
              <>
                <Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>Tag Performance</Text>
                <Table
                  size="small"
                  dataSource={drillContent.tagBreakdown as any}
                  rowKey="tagId"
                  pagination={false}
                  columns={[
                    { 
                      title: 'Tag', 
                      dataIndex: 'label', 
                      key: 'label',
                      render: (text: string, record: any) => (
                        <div>
                          <Text strong>{text}</Text>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{record.submissions} submissions</Text>
                        </div>
                      ),
                    },
                    {
                      title: 'Points',
                      key: 'points',
                      align: 'right',
                      render: (_: any, r: any) => r.pointsPossible > 0 
                        ? <>{Math.round(r.pointsEarned)}/{r.pointsPossible} <Text type="secondary">({pct1(r.pointsPct)})</Text></>
                        : '—',
                    },
                    {
                      title: 'Pass',
                      key: 'pass',
                      align: 'right',
                      render: (_: any, r: any) => r.passPossible > 0 
                        ? <>{r.passEarned}/{r.passPossible} <Text type="secondary">({pct1(r.passPct)})</Text></>
                        : '—',
                    },
                    {
                      title: (
                        <Tooltip title="Organization average for this tag in current filtered scope">
                          Org Avg
                        </Tooltip>
                      ),
                      key: 'orgAvg',
                      align: 'right',
                      render: (_: any, r: any) => r.orgPct != null 
                        ? <Text type="secondary">{pct1(r.orgPct)}</Text>
                        : '—',
                    },
                    {
                      title: (
                        <Tooltip title="Subject's tag performance minus organization average for the same tag">
                          Delta vs Org
                        </Tooltip>
                      ),
                      key: 'delta',
                      align: 'right',
                      render: (_: any, r: any) => {
                        if (r.delta == null || r.submissions < 3) {
                          return <Text type="secondary">—</Text>;
                        }
                        return (
                          <Text style={{ color: r.delta >= 0 ? '#52c41a' : '#ff4d4f' }}>
                            {r.delta >= 0 ? '+' : ''}{(r.delta * 100).toFixed(1)}%
                          </Text>
                        );
                      },
                    },
                  ]}
                />
              </>
            ) : (
              <>
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">This subject does not have tag-level data available.</Text>
                </div>
              </>
            )}

            <Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>Submissions</Text>
            <Table
              size="small"
              dataSource={drillContent.records as any}
              rowKey="submissionId"
              onRow={(r: any) => ({
                style: { cursor: 'pointer' },
                onClick: () => setSubmissionDetailRecord(r as any),
              })}
              columns={[
                { title: 'Template', dataIndex: 'templateName', ellipsis: true },
                { title: 'Subject', dataIndex: 'subjectDisplay', ellipsis: true },
                { title: 'Score', key: 'score', render: (_: any, rec: any) => pct1(rec.pointsPct) },
                { title: 'Finalized', dataIndex: 'finalizedAt', render: (v: Date | null) => (v ? fmtDateTime(v) : '—') },
                {
                  title: '',
                  key: 'open',
                  render: (_: any, rec: any) => (
                    <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); setSubmissionDetailRecord(rec as any); }}>
                      View detail
                    </Button>
                  ),
                },
              ]}
              pagination={{ pageSize: 10 }}
            />
          </>
        )}
      </Modal>

      <Modal
        title="Submission detail"
        open={!!submissionDetailRecord}
        onCancel={() => setSubmissionDetailRecord(null)}
        width={720}
        footer={<Button onClick={() => setSubmissionDetailRecord(null)}>Close</Button>}
      >
        {submissionDetailRecord && (
          <>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Text type="secondary">Template</Text>
                <div>{submissionDetailRecord.templateName}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Subject</Text>
                <div>{submissionDetailRecord.subjectDisplay}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Assignee</Text>
                <div>{submissionDetailRecord.assigneeDisplay}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Finalized</Text>
                <div>{submissionDetailRecord.finalizedAt ? fmtDateTime(submissionDetailRecord.finalizedAt) : '—'}</div>
              </Col>
              <Col span={12}>
                <Statistic title="Points" value={pct1(submissionDetailRecord.pointsPct)} />
              </Col>
              <Col span={12}>
                <Statistic title="Pass" value={pct1(submissionDetailRecord.passPct)} />
              </Col>
            </Row>
            <Text strong>Tag breakdown</Text>
            <Table
              size="small"
              dataSource={Array.from(submissionDetailRecord.tagTotals.entries()).map(([tagId, t]) => ({
                tagId,
                tagName: tagLabel(tagId),
                earned: t.earned,
                possible: t.possible,
                passEarned: t.passEarned,
                passPossible: t.passPossible,
                pointsPct: t.possible > 0 ? t.earned / t.possible : null,
                passPct: t.passPossible > 0 ? t.passEarned / t.passPossible : null,
              }))}
              rowKey="tagId"
              columns={[
                { title: 'Tag', dataIndex: 'tagName', key: 'tagName' },
                { title: 'Points', key: 'pts', render: (_: any, r: any) => `${r.earned} / ${r.possible} (${pct1(r.pointsPct)})` },
                { title: 'Pass', key: 'pass', render: (_: any, r: any) => `${r.passEarned} / ${r.passPossible} (${pct1(r.passPct)})` },
              ]}
              pagination={false}
              style={{ marginBottom: 16 }}
            />
            <Text strong>Answers</Text>
            <Table
              size="small"
              dataSource={submissionDetailRecord.answers}
              rowKey="qid"
              columns={[
                { title: 'Question', dataIndex: 'prompt', key: 'prompt', ellipsis: true, width: '35%' },
                { title: 'Type', dataIndex: 'qtype', key: 'qtype', width: 80 },
                {
                  title: 'Answer',
                  key: 'value',
                  width: '25%',
                  render: (_: any, a: any) =>
                    a.qtype === 'matrixField' ? (
                      <Text type="secondary">(Matrix)</Text>
                    ) : (
                      (a.value ?? '').toString()
                    ),
                },
                { title: 'Tags', key: 'tags', render: (_: any, a: any) => a.tags.map((tid: string) => <Tag key={tid}>{tagLabel(tid)}</Tag>), width: '20%' },
                { title: 'Points', key: 'pts', render: (_: any, a: any) => `${a.pointsEarned}/${a.pointsPossible}`, width: 70 },
                { title: 'Pass', key: 'pass', render: (_: any, a: any) => `${a.passEarned}/${a.passPossible}`, width: 60 },
              ]}
              pagination={{ pageSize: 10 }}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
