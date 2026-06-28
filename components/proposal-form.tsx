"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addProposal } from "@/lib/db";
import { sampleProposal, sampleDocuments } from "@/lib/sample-proposal";
import type { DocumentCategory, UploadedFile } from "@/lib/types";
import { categoryLabels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { FileUpload } from "@/components/file-upload";
import { ManualTextInput } from "@/components/manual-text-input";
import {
  getTechnologies,
  getProjectTypes,
  getSparcOwners,
  getSparcMentors,
  getGtmOwners,
  getProposalReviewers,
  getProposalRegions,
} from "@/lib/workspace-config";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

const supportingCategories: DocumentCategory[] = ["rfp", "transcript", "customer_doc"];

export function ProposalForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    clientName: "",
    description: "",
    dueDate: "",
    technology: "",
    projectType: "",
    sparcOwner: "",
    sparcMentor: "",
    gtmOwner: "",
    proposalReviewer: "",
    proposalRegion: "",
    documents: {
      rfp: [] as Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[],
      transcript: [] as Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[],
      customer_doc: [] as Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[],
      final_proposal: [] as Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[],
    },
  });

  const technologies = getTechnologies();
  const projectTypes = getProjectTypes();
  const sparcOwners = getSparcOwners();
  const sparcMentors = getSparcMentors();
  const gtmOwners = getGtmOwners();
  const proposalReviewers = getProposalReviewers();
  const proposalRegions = getProposalRegions();

  const allDocuments = [
    ...form.documents.rfp,
    ...form.documents.transcript,
    ...form.documents.customer_doc,
    ...form.documents.final_proposal,
  ];

  const updateDoc = (category: DocumentCategory, files: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]) => {
    setForm((prev) => ({ ...prev, documents: { ...prev.documents, [category]: files } }));
  };

  const addManualDoc = (category: DocumentCategory, text: string) => {
    const blob = new Blob([text]);
    const encoded = btoa(unescape(encodeURIComponent(text)));
    const manualDoc: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt"> = {
      category,
      name: `${categoryLabels[category]} (manual) ${new Date().toLocaleString()}`,
      size: blob.size,
      mimeType: "text/plain",
      content: encoded,
      extractedText: text,
    };
    setForm((prev) => ({
      ...prev,
      documents: { ...prev.documents, [category]: [...prev.documents[category], manualDoc] },
    }));
  };

  const canProceed = step === 1 ? form.title.trim() && form.clientName.trim() : true;

  const loadSampleData = () => {
    setForm((prev) => ({
      ...prev,
      title: sampleProposal.title,
      clientName: sampleProposal.clientName,
      description: sampleProposal.description,
      technology: sampleProposal.technology,
      projectType: sampleProposal.projectType,
      proposalRegion: sampleProposal.proposalRegion,
      documents: {
        rfp: sampleDocuments.filter((d) => d.category === "rfp"),
        transcript: sampleDocuments.filter((d) => d.category === "transcript"),
        customer_doc: sampleDocuments.filter((d) => d.category === "customer_doc"),
        final_proposal: sampleDocuments.filter((d) => d.category === "final_proposal"),
      },
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const proposal = await addProposal({
        title: form.title,
        clientName: form.clientName,
        description: form.description,
        dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
        technology: form.technology || undefined,
        projectType: form.projectType || undefined,
        sparcOwner: form.sparcOwner || undefined,
        sparcMentor: form.sparcMentor || undefined,
        gtmOwner: form.gtmOwner || undefined,
        proposalReviewer: form.proposalReviewer || undefined,
        proposalRegion: form.proposalRegion || undefined,
        status: "submitted",
        summary: "",
        documents: allDocuments,
      });
      router.push(`/proposals/${proposal.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadSampleData}
          disabled={submitting}
        >
          Load sample proposal
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all",
                  step >= s
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-border-strong bg-surface text-text-tertiary"
                )}
              >
                {step > s ? <Check size={18} /> : s}
              </div>
              <span
                className={cn(
                  "hidden text-sm font-medium md:block",
                  step >= s ? "text-text-primary" : "text-text-tertiary"
                )}
              >
                {s === 1 && "Basic Info"}
                {s === 2 && "Supporting Docs"}
                {s === 3 && "Final Proposal"}
                {s === 4 && "Review & Submit"}
              </span>
            </div>
            {s !== 4 && (
              <div
                className={cn(
                  "mx-4 h-0.5 flex-1 transition-colors",
                  step > s ? "bg-primary-600" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Proposal basics</CardTitle>
              <CardDescription>Capture the core details about this opportunity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Proposal / RFP Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Enterprise CRM Modernization"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client">
                    Customer / Client Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="client"
                    value={form.clientName}
                    onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                    placeholder="e.g. Acme Corporation"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="technology">Technology</Label>
                  <Select
                    id="technology"
                    value={form.technology}
                    onChange={(e) => setForm({ ...form, technology: e.target.value })}
                  >
                    <option value="">Select technology...</option>
                    {technologies.map((tech) => (
                      <option key={tech} value={tech}>
                        {tech}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectType">Project Type</Label>
                  <Select
                    id="projectType"
                    value={form.projectType}
                    onChange={(e) => setForm({ ...form, projectType: e.target.value })}
                  >
                    <option value="">Select type...</option>
                    {projectTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sparcOwner">Sparc Owner</Label>
                  <Select
                    id="sparcOwner"
                    value={form.sparcOwner}
                    onChange={(e) => setForm({ ...form, sparcOwner: e.target.value })}
                  >
                    <option value="">Select Sparc owner...</option>
                    {sparcOwners.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sparcMentor">Sparc Mentor</Label>
                  <Select
                    id="sparcMentor"
                    value={form.sparcMentor}
                    onChange={(e) => setForm({ ...form, sparcMentor: e.target.value })}
                  >
                    <option value="">Select Sparc mentor...</option>
                    {sparcMentors.map((mentor) => (
                      <option key={mentor} value={mentor}>
                        {mentor}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gtmOwner">GTM Owner</Label>
                  <Select
                    id="gtmOwner"
                    value={form.gtmOwner}
                    onChange={(e) => setForm({ ...form, gtmOwner: e.target.value })}
                  >
                    <option value="">Select GTM owner...</option>
                    {gtmOwners.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposalReviewer">Proposal Reviewer</Label>
                  <Select
                    id="proposalReviewer"
                    value={form.proposalReviewer}
                    onChange={(e) => setForm({ ...form, proposalReviewer: e.target.value })}
                  >
                    <option value="">Select reviewer...</option>
                    {proposalReviewers.map((reviewer) => (
                      <option key={reviewer} value={reviewer}>
                        {reviewer}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposalRegion">Proposal Region</Label>
                  <Select
                    id="proposalRegion"
                    value={form.proposalRegion}
                    onChange={(e) => setForm({ ...form, proposalRegion: e.target.value })}
                  >
                    <option value="">Select region...</option>
                    {proposalRegions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Response Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description / Notes</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Add context, opportunity value, or any notes..."
                  rows={4}
                />
              </div>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Upload supporting documents</CardTitle>
              <CardDescription>
                Upload documents that help the AI understand the customer requirements (e.g., RFP, meeting notes, customer docs).
                These are used as context and are not scored directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                {supportingCategories.map((category) => (
                  <div key={category} className="space-y-3">
                    <FileUpload
                      category={category}
                      files={form.documents[category]}
                      onChange={(files) => updateDoc(category, files)}
                    />
                    <ManualTextInput
                      category={category}
                      onAdd={(text) => addManualDoc(category, text)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Upload customer final proposal</CardTitle>
              <CardDescription>
                Upload the customer&apos;s final proposal document. The AI Enabled Review will evaluate this document across the deep-review sections and built-in rules, using the supporting documents from the previous step for context.
                Multiple files and formats (TXT, MD, PDF, DOCX, images) are supported.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="mx-auto max-w-2xl space-y-3">
                <FileUpload
                  category="final_proposal"
                  files={form.documents.final_proposal}
                  onChange={(files) => updateDoc("final_proposal", files)}
                />
                <ManualTextInput
                  category="final_proposal"
                  onAdd={(text) => addManualDoc("final_proposal", text)}
                />
              </div>
            </CardContent>
          </>
        )}

        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle>Review and submit</CardTitle>
              <CardDescription>Double-check the information before creating the review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Title</dt>
                    <dd className="text-sm font-medium text-text-primary">{form.title}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Client</dt>
                    <dd className="text-sm font-medium text-text-primary">{form.clientName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Due Date</dt>
                    <dd className="text-sm text-text-primary">
                      {form.dueDate ? new Date(form.dueDate).toLocaleDateString() : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Documents</dt>
                    <dd className="text-sm text-text-primary">{allDocuments.length} document(s)</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Technology</dt>
                    <dd className="text-sm text-text-primary">{form.technology || "Not selected"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Project Type</dt>
                    <dd className="text-sm text-text-primary">{form.projectType || "Not selected"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Sparc Owner</dt>
                    <dd className="text-sm text-text-primary">{form.sparcOwner || "Not selected"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Sparc Mentor</dt>
                    <dd className="text-sm text-text-primary">{form.sparcMentor || "Not selected"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">GTM Owner</dt>
                    <dd className="text-sm text-text-primary">{form.gtmOwner || "Not selected"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Proposal Reviewer</dt>
                    <dd className="text-sm text-text-primary">{form.proposalReviewer || "Not selected"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Proposal Region</dt>
                    <dd className="text-sm text-text-primary">{form.proposalRegion || "Not selected"}</dd>
                  </div>
                </dl>
                {form.description && (
                  <div className="mt-3 border-t border-border-subtle pt-3">
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Description</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{form.description}</dd>
                  </div>
                )}
              </div>

              {allDocuments.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-text-primary">Attached documents</h4>
                  <ul className="divide-y divide-border-subtle rounded-xl border border-border bg-surface">
                    {allDocuments.map((file) => (
                      <li key={`${file.category}-${file.name}`} className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-text-primary">{file.name}</span>
                        <span className="text-xs text-text-tertiary">{formatBytes(file.size)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-3">
              <Button variant="outline" onClick={() => setStep(3)} disabled={submitting}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Proposal Review
              </Button>
            </CardFooter>
          </>
        )}

        {step !== 4 && (
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
              <ChevronLeft size={16} className="mr-1" /> Back
            </Button>
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
