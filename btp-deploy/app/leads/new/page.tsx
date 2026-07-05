import { LeadForm } from "@/components/lead-form";
import { RequireAccess } from "@/components/require-access";

export default function NewLeadPage() {
  return (
    <RequireAccess action="create_lead">
      <LeadForm />
    </RequireAccess>
  );
}
