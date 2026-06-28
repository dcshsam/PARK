"use client";

// Review Rules manager for the AI Enabled Review's rule engine.
// Mirrors the SPR Rule Manager: configure built-in + custom rules and the
// default review strictness that the AI Enabled Review runs against.

import { useEffect, useState } from "react";
import {
  getDeepRules,
  saveDeepRule,
  deleteDeepRule,
  restoreDefaultDeepRules,
} from "@/lib/db";
import type { DeepRule } from "@/lib/deep-review/builtin-rules";
import type { Strictness } from "@/lib/deep-review/types";
import { getDefaultStrictness, setDefaultStrictness } from "@/lib/deep-review/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RequireAccess } from "@/components/require-access";
import { cn } from "@/lib/utils";
import { Plus, RotateCcw, Pencil, Trash2, SlidersHorizontal } from "lucide-react";

type RuleType = DeepRule["rule_type"];

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  section_required: "Section required",
  keyword_presence: "Keyword present",
  keyword_absence: "Keyword absent (disallowed)",
  min_word_count: "Minimum word count",
  custom_prompt: "Custom AI prompt",
};

const RULE_TYPE_HELP: Record<RuleType, string> = {
  section_required: "Passes when the document contains any of the listed keywords (treated as a required section).",
  keyword_presence: "Passes when the listed keywords are present (any, or all).",
  keyword_absence: "Fails when any of the listed (disallowed) keywords appear.",
  min_word_count: "Fails when the document has fewer than the minimum number of words.",
  custom_prompt: "The AI evaluates the document against a free-text instruction and replies PASS/FAIL.",
};

const STRICTNESS_OPTIONS: { value: Strictness; label: string; desc: string }[] = [
  { value: "low", label: "Low", desc: "Lenient — credit partial coverage" },
  { value: "medium", label: "Medium", desc: "Balanced, practical standard" },
  { value: "high", label: "High", desc: "Rigorous — demand explicit evidence" },
];

interface EditorState {
  id: string | null; // null = new
  name: string;
  description: string;
  rule_type: RuleType;
  severity: "error" | "warning";
  is_active: boolean;
  is_builtin: boolean;
  keywords: string; // comma-separated
  match_any: boolean;
  min_words: number;
  prompt: string;
}

function emptyEditor(): EditorState {
  return {
    id: null,
    name: "",
    description: "",
    rule_type: "keyword_presence",
    severity: "warning",
    is_active: true,
    is_builtin: false,
    keywords: "",
    match_any: true,
    min_words: 200,
    prompt: "",
  };
}

function ruleToEditor(rule: DeepRule): EditorState {
  const config = rule.config || {};
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    rule_type: rule.rule_type,
    severity: rule.severity,
    is_active: rule.is_active,
    is_builtin: rule.is_builtin,
    keywords: Array.isArray(config.keywords) ? (config.keywords as string[]).join(", ") : "",
    match_any: (config.match_any as boolean) ?? true,
    min_words: (config.min_words as number) ?? 200,
    prompt: (config.prompt as string) ?? "",
  };
}

function editorToRule(e: EditorState): DeepRule {
  const keywords = e.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  let config: Record<string, unknown> = {};
  switch (e.rule_type) {
    case "keyword_presence":
      config = { keywords, match_any: e.match_any };
      break;
    case "keyword_absence":
    case "section_required":
      config = { keywords };
      break;
    case "min_word_count":
      config = { min_words: Number(e.min_words) || 0 };
      break;
    case "custom_prompt":
      config = { prompt: e.prompt };
      break;
  }
  return {
    id: e.id ?? `custom_${crypto.randomUUID()}`,
    name: e.name.trim() || "Untitled rule",
    description: e.description.trim(),
    rule_type: e.rule_type,
    severity: e.severity,
    config,
    is_active: e.is_active,
    is_builtin: e.is_builtin,
  };
}

export default function RulesPage() {
  return (
    <RequireAccess action="manage_rules">
      <RulesManager />
    </RequireAccess>
  );
}

