"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ruleset, ValidationType } from "@/lib/types";
import { validationTypeLabels } from "@/lib/types";
import {
  getRulesets,
  addRuleset,
  updateRuleset,
  deleteRuleset,
  setDefaultRuleset,
} from "@/lib/db";
import {
  createEmptyRuleset,
  createEmptySection,
  createEmptySubsection,
  createEmptyCriterion,
  cloneRuleset,
  validateRuleset,
  normalizeWeights,
} from "@/lib/ruleset-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Copy,
  Star,
  ChevronDown,
  ChevronRight,
  Save,
  X,
  AlertCircle,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function RulesetManager() {
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Ruleset | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedSubsections, setExpandedSubsections] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const hasAutoSelectedRef = useRef(false);

  const selectRuleset = (ruleset: Ruleset) => {
    setSelectedId(ruleset.id);
    setDraft(JSON.parse(JSON.stringify(ruleset)) as Ruleset);
    setErrors([]);
    setExpandedSections(new Set(ruleset.sections.map((s) => s.id)));
    setExpandedSubsections(
      new Set(ruleset.sections.flatMap((s) => s.subsections.map((ss) => ss.id)))
    );
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await getRulesets();
      if (cancelled) return;
      setRulesets(data);
      setLoading(false);
      if (data.length > 0 && !hasAutoSelectedRef.current) {
        hasAutoSelectedRef.current = true;
        selectRuleset(data[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadRulesets = async () => {
    setLoading(true);
    const data = await getRulesets();
    setRulesets(data);
    setLoading(false);
    return data;
  };

  const createNew = () => {
    const empty = { ...createEmptyRuleset(), id: "new", createdAt: new Date(), updatedAt: new Date() } as Ruleset;
    setSelectedId("new");
    setDraft(empty);
    setErrors([]);
    setExpandedSections(new Set());
    setExpandedSubsections(new Set());
  };

  const cloneSelected = async () => {
    if (!draft || selectedId === "new") return;
    const cloned = cloneRuleset(draft);
    const saved = await addRuleset(cloned);
    await reloadRulesets();
    selectRuleset(saved);
  };

  const handleSave = async () => {
    if (!draft) return;
    const validationErrors = validateRuleset(draft);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      if (selectedId === "new") {
        const saved = await addRuleset({
          name: draft.name,
          description: draft.description,
          isDefault: draft.isDefault,
          isSystem: false,
          sections: draft.sections,
        });
        await reloadRulesets();
        selectRuleset(saved);
      } else {
        const saved = await updateRuleset(draft.id, {
          name: draft.name,
          description: draft.description,
          sections: draft.sections,
        });
        if (saved) {
          await reloadRulesets();
          selectRuleset(saved);
        }
      }
      setErrors([]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this ruleset?")) return;
    try {
      await deleteRuleset(id);
      await reloadRulesets();
      if (selectedId === id) {
        setSelectedId(null);
        setDraft(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete ruleset");
    }
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultRuleset(id);
    await reloadRulesets();
  };

  const updateDraft = (changes: Partial<Ruleset>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : null));
  };

  const updateSection = (sectionId: string, changes: Partial<Ruleset["sections"][number]>) => {
    setDraft((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, ...changes } : s)),
      };
    });
  };

  const updateSubsection = (
    sectionId: string,
    subsectionId: string,
    changes: Partial<Ruleset["sections"][number]["subsections"][number]>
  ) => {
    setDraft((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                subsections: s.subsections.map((ss) =>
                  ss.id === subsectionId ? { ...ss, ...changes } : ss
                ),
              }
            : s
        ),
      };
    });
  };

  const updateCriterion = (
    sectionId: string,
    subsectionId: string,
    criterionId: string,
    changes: Partial<Ruleset["sections"][number]["subsections"][number]["criteria"][number]>
  ) => {
    setDraft((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                subsections: s.subsections.map((ss) =>
                  ss.id === subsectionId
                    ? {
                        ...ss,
                        criteria: ss.criteria.map((c) =>
                          c.id === criterionId ? { ...c, ...changes } : c
                        ),
                      }
                    : ss
                ),
              }
            : s
        ),
      };
    });
  };

  const addSection = () => {
    setDraft((prev) => {
      if (!prev) return null;
      const section = createEmptySection();
      setExpandedSections((set) => new Set(set).add(section.id));
      return { ...prev, sections: [...prev.sections, section] };
    });
  };

  const removeSection = (sectionId: string) => {
    setDraft((prev) => {
      if (!prev) return null;
      return { ...prev, sections: prev.sections.filter((s) => s.id !== sectionId) };
    });
  };

  const addSubsection = (sectionId: string) => {
    setDraft((prev) => {
      if (!prev) return null;
      const subsection = createEmptySubsection();
      setExpandedSubsections((set) => new Set(set).add(subsection.id));
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, subsections: [...s.subsections, subsection] } : s
        ),
      };
    });
  };

  const removeSubsection = (sectionId: string, subsectionId: string) => {
    setDraft((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? { ...s, subsections: s.subsections.filter((ss) => ss.id !== subsectionId) }
            : s
        ),
      };
    });
  };

  const addCriterion = (sectionId: string, subsectionId: string) => {
    setDraft((prev) => {
      if (!prev) return null;
      const criterion = createEmptyCriterion();
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                subsections: s.subsections.map((ss) =>
                  ss.id === subsectionId
                    ? { ...ss, criteria: [...ss.criteria, criterion] }
                    : ss
                ),
              }
            : s
        ),
      };
    });
  };

  const removeCriterion = (sectionId: string, subsectionId: string, criterionId: string) => {
    setDraft((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                subsections: s.subsections.map((ss) =>
                  ss.id === subsectionId
                    ? { ...ss, criteria: ss.criteria.filter((c) => c.id !== criterionId) }
                    : ss
                ),
              }
            : s
        ),
      };
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubsection = (id: string) => {
    setExpandedSubsections((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const normalizeAllWeights = () => {
    setDraft((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          ...normalizeWeights([section])[0],
          subsections: section.subsections.map((subsection) => ({
            ...subsection,
            ...normalizeWeights([subsection])[0],
            criteria: normalizeWeights(subsection.criteria),
          })),
        })),
      };
    });
  };

  const totalWeight = useMemo(() => {
    if (!draft) return 0;
    return draft.sections.reduce((sum, s) => sum + s.weight, 0);
  }, [draft]);

  if (loading) return <p className="text-text-secondary">Loading rulesets...</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers size={20} className="text-primary-600" /> Rulesets
          </CardTitle>
          <CardDescription>Select or create a ruleset to edit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={createNew} variant="outline" className="w-full">
            <Plus size={16} className="mr-2" /> New Ruleset
          </Button>
          <div className="space-y-2">
            {rulesets.map((ruleset) => (
              <div
                key={ruleset.id}
                onClick={() => selectRuleset(ruleset)}
                className={cn(
                  "cursor-pointer rounded-lg border p-3 transition-colors",
                  selectedId === ruleset.id
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10"
                    : "border-border bg-surface hover:bg-surface-muted"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{ruleset.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {ruleset.sections.length} sections ·{" "}
                      {ruleset.sections.reduce((acc, s) => acc + s.subsections.length, 0)} subsections
                    </p>
                  </div>
                  {ruleset.isDefault && <Star size={14} className="shrink-0 text-amber-500" />}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {!ruleset.isSystem && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ruleset.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                  {!ruleset.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(ruleset.id);
                      }}
                    >
                      <Star size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ruleset Editor</CardTitle>
            {draft && (
              <div className="flex items-center gap-2">
                {selectedId !== "new" && (
                  <Button variant="outline" size="sm" onClick={cloneSelected}>
                    <Copy size={16} className="mr-1" /> Clone
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save size={16} className="mr-1" /> {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
          <CardDescription>
            Define sections, subsections, and criteria used by AI review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!draft ? (
            <p className="text-text-secondary">Select a ruleset to edit.</p>
          ) : (
            <>
              {errors.length > 0 && (
                <div className="rounded-xl bg-status-danger-bg p-3 text-sm text-status-danger-text">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle size={16} /> Validation errors
                  </div>
                  <ul className="mt-1 list-inside list-disc">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label>Ruleset Name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                    placeholder="e.g., SAP Proposal Review"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={draft.description || ""}
                    onChange={(e) => updateDraft({ description: e.target.value })}
                    placeholder="What this ruleset evaluates"
                    rows={2}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 p-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Default Ruleset</p>
                    <p className="text-xs text-text-tertiary">
                      Used automatically for new proposals.
                    </p>
                  </div>
                  <Switch
                    checked={draft.isDefault}
                    onCheckedChange={(checked) => {
                      updateDraft({ isDefault: checked });
                      if (checked && selectedId !== "new") {
                        handleSetDefault(selectedId!);
                      }
                    }}

                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">Sections</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">Total weight: {totalWeight.toFixed(2)}</span>
                  <Button variant="outline" size="sm" onClick={normalizeAllWeights}>
                    Normalize Weights
                  </Button>
                  <Button size="sm" onClick={addSection}>
                    <Plus size={16} className="mr-1" /> Add Section
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {draft.sections.map((section, sectionIndex) => (
                  <div
                    key={section.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className="mt-2 text-text-secondary hover:text-text-primary"
                      >
                        {expandedSections.has(section.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <div className="flex-1 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-12">
                          <div className="sm:col-span-7">
                            <Label className="text-xs">Section Title</Label>
                            <Input
                              value={section.title}
                              onChange={(e) => updateSection(section.id, { title: e.target.value })}
                              placeholder={`Section ${sectionIndex + 1}`}
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <Label className="text-xs">Weight</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.05}
                              value={section.weight}
                              onChange={(e) =>
                                updateSection(section.id, { weight: parseFloat(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div className="flex items-end justify-end sm:col-span-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSection(section.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          value={section.description || ""}
                          onChange={(e) => updateSection(section.id, { description: e.target.value })}
                          placeholder="Section description"
                          rows={2}
                        />

                        {expandedSections.has(section.id) && (
                          <div className="space-y-3 pl-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-text-primary">Subsections</h4>
                              <Button size="sm" variant="outline" onClick={() => addSubsection(section.id)}>
                                <Plus size={14} className="mr-1" /> Add Subsection
                              </Button>
                            </div>
                            {section.subsections.map((subsection, subIndex) => (
                              <div
                                key={subsection.id}
                                className="rounded-lg border border-border bg-surface-muted/50 p-3"
                              >
                                <div className="flex items-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleSubsection(subsection.id)}
                                    className="mt-1 text-text-secondary hover:text-text-primary"
                                  >
                                    {expandedSubsections.has(subsection.id) ? (
                                      <ChevronDown size={16} />
                                    ) : (
                                      <ChevronRight size={16} />
                                    )}
                                  </button>
                                  <div className="flex-1 space-y-2">
                                    <div className="grid gap-2 sm:grid-cols-12">
                                      <div className="sm:col-span-7">
                                        <Label className="text-xs">Subsection Title</Label>
                                        <Input
                                          value={subsection.title}
                                          onChange={(e) =>
                                            updateSubsection(section.id, subsection.id, {
                                              title: e.target.value,
                                            })
                                          }
                                          placeholder={`Subsection ${subIndex + 1}`}
                                        />
                                      </div>
                                      <div className="sm:col-span-3">
                                        <Label className="text-xs">Weight</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={0.05}
                                          value={subsection.weight}
                                          onChange={(e) =>
                                            updateSubsection(section.id, subsection.id, {
                                              weight: parseFloat(e.target.value) || 0,
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="flex items-end justify-end sm:col-span-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeSubsection(section.id, subsection.id)}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <X size={16} />
                                        </Button>
                                      </div>
                                    </div>
                                    <Textarea
                                      value={subsection.description || ""}
                                      onChange={(e) =>
                                        updateSubsection(section.id, subsection.id, {
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder="Subsection description"
                                      rows={2}
                                    />

                                    {expandedSubsections.has(subsection.id) && (
                                      <div className="space-y-2 pl-4">
                                        <div className="flex items-center justify-between">
                                          <h5 className="text-xs font-medium text-text-primary">Criteria</h5>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addCriterion(section.id, subsection.id)}
                                          >
                                            <Plus size={14} className="mr-1" /> Add Criterion
                                          </Button>
                                        </div>
                                        {subsection.criteria.map((criterion) => (
                                          <div
                                            key={criterion.id}
                                            className="rounded-md border border-border bg-surface p-3"
                                          >
                                            <div className="grid gap-2 sm:grid-cols-12">
                                              <div className="sm:col-span-5">
                                                <Label className="text-xs">Criterion</Label>
                                                <Input
                                                  value={criterion.title}
                                                  onChange={(e) =>
                                                    updateCriterion(
                                                      section.id,
                                                      subsection.id,
                                                      criterion.id,
                                                      { title: e.target.value }
                                                    )
                                                  }
                                                  placeholder="Criterion title"
                                                />
                                              </div>
                                              <div className="sm:col-span-3">
                                                <Label className="text-xs">Type</Label>
                                                <Select
                                                  value={criterion.type}
                                                  onChange={(e) =>
                                                    updateCriterion(
                                                      section.id,
                                                      subsection.id,
                                                      criterion.id,
                                                      { type: e.target.value as ValidationType }
                                                    )
                                                  }
                                                >
                                                  {(["error", "warning", "suggestion"] as ValidationType[]).map((t) => (
                                                    <option key={t} value={t}>
                                                      {validationTypeLabels[t]}
                                                    </option>
                                                  ))}
                                                </Select>
                                              </div>
                                              <div className="sm:col-span-2">
                                                <Label className="text-xs">Weight</Label>
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  step={0.1}
                                                  value={criterion.weight}
                                                  onChange={(e) =>
                                                    updateCriterion(
                                                      section.id,
                                                      subsection.id,
                                                      criterion.id,
                                                      { weight: parseFloat(e.target.value) || 0 }
                                                    )
                                                  }
                                                />
                                              </div>
                                              <div className="flex items-end justify-end sm:col-span-2">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() =>
                                                    removeCriterion(section.id, subsection.id, criterion.id)
                                                  }
                                                  className="text-red-600 hover:text-red-700"
                                                >
                                                  <X size={16} />
                                                </Button>
                                              </div>
                                            </div>
                                            <Textarea
                                              value={criterion.description || ""}
                                              onChange={(e) =>
                                                updateCriterion(
                                                  section.id,
                                                  subsection.id,
                                                  criterion.id,
                                                  { description: e.target.value }
                                                )
                                              }
                                              placeholder="Description of what to evaluate"
                                              rows={2}
                                              className="mt-2"
                                            />
                                            <Textarea
                                              value={criterion.prompt || ""}
                                              onChange={(e) =>
                                                updateCriterion(
                                                  section.id,
                                                  subsection.id,
                                                  criterion.id,
                                                  { prompt: e.target.value }
                                                )
                                              }
                                              placeholder="Optional LLM prompt for this criterion"
                                              rows={2}
                                              className="mt-2"
                                            />
                                          </div>
                                        ))}
                                        {subsection.criteria.length === 0 && (
                                          <p className="text-xs text-text-secondary">No criteria yet.</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {section.subsections.length === 0 && (
                              <p className="text-xs text-text-secondary">No subsections yet.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {draft.sections.length === 0 && (
                  <p className="text-center text-sm text-text-secondary">No sections yet.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
