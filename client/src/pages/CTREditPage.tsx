import { useParams, useLocation } from "wouter";
import { TestEditorModal } from "@/components/modals/TestEditorModal";

export function CTREditPage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const testId = params.id ? parseInt(params.id) : null;

  if (!testId) {
    navigate("/");
    return null;
  }

  return (
    <TestEditorModal
      testId={testId}
      open={true}
      onOpenChange={(open) => {
        if (!open) navigate("/");
      }}
    />
  );
}
