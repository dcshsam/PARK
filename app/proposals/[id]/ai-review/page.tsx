"use client";

import { useParams } from "next/navigation";
import { AiReviewPanel } from "@/components/ai-review-panel";

export default function AiEnabledReviewPage() {
  const params = useParams();
  return <AiReviewPanel proposalId={params.id as string} />;
}
