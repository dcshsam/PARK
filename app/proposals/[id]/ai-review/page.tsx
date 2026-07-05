"use client";

// AI Enabled Review — a faithful port of the SAP SPR (PROJECT NEXT) "AI Proposal
// Review" deep-review screen. Runs the ported deep-review engine against the
// proposal's final document and renders the Overview / Checklist / Errors /
// Warnings / Improvements / Rule Checks / Requirement Coverage / Numerical tabs.

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProposal, getDeepReview, saveDeepReview, getActiveDeepRules } from "@/lib/db";
import { extractFinalProposalAndContext } from "@/lib/deep-review/extract";
import { runDeepReview } from "@/lib/deep-review/engine";
import { getDefaultStrictness } from "@/lib/deep-review/settings";
import { useProfile } from "@/components/profile-provider";
import type {
  DeepReview,
  ErrorItem,
  ImprovementItem,
  ReviewSection,
  RuleResult,
  Strictness,
} from "@/lib/deep-review/types";
import type { Proposal } from "@/lib/types";
import { useProposalBackTarget } from "@/lib/use-proposal-back-target";

type ResultTab =
  | "overview"
  | "checklist"
  | "errors"
  | "warnings"
  | "improvements"
  | "rules"
  | "coverage"
  | "numerical";

const VERDICT_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Excellent: { bg: "bg-green-50", text: "text-green-700", border: "border-green-300" },
  Good: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  "Needs Improvement": { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-300" },
  Poor: { bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
  Critical: { bg: "bg-red-100", text: "text-red-900", border: "border-red-500" },
};
const scoreColor = (s: number) => (s >= 80 ? "text-green-600" : s >= 60 ? "text-yellow-600" : "text-red-500");
const scoreBg = (s: number) => (s >= 80 ? "bg-green-500" : s >= 60 ? "bg-yellow-500" : "bg-red-500");

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";
  return (
    <svg width="140" height="140" className="rotate-[-90deg]">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text
        x="70"
        y="70"
        textAnchor="middle"
        dominantBaseline="central"
        transform="rotate(90,70,70)"
        style={{ fill: color, fontSize: 28, fontWeight: 700, fontFamily: "inherit" }}
      >
        {score}
      </text>
      <text
        x="70"
        y="90"
        textAnchor="middle"
        dominantBaseline="central"
        transform="rotate(90,70,70)"
        style={{ fill: "#9ca3af", fontSize: 11, fontFamily: "inherit" }}
      >
        /100
      </text>
    </svg>
  );
}

