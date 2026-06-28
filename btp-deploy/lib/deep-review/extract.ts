// Document-text extraction helpers for the AI Enabled Review.
//
// Separates the "customer final proposal" (the document under review) from the
// supporting context documents (RFP / transcript / customer docs), always using
// the latest version of each category.

import type { Proposal, UploadedFile } from "../types";

export interface ExtractedDocumentTexts {
  finalProposalText: string;
  contextText: string;
}

function decodeBase64(base64: string): string {
  try {
    const decoded = atob(base64);
    return decodeURIComponent(escape(decoded));
  } catch {
    return atob(base64);
  }
}

function extractTextForDoc(doc: UploadedFile): string {
  if (doc.extractedText?.trim()) return doc.extractedText.trim();
  if (doc.content) {
    try {
      const decoded = decodeBase64(doc.content);
      if (decoded.trim()) return decoded.trim();
    } catch {
      // fall through
    }
  }
  return "[Binary content, no extracted text available]";
}

function getLatestDocsByCategory(docs: UploadedFile[]): Record<UploadedFile["category"], UploadedFile[]> {
  const grouped = new Map<UploadedFile["category"], UploadedFile[]>();
  for (const doc of docs) {
    const arr = grouped.get(doc.category) ?? [];
    arr.push(doc);
    grouped.set(doc.category, arr);
  }

  const result = {} as Record<UploadedFile["category"], UploadedFile[]>;
  for (const [category, catDocs] of grouped.entries()) {
    const sorted = catDocs.sort((a, b) => {
      const versionDiff = (b.version ?? 1) - (a.version ?? 1);
      if (versionDiff !== 0) return versionDiff;
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });
    const highestVersion = sorted[0]?.version ?? 1;
    result[category] = sorted.filter((d) => (d.version ?? 1) === highestVersion);
  }
  return result;
}

export function extractFinalProposalAndContext(proposal: Proposal): ExtractedDocumentTexts {
  const latestByCategory = getLatestDocsByCategory(proposal.documents);
  const finalProposalDocs = latestByCategory.final_proposal ?? [];
  const contextDocs = (["rfp", "transcript", "customer_doc"] as const).flatMap(
    (category) => latestByCategory[category] ?? []
  );

  const finalProposalText = finalProposalDocs
    .map((doc) => `## ${doc.name}\n\n${extractTextForDoc(doc)}`)
    .join("\n\n---\n\n");

  const contextText = contextDocs
    .map((doc) => `## ${doc.name} (${doc.category})\n\n${extractTextForDoc(doc)}`)
    .join("\n\n---\n\n");

  return { finalProposalText, contextText };
}

/** Concatenate every document's text (used as a fallback when no final proposal exists). */
export function extractAllDocumentText(proposal: Proposal): string {
  return proposal.documents
    .map((doc) => `## ${doc.name} (${doc.category})\n\n${extractTextForDoc(doc)}`)
    .join("\n\n---\n\n");
}
