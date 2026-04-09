import { Suspense } from "react";
import { VerifyProofForm } from "@/components/verify-proof-form";

export default function VerifyPage() {
  return (
    <main className="shell">
      <Suspense fallback={<section className="panel">Loading verification flow...</section>}>
        <VerifyProofForm />
      </Suspense>
    </main>
  );
}
