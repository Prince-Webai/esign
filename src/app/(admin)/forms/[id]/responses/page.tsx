"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
const FormResponses = dynamic(() => import("@/components/forms/FormResponses").then(mod => mod.FormResponses), { ssr: false });

export default function ResponsesPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="container mx-auto py-8">
      <FormResponses formId={id} />
    </div>
  );
}
