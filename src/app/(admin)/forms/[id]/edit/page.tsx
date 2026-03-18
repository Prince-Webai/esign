"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
const FormBuilder = dynamic(() => import("@/components/forms/FormBuilder").then(mod => mod.FormBuilder), { ssr: false });

export default function EditFormPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="p-8">
      <FormBuilder formId={id} />
    </div>
  );
}
