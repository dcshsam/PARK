import { ProposalForm } from "@/components/proposal-form";

export default function NewProposalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">New Proposal Review</h1>
        <p className="text-text-secondary">Capture the RFP, transcripts, and customer documents for review.</p>
      </div>
      <ProposalForm />
    </div>
  );
}
