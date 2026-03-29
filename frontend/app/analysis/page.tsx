import { AnalysisPageClient } from "@/components/AnalysisPageClient";

type AnalysisPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AnalysisPage({ searchParams }: AnalysisPageProps) {
  const resolved = await searchParams;
  const idParam = resolved.id;
  const analysisId = typeof idParam === "string" ? idParam : "";

  return <AnalysisPageClient initialAnalysisId={analysisId} />;
}