function RulesManager() {
  const [rules, setRules] = useState<DeepRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [strictness, setStrictness] = useState<Strictness>("medium");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const load = () => getDeepRules().then(setRules);

  useEffect(() => {
    (async () => {
      await load();
      setStrictness(getDefaultStrictness());
      setLoading(false);
    })();
  }, []);

  const changeStrictness = (value: Strictness) => {
    setStrictness(value);
    setDefaultStrictness(value);
  };

  const toggleActive = async (rule: DeepRule) => {
    await saveDeepRule({ ...rule, is_active: !rule.is_active });
    load();
  };

  const handleSave = async () => {
    if (!editor) return;
    await saveDeepRule(editorToRule(editor));
    setEditor(null);
    load();
  };

  const handleDelete = async (rule: DeepRule) => {
    await deleteDeepRule(rule.id);
    load();
  };

  const handleRestore = async () => {
    await restoreDefaultDeepRules();
    load();
  };

  const builtins = rules.filter((r) => r.is_builtin);
  const customs = rules.filter((r) => !r.is_builtin);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary sm:text-3xl">
            <SlidersHorizontal size={26} className="text-primary-600" /> Review Rules
          </h1>
          <p className="text-text-secondary">
            Configure the rules and strictness used by the AI Enabled Review&apos;s rule engine.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRestore}>
            <RotateCcw size={16} className="mr-2" /> Restore defaults
          </Button>
          <Button onClick={() => setEditor(emptyEditor())}>
            <Plus size={16} className="mr-2" /> Add custom rule
          </Button>
        </div>
      </div>

      {/* Strictness */}
      <Card>
        <CardHeader>
          <CardTitle>Review strictness</CardTitle>
          <CardDescription>
            The default grading standard new reviews start with. Higher strictness demands more
            explicit evidence and lowers scores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {STRICTNESS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => changeStrictness(opt.value)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  strictness === opt.value
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10"
                    : "border-border bg-surface hover:border-border-strong"
                )}
              >
                <p className="font-semibold capitalize text-text-primary">{opt.label}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{opt.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
      ) : (
        <>
          {/* Built-in rules */}
          <Card>
            <CardHeader>
              <CardTitle>Built-in rules</CardTitle>
              <CardDescription>
                Factory rules ({builtins.length}). Toggle, edit, or delete them — use Restore defaults
                to bring them back.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {builtins.map((rule) => (
                <RuleRow key={rule.id} rule={rule} onToggle={toggleActive} onEdit={(r) => setEditor(ruleToEditor(r))} onDelete={handleDelete} />
              ))}
            </CardContent>
          </Card>

          {/* Custom rules */}
          <Card>
            <CardHeader>
              <CardTitle>Custom rules</CardTitle>
              <CardDescription>
                Rules you add ({customs.length}). Custom AI-prompt rules call the model during review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {customs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-muted/50 py-8 text-center text-sm text-text-secondary">
                  No custom rules yet. Click <span className="font-medium">Add custom rule</span> to create one.
                </div>
              ) : (
                customs.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} onToggle={toggleActive} onEdit={(r) => setEditor(ruleToEditor(r))} onDelete={handleDelete} />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Editor dialog */}
      <Dialog open={editor !== null} onClose={() => setEditor(null)} className="max-w-xl">
        {editor && (
          <div className="space-y-4">
            <div>
              <DialogTitle>{editor.id ? "Edit rule" : "Add custom rule"}</DialogTitle>
              <DialogDescription>{RULE_TYPE_HELP[editor.rule_type]}</DialogDescription>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-name">Name</Label>
              <Input id="rule-name" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="e.g. Mentions data residency" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-desc">Description</Label>
              <Input id="rule-desc" value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} placeholder="What this rule checks" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-type">Rule type</Label>
                <Select
                  id="rule-type"
                  value={editor.rule_type}
                  onChange={(e) => setEditor({ ...editor, rule_type: e.target.value as RuleType })}
                  disabled={editor.is_builtin}
                >
                  {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((t) => (
                    <option key={t} value={t}>
                      {RULE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-severity">Severity</Label>
                <Select id="rule-severity" value={editor.severity} onChange={(e) => setEditor({ ...editor, severity: e.target.value as "error" | "warning" })}>
                  <option value="error">Error (must fix)</option>
                  <option value="warning">Warning</option>
                </Select>
              </div>
            </div>

            {/* Type-specific config */}
            {(editor.rule_type === "keyword_presence" ||
              editor.rule_type === "keyword_absence" ||
              editor.rule_type === "section_required") && (
              <div className="space-y-2">
                <Label htmlFor="rule-keywords">Keywords (comma-separated)</Label>
                <Textarea
                  id="rule-keywords"
                  rows={2}
                  value={editor.keywords}
                  onChange={(e) => setEditor({ ...editor, keywords: e.target.value })}
                  placeholder="pricing, cost, investment"
                />
                {editor.rule_type === "keyword_presence" && (
                  <label className="flex items-center gap-3 pt-1">
                    <Switch checked={editor.match_any} onCheckedChange={(v) => setEditor({ ...editor, match_any: v })} />
                    <span className="text-sm text-text-secondary">
                      {editor.match_any ? "Pass if ANY keyword is present" : "Pass only if ALL keywords are present"}
                    </span>
                  </label>
                )}
              </div>
            )}

            {editor.rule_type === "min_word_count" && (
              <div className="space-y-2">
                <Label htmlFor="rule-minwords">Minimum words</Label>
                <Input
                  id="rule-minwords"
                  type="number"
                  value={editor.min_words}
                  onChange={(e) => setEditor({ ...editor, min_words: Number(e.target.value) })}
                />
              </div>
            )}

            {editor.rule_type === "custom_prompt" && (
              <div className="space-y-2">
                <Label htmlFor="rule-prompt">AI instruction</Label>
                <Textarea
                  id="rule-prompt"
                  rows={3}
                  value={editor.prompt}
                  onChange={(e) => setEditor({ ...editor, prompt: e.target.value })}
                  placeholder="e.g. The proposal must include a named project sponsor and an escalation path."
                />
              </div>
            )}

            <label className="flex items-center gap-3">
              <Switch checked={editor.is_active} onCheckedChange={(v) => setEditor({ ...editor, is_active: v })} />
              <span className="text-sm text-text-secondary">Active (included in reviews)</span>
            </label>

            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
              <Button variant="outline" onClick={() => setEditor(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>{editor.id ? "Save changes" : "Add rule"}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function RuleRow({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: DeepRule;
  onToggle: (rule: DeepRule) => void;
  onEdit: (rule: DeepRule) => void;
  onDelete: (rule: DeepRule) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3.5",
        !rule.is_active && "opacity-60"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary">{rule.name}</span>
          <Badge className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
            {RULE_TYPE_LABELS[rule.rule_type]}
          </Badge>
          <Badge
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase",
              rule.severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
            )}
          >
            {rule.severity}
          </Badge>
        </div>
        {rule.description && <p className="mt-0.5 truncate text-xs text-text-tertiary">{rule.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Switch checked={rule.is_active} onCheckedChange={() => onToggle(rule)} />
        <Button variant="ghost" size="sm" onClick={() => onEdit(rule)} aria-label="Edit rule">
          <Pencil size={15} />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(rule)} aria-label="Delete rule">
          <Trash2 size={15} className="text-red-500" />
        </Button>
      </div>
    </div>
  );
}