function SectionCard({ section, defaultOpen }: { section: ReviewSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const passed = section.checklist.filter((c) => c.passed).length;
  const total = section.checklist.length;
  return (
    <div className={`border rounded-xl overflow-hidden ${section.found ? "border-gray-200" : "border-red-200 bg-red-50/30"}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-lg shrink-0 ${section.found ? "" : "grayscale opacity-60"}`}>
            {!section.found ? "⛔" : passed === total ? "✅" : passed >= total / 2 ? "⚠️" : "❌"}
          </span>
          <div className="min-w-0">
            <span className="font-semibold text-gray-900 text-sm">{section.name}</span>
            {!section.found && (
              <span className="ml-2 text-xs text-red-600 font-medium">Section not found in document</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="text-right hidden sm:block">
            <div className={`text-lg font-bold tabular-nums ${scoreColor(section.score)}`}>
              {section.score}
              <span className="text-xs text-gray-400">/100</span>
            </div>
            <div className="text-xs text-gray-400">
              {passed}/{total} criteria
            </div>
          </div>
          <div className="w-20 hidden sm:block">
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${scoreBg(section.score)}`} style={{ width: `${section.score}%` }} />
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <div className="space-y-1.5">
            {section.checklist.map((item, i) => (
              <div key={i} className={`flex gap-2.5 p-2.5 rounded-lg text-sm ${item.passed ? "bg-green-50" : "bg-red-50"}`}>
                <span className="shrink-0 mt-0.5">{item.passed ? "✓" : "✗"}</span>
                <div className="flex-1 min-w-0">
                  <span className={`font-medium ${item.passed ? "text-green-800" : "text-red-800"}`}>{item.criterion}</span>
                  {item.note && <p className="text-xs mt-0.5 text-gray-500 italic">&quot;{item.note}&quot;</p>}
                </div>
              </div>
            ))}
          </div>

          {section.errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1.5 uppercase tracking-wide">Issues Found</p>
              <ul className="space-y-1">
                {section.errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-700 flex gap-1.5">
                    <span>•</span>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section.improvements.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Suggested Improvements</p>
              <ul className="space-y-1">
                {section.improvements.map((imp, i) => (
                  <li key={i} className="text-sm text-blue-700 flex gap-1.5">
                    <span>→</span>
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RuleRow({ rule }: { rule: RuleResult }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`${rule.passed ? "" : rule.severity === "error" ? "bg-red-50/30" : "bg-yellow-50/30"}`}>
      <div className="flex items-start gap-3 p-3.5">
        <span
          className={`shrink-0 font-bold text-sm mt-0.5 ${
            rule.passed ? "text-green-500" : rule.severity === "error" ? "text-red-500" : "text-yellow-600"
          }`}
        >
          {rule.passed ? "✓" : rule.severity === "error" ? "✗" : "⚠"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{rule.rule_name}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                rule.passed
                  ? "bg-green-100 text-green-700"
                  : rule.severity === "error"
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {rule.passed ? "passed" : rule.severity === "error" ? "failed" : "warning"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{rule.details}</p>
          {!rule.passed && rule.suggestions.length > 0 && (
            <button onClick={() => setExpanded((e) => !e)} className="text-xs text-gray-400 hover:text-gray-600 mt-1">
              {expanded ? "▲ hide tip" : "▼ show tip"}
            </button>
          )}
          {expanded && rule.suggestions[0] && (
            <p className="text-xs text-blue-700 bg-blue-50 rounded p-2 mt-1.5">→ {rule.suggestions[0]}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const STRICTNESS_OPTIONS: { value: Strictness; label: string; desc: string }[] = [
  { value: "low", label: "Low", desc: "Lenient — credit partial coverage" },
  { value: "medium", label: "Medium", desc: "Balanced, practical standard" },
  { value: "high", label: "High", desc: "Rigorous — demand explicit evidence" },
];

export default function AiEnabledReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { can } = useProfile();
  const canRun = can("run_review");
  const backTarget = useProposalBackTarget(id);

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [review, setReview] = useState<DeepReview | null>(null);
  const [savedReview, setSavedReview] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("overview");
  const [error, setError] = useState("");
  const [strictness, setStrictness] = useState<Strictness>("medium");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const progressFloorRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [p, saved] = await Promise.all([getProposal(id), getDeepReview(id)]);
      if (cancelled) return;
      if (p) setProposal(p);
      if (saved) {
        setReview(saved);
        setSavedReview(true);
        setStrictness(saved.strictness);
        setActiveTab("overview");
      } else {
        // No saved report yet — start from the configured default strictness.
        setStrictness(getDefaultStrictness());
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleAnalyze = useCallback(async () => {
    if (!proposal) return;
    setAnalyzing(true);
    setError("");
    setProgress(0);
    setStage("Preparing document…");
    progressFloorRef.current = 0;

    const startedAt = Date.now();
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const creep = 95 * (1 - Math.exp(-elapsed / 18));
      setProgress((cur) => Math.min(99, Math.max(cur, progressFloorRef.current, creep)));
    }, 300);
    const stopTimer = () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    };

    try {
      const { finalProposalText, contextText } = extractFinalProposalAndContext(proposal);
      const proposalText =
        finalProposalText.trim() ||
        proposal.documents.map((d) => d.extractedText || "").join("\n\n").trim();

      if (!proposalText) {
        stopTimer();
        setAnalyzing(false);
        setError(
          "No readable text found. Upload a final proposal document (PDF, DOCX, or TXT) with extracted text, then run the review."
        );
        return;
      }

      const finalDoc = proposal.documents.find((d) => d.category === "final_proposal");
      const fileName = finalDoc?.name || `${proposal.title}.txt`;
      const rules = await getActiveDeepRules();

      const result = await runDeepReview({
        proposalId: proposal.id,
        fileName,
        proposalText,
        contextText,
        strictness,
        rules,
        onProgress: ({ stage: s, percent }) => {
          progressFloorRef.current = Math.max(progressFloorRef.current, percent);
          setStage(s);
        },
      });

      await saveDeepReview(result);
      stopTimer();
      setProgress(100);
      setStage("Review complete");
      setReview(result);
      setSavedReview(true);
      setActiveTab("overview");
    } catch (e) {
      stopTimer();
      setError(e instanceof Error ? e.message : "Analysis failed — please try again");
    } finally {
      setAnalyzing(false);
    }
  }, [proposal, strictness]);

  const handleRerun = () => {
    setReview(null);
    setSavedReview(false);
    setError("");
  };

  const handleDownload = async () => {
    if (!review || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const { downloadReviewPdf } = await import("@/lib/deep-review/pdf-report");
      downloadReviewPdf(review);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the PDF report");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <p className="text-text-secondary">Loading AI review workspace…</p>;
  if (!proposal) return <p className="text-text-secondary">Proposal not found.</p>;

  const errorItems = review ? review.all_errors.filter((e) => e.severity === "error") : [];
  const warningItems = review ? review.all_errors.filter((e) => e.severity === "warning") : [];
  const coverage = review?.requirement_coverage ?? null;
  const numerical = review?.numerical_check ?? null;
  const tabs: { key: ResultTab; label: string; count?: number }[] = review
    ? [
        { key: "overview", label: "Overview" },
        { key: "checklist", label: "Checklist", count: review.criteria_total },
        { key: "errors", label: "Errors", count: errorItems.length },
        { key: "warnings", label: "Warnings", count: warningItems.length },
        { key: "improvements", label: "Improvements", count: review.all_improvements.length },
        { key: "rules", label: "Rule Checks", count: review.rule_check.total_rules },
        ...(coverage ? [{ key: "coverage" as ResultTab, label: "Requirement Coverage", count: coverage.items.length }] : []),
        ...(numerical && numerical.claims_extracted > 0
          ? [{ key: "numerical" as ResultTab, label: "Numerical Check", count: numerical.discrepancies.length }]
          : []),
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50 -m-4 lg:-m-8 text-gray-900">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto py-5 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(backTarget.href)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              ← {backTarget.label}
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Enabled Review</h1>
              <p className="text-xs text-gray-400 mt-0.5">Deep checklist · Error detection · Improvement suggestions</p>
            </div>
          </div>
          {review && (
            <div className="flex items-center gap-2">
              {canRun && (
                <button
                  onClick={handleRerun}
                  className="px-4 py-2 bg-white border border-violet-300 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-50 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                  Re-run Review
                </button>
              )}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:bg-violet-300 flex items-center gap-1.5"
              >
                {downloading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating PDF…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                    Download PDF Report
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project banner */}
      <div className="bg-violet-50 border-b border-violet-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3 text-sm flex-wrap">
          <span className="font-semibold text-violet-800">{proposal.title}</span>
          {proposal.projectType && (
            <>
              <span className="text-violet-400">·</span>
              <span className="text-violet-600">{proposal.projectType}</span>
            </>
          )}
          {proposal.technology && (
            <>
              <span className="text-violet-400">·</span>
              <span className="text-violet-600">{proposal.technology}</span>
            </>
          )}
          <span className="text-violet-400">·</span>
          <span className="text-violet-600">{proposal.clientName}</span>
        </div>
      </div>

      {/* Tab bar */}
      {review && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3.5 px-4 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.key
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      activeTab === tab.key ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {savedReview && review && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-700">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>
              Viewing the saved AI Enabled Review for <strong>{review.file_name}</strong>
              {review.analyzed_at && <> · analyzed {new Date(review.analyzed_at).toLocaleString()}</>}
            </span>
          </div>
        )}

        {/* ── Run panel (no review yet) ── */}
        {!review && (
          <div className="bg-white rounded-2xl shadow-sm p-8 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-1 text-gray-900">Run AI Enabled Review</h2>
            <p className="text-sm text-gray-500 mb-6">
              AI runs a multi-criteria deep review across 7 sections, validates every numerical claim, checks all
              built-in rules, and (when supporting documents are present) grades the proposal against the customer&apos;s
              requirements.
            </p>

            {/* Document used */}
            <div className="mb-5 p-3.5 bg-violet-50 border border-violet-200 rounded-lg">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Document under review</p>
              {(() => {
                const finalDoc = proposal.documents.find((d) => d.category === "final_proposal");
                if (finalDoc) {
                  return <p className="text-sm text-gray-800">{finalDoc.name}</p>;
                }
                if (proposal.documents.length > 0) {
                  return (
                    <p className="text-sm text-gray-800">
                      No &quot;Customer Final Proposal&quot; uploaded — using {proposal.documents.length} attached
                      document(s).
                    </p>
                  );
                }
                return <p className="text-sm text-red-600">No documents uploaded. Add a document first.</p>;
              })()}
            </div>

            {/* What will be checked */}
            <div className="grid grid-cols-2 gap-2">
              {[
                "Executive Summary",
                "Scope & Deliverables",
                "Technical Approach",
                "Timeline & Milestones",
                "Team & Expertise",
                "Pricing & Commercial",
                "Presentation Quality",
              ].map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                  {s}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">+ criteria per section, all built-in rules & numerical audit</p>

            {/* Strictness selector */}
            <div className="mt-5">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Review strictness</p>
              <div className="grid grid-cols-3 gap-2">
                {STRICTNESS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStrictness(opt.value)}
                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                      strictness === opt.value
                        ? opt.value === "low"
                          ? "bg-green-50 border-green-300 text-green-700"
                          : opt.value === "high"
                            ? "bg-red-50 border-red-300 text-red-700"
                            : "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-semibold capitalize">{opt.label}</span>
                    <span className="block text-xs opacity-80 mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {analyzing && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="truncate">{stage}</span>
                  <span className="tabular-nums font-semibold">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {!canRun && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                Your current profile is read-only. Switch to a Reviewer, SPARC Owner, or Admin profile to run reviews.
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={analyzing || proposal.documents.length === 0 || !canRun}
              className="w-full mt-6 py-3.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 disabled:bg-gray-300 transition flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running deep review — this may take 30–90 seconds…
                </>
              ) : (
                "Run Deep AI Review"
              )}
            </button>
          </div>
        )}

        {/* ── OVERVIEW tab ── */}
        {review && activeTab === "overview" && (
          <div className="space-y-6">
            {review.verdict === "Critical" && (
              <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center text-2xl font-bold">
                    !
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-red-900 leading-tight">
                      DO NOT SEND this proposal to the customer
                    </p>
                    <p className="text-sm text-red-800 mt-1.5 leading-relaxed">
                      The numerical check found{" "}
                      <strong>
                        {numerical?.discrepancies.length ?? 0} arithmetic
                        error{(numerical?.discrepancies.length ?? 0) === 1 ? "" : "s"}
                      </strong>
                      . Mismatched totals, line items that do not add up, or incorrect cost calculations will damage
                      credibility. Fix the calculations and re-run the review before sending.
                    </p>
                    {numerical && numerical.discrepancies.length > 0 && (
                      <button
                        onClick={() => setActiveTab("numerical")}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-900 bg-white border border-red-300 rounded-md px-3 py-1.5 hover:bg-red-100 transition"
                      >
                        View {numerical.discrepancies.length} discrepanc
                        {numerical.discrepancies.length === 1 ? "y" : "ies"} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Score + verdict */}
            <div
              className={`rounded-2xl border p-6 ${(VERDICT_STYLE[review.verdict] || VERDICT_STYLE.Poor).border} ${
                (VERDICT_STYLE[review.verdict] || VERDICT_STYLE.Poor).bg
              }`}
            >
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ScoreRing score={review.overall_score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-2xl font-bold ${(VERDICT_STYLE[review.verdict] || VERDICT_STYLE.Poor).text}`}>
                      {review.verdict}
                    </span>
                    {review.ai_powered ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                        AI Powered
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                        Heuristic
                      </span>
                    )}
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize border ${
                        review.strictness === "low"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : review.strictness === "high"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {review.strictness} strictness
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">{review.summary}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Criteria Passed", value: `${review.criteria_passed}/${review.criteria_total}`, color: "text-green-600" },
                      { label: "Criteria Failed", value: `${review.criteria_failed}`, color: "text-red-500" },
                      {
                        label: "Critical Issues",
                        value: review.critical_issues.length,
                        color: review.critical_issues.length > 0 ? "text-red-600" : "text-green-600",
                      },
                      { label: "Word Count", value: review.word_count.toLocaleString(), color: "text-gray-700" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white/70 rounded-xl p-3 text-center">
                        <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Critical Issues */}
            {review.critical_issues.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                <div className="bg-red-50 px-5 py-3 border-b border-red-100 flex items-center gap-2">
                  <span className="text-red-600 font-bold text-sm">⛔ Critical Issues ({review.critical_issues.length})</span>
                  <span className="text-xs text-red-500">— must address before submission</span>
                </div>
                <div className="divide-y divide-red-50">
                  {review.critical_issues.map((ci, i) => (
                    <div key={i} className="p-5">
                      <p className="font-semibold text-red-800 text-sm mb-2">{ci.issue}</p>
                      <div className="grid sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-red-50 rounded-lg p-2.5">
                          <span className="font-medium text-red-700">Impact: </span>
                          <span className="text-red-600">{ci.impact}</span>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2.5">
                          <span className="font-medium text-green-700">Fix: </span>
                          <span className="text-green-600">{ci.fix}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requirement Coverage summary */}
            {coverage && (
              <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
                <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-indigo-800">🎯 Customer Requirement Coverage</span>
                    <span className="text-xs text-indigo-600">— graded against requirements from RFP / transcripts</span>
                  </div>
                  <button
                    onClick={() => setActiveTab("coverage")}
                    className="text-xs font-medium text-indigo-700 hover:text-indigo-900 underline"
                  >
                    View all {coverage.items.length} →
                  </button>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${scoreColor(coverage.coverage_score)}`}>{coverage.coverage_score}</div>
                    <div className="text-xs text-gray-500 mt-0.5">coverage score</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2.5 text-center">
                    <div className="text-xl font-bold text-green-700">{coverage.addressed_count}</div>
                    <div className="text-xs text-green-600">addressed</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-2.5 text-center">
                    <div className="text-xl font-bold text-yellow-700">{coverage.partial_count}</div>
                    <div className="text-xs text-yellow-600">partial</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2.5 text-center">
                    <div className="text-xl font-bold text-red-700">{coverage.missing_count}</div>
                    <div className="text-xs text-red-600">missing</div>
                  </div>
                </div>
              </div>
            )}

            {/* Numerical Check summary */}
            {numerical && numerical.claims_extracted > 0 && (
              <div
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                  numerical.discrepancies.length > 0 ? "border-red-100" : "border-emerald-100"
                }`}
              >
                <div
                  className={`px-5 py-3 border-b flex items-center justify-between ${
                    numerical.discrepancies.length > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"
                  }`}
                >
                  <span
                    className={`text-sm font-semibold ${
                      numerical.discrepancies.length > 0 ? "text-red-800" : "text-emerald-800"
                    }`}
                  >
                    🧮 Numerical Check —{" "}
                    {numerical.discrepancies.length === 0
                      ? "all calculations reconcile"
                      : `${numerical.discrepancies.length} discrepanc${numerical.discrepancies.length === 1 ? "y" : "ies"} found`}
                  </span>
                  {numerical.discrepancies.length > 0 && (
                    <button
                      onClick={() => setActiveTab("numerical")}
                      className="text-xs font-medium text-red-700 hover:text-red-900 underline"
                    >
                      View details →
                    </button>
                  )}
                </div>
                <div className="p-5 grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">{numerical.claims_extracted}</div>
                    <div className="text-xs text-gray-500 mt-0.5">claims extracted</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                    <div className="text-xl font-bold text-emerald-700">{numerical.ok}</div>
                    <div className="text-xs text-emerald-600">verified ok</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2.5 text-center">
                    <div className="text-xl font-bold text-red-700">{numerical.discrepancies.length}</div>
                    <div className="text-xs text-red-600">mismatched</div>
                  </div>
                </div>
              </div>
            )}

            {/* Strengths */}
            {review.strengths.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5">
                <p className="font-semibold text-green-800 text-sm mb-3">✅ Strengths</p>
                <div className="flex flex-wrap gap-2">
                  {review.strengths.map((s, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Section score grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="font-semibold text-gray-800 text-sm mb-4">Section Scores</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {review.sections.map((sec) => (
                  <div key={sec.name} className="flex items-center gap-3">
                    <span className={`text-sm shrink-0 ${!sec.found ? "opacity-40" : ""}`}>
                      {!sec.found ? "⛔" : sec.score >= 80 ? "✅" : sec.score >= 60 ? "⚠️" : "❌"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate">{sec.name}</span>
                        <span className={`font-bold ml-2 ${scoreColor(sec.score)}`}>{sec.score}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${scoreBg(sec.score)}`} style={{ width: `${sec.score}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CHECKLIST tab ── */}
        {review && activeTab === "checklist" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">
                {review.criteria_passed}/{review.criteria_total} criteria passed
              </p>
            </div>
            {review.sections.map((sec, i) => (
              <SectionCard key={sec.name} section={sec} defaultOpen={i === 0} />
            ))}
          </div>
        )}

        {/* ── ERRORS tab ── */}
        {review && activeTab === "errors" && (
          <div className="space-y-4">
            {errorItems.length === 0 && review.critical_issues.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <p className="text-4xl mb-3">🎉</p>
                <p className="font-semibold text-gray-800">No errors detected</p>
                <p className="text-sm text-gray-400 mt-1">No blocking issues found in the proposal</p>
              </div>
            ) : (
              <>
                {Object.entries(
                  errorItems.reduce<Record<string, ErrorItem[]>>((acc, e) => {
                    acc[e.section] = [...(acc[e.section] || []), e];
                    return acc;
                  }, {})
                ).map(([section, errors]) => (
                  <div key={section} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{section}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {errors.map((e, i) => (
                        <div key={i} className="flex gap-3 p-4 bg-red-50/40">
                          <span className="shrink-0 font-bold text-sm text-red-500">✗</span>
                          <div>
                            <p className="text-sm text-gray-800">{e.error}</p>
                            <span className="text-xs mt-0.5 text-red-400">error</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {review.critical_issues.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-red-50 border-b border-red-100">
                      <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Critical Issues</span>
                    </div>
                    <div className="divide-y divide-red-50">
                      {review.critical_issues.map((ci, i) => (
                        <div key={i} className="p-4 space-y-2">
                          <p className="font-semibold text-red-800 text-sm">⛔ {ci.issue}</p>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Impact:</span> {ci.impact}
                          </p>
                          <p className="text-xs text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg inline-block">
                            <span className="font-medium">Fix:</span> {ci.fix}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── WARNINGS tab ── */}
        {review && activeTab === "warnings" && (
          <div className="space-y-4">
            {warningItems.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <p className="text-4xl mb-3">👌</p>
                <p className="font-semibold text-gray-800">No warnings</p>
                <p className="text-sm text-gray-400 mt-1">All sections passed without minor concerns</p>
              </div>
            ) : (
              Object.entries(
                warningItems.reduce<Record<string, ErrorItem[]>>((acc, e) => {
                  acc[e.section] = [...(acc[e.section] || []), e];
                  return acc;
                }, {})
              ).map(([section, warnings]) => (
                <div key={section} className="bg-white rounded-xl shadow-sm border border-yellow-100 overflow-hidden">
                  <div className="px-4 py-2.5 bg-yellow-50 border-b border-yellow-100">
                    <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">{section}</span>
                  </div>
                  <div className="divide-y divide-yellow-50">
                    {warnings.map((w, i) => (
                      <div key={i} className="flex gap-3 p-4 bg-yellow-50/40">
                        <span className="shrink-0 font-bold text-sm text-yellow-600">⚠</span>
                        <div>
                          <p className="text-sm text-gray-800">{w.error}</p>
                          <span className="text-xs mt-0.5 text-yellow-500">warning</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── IMPROVEMENTS tab ── */}
        {review && activeTab === "improvements" && (
          <div className="space-y-4">
            {review.all_improvements.filter((i) => i.priority === "quick_win").length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden">
                <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-800">⚡ Quick Wins</span>
                  <span className="text-xs text-green-600">— low effort, high impact</span>
                </div>
                <div className="divide-y divide-green-50">
                  {review.all_improvements
                    .filter((i) => i.priority === "quick_win")
                    .map((imp, idx) => (
                      <div key={idx} className="p-4 flex gap-3">
                        <span className="text-green-500 shrink-0 mt-0.5">→</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{imp.action}</p>
                          {imp.benefit && <p className="text-xs text-green-600 mt-0.5">{imp.benefit}</p>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {Object.entries(
              review.all_improvements
                .filter((i) => i.priority !== "quick_win")
                .reduce<Record<string, ImprovementItem[]>>((acc, i) => {
                  acc[i.section] = [...(acc[i.section] || []), i];
                  return acc;
                }, {})
            ).map(([section, items]) => (
              <div key={section} className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{section}</span>
                </div>
                <div className="divide-y divide-blue-50">
                  {items.map((imp, i) => (
                    <div key={i} className="p-3.5 flex gap-2.5">
                      <span className="text-blue-400 shrink-0">→</span>
                      <p className="text-sm text-gray-800">{imp.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── RULES tab ── */}
        {review && activeTab === "rules" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{review.rule_check.passed_rules}</div>
                  <div className="text-xs text-gray-400">passed</div>
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{ width: `${(review.rule_check.passed_rules / Math.max(review.rule_check.total_rules, 1)) * 100}%` }}
                  />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{review.rule_check.failed_rules}</div>
                  <div className="text-xs text-gray-400">failed</div>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-gray-500">
                <span>{review.rule_check.builtin_rules_count} built-in rules</span>
                <span>·</span>
                <span>{review.rule_check.custom_rules_count} custom rules</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Built-in Rules</span>
              </div>
              <div className="divide-y divide-gray-50">
                {review.rule_check.results
                  .filter((r) => r.is_builtin)
                  .map((r, i) => (
                    <RuleRow key={`rule-${r.rule_id}-builtin-${i}`} rule={r} />
                  ))}
              </div>
            </div>

            {review.rule_check.custom_rules_count > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-violet-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-100">
                  <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Custom Rules</span>
                </div>
                <div className="divide-y divide-violet-50">
                  {review.rule_check.results
                    .filter((r) => !r.is_builtin)
                    .map((r, i) => (
                      <RuleRow key={`rule-${r.rule_id}-custom-${i}`} rule={r} />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── COVERAGE tab ── */}
        {review && activeTab === "coverage" && coverage && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${scoreColor(coverage.coverage_score)}`}>
                    {coverage.coverage_score}
                    <span className="text-base text-gray-400">/100</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">coverage</div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-700">{coverage.addressed_count}</div>
                    <div className="text-xs text-green-600">addressed</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-yellow-700">{coverage.partial_count}</div>
                    <div className="text-xs text-yellow-600">partial</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-red-700">{coverage.missing_count}</div>
                    <div className="text-xs text-red-600">missing</div>
                  </div>
                </div>
              </div>
              {coverage.summary && <p className="text-sm text-gray-700 leading-relaxed">{coverage.summary}</p>}
            </div>

            {coverage.missing_topics.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                  <span className="text-sm font-semibold text-red-800">🚨 Customer topics the proposal never mentions</span>
                </div>
                <ul className="divide-y divide-red-50">
                  {coverage.missing_topics.map((t, i) => (
                    <li key={i} className="px-5 py-2.5 text-sm text-gray-800">
                      • {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Customer Requirements vs. Proposal</span>
              </div>
              <div className="divide-y divide-gray-100">
                {coverage.items.map((item, i) => {
                  const isAddressed = item.status === "addressed";
                  const isPartial = item.status === "partial";
                  const isMissing = item.status === "missing";
                  return (
                    <div key={`req-${item.requirement_id || i}-${i}`} className={`p-4 ${isMissing ? "bg-red-50/30" : isPartial ? "bg-yellow-50/30" : ""}`}>
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 mt-0.5 text-lg">{isAddressed ? "✅" : isPartial ? "⚠️" : "❌"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.requirement_id && <span className="text-xs font-mono text-gray-400">{item.requirement_id}</span>}
                            <span className="text-sm font-medium text-gray-900">{item.requirement_title}</span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${
                                isAddressed ? "bg-green-100 text-green-700" : isPartial ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                          {item.evidence && (
                            <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 px-2.5 py-1.5 rounded">
                              <span className="font-medium">Evidence:</span> {item.evidence}
                            </p>
                          )}
                          {item.gap && (
                            <p className="text-xs text-red-700 mt-1.5">
                              <span className="font-medium">Gap:</span> {item.gap}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {coverage.items.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">No requirements found to evaluate.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── NUMERICAL CHECK tab ── */}
        {review && activeTab === "numerical" && numerical && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-800">{numerical.claims_extracted}</div>
                  <div className="text-xs text-gray-500 mt-0.5">claims extracted</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{numerical.ok}</div>
                  <div className="text-xs text-emerald-600">verified ok</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">{numerical.discrepancies.length}</div>
                  <div className="text-xs text-red-600">mismatched</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                The AI extracts every line-item sum, multiplication (days × rate), and percentage breakdown it can find,
                then each is verified by exact arithmetic. Discrepancies below indicate the proposal&apos;s stated total
                does not match the components.
              </p>
            </div>

            {numerical.discrepancies.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-10 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-semibold text-emerald-800">All numerical claims reconcile</p>
                <p className="text-sm text-gray-500 mt-1">
                  {numerical.checked} arithmetic claim{numerical.checked !== 1 ? "s" : ""} checked, no inconsistencies found.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                  <span className="text-sm font-semibold text-red-800">Discrepancies</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {numerical.discrepancies.map((d, i) => (
                    <div key={i} className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 text-lg">⚠️</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-gray-900">{d.label || d.kind}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700 capitalize">
                              {d.kind.replace("_", " ")}
                            </span>
                            {d.context && <span className="text-xs text-gray-400">· {d.context}</span>}
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{d.message}</p>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <div className="bg-emerald-50 rounded p-2 text-center">
                              <div className="text-xs text-emerald-600">expected</div>
                              <div className="text-sm font-bold text-emerald-700">
                                {d.expected.toLocaleString()}
                                {d.unit ? ` ${d.unit}` : ""}
                              </div>
                            </div>
                            <div className="bg-red-50 rounded p-2 text-center">
                              <div className="text-xs text-red-600">stated</div>
                              <div className="text-sm font-bold text-red-700">
                                {d.stated.toLocaleString()}
                                {d.unit ? ` ${d.unit}` : ""}
                              </div>
                            </div>
                            <div className="bg-gray-100 rounded p-2 text-center">
                              <div className="text-xs text-gray-500">diff</div>
                              <div className={`text-sm font-bold ${d.diff > 0 ? "text-orange-600" : "text-blue-600"}`}>
                                {d.diff > 0 ? "+" : ""}
                                {d.diff.toLocaleString()}
                                {d.unit ? ` ${d.unit}` : ""}
                              </div>
                            </div>
                          </div>
                          {d.components.length > 0 && (
                            <details className="mt-1">
                              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                Show component breakdown ({d.components.length})
                              </summary>
                              <div className="mt-2 bg-gray-50 rounded p-2.5 text-xs font-mono">
                                {d.components.map((c, j) => (
                                  <div key={j} className="flex justify-between py-0.5">
                                    <span className="text-gray-600">{c.name || `item ${j + 1}`}</span>
                                    <span className="text-gray-900">{String(c.value)}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
