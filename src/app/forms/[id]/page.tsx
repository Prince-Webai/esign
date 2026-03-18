"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
const FormRenderer = dynamic(() => import("@/components/forms/FormRenderer").then(mod => mod.FormRenderer), { ssr: false });

export default function PublicFormPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <FormRenderer formId={id} />
    </div>
  );
}
