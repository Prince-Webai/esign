"use client";

import dynamic from "next/dynamic";
const FormBuilder = dynamic(() => import("@/components/forms/FormBuilder").then(mod => mod.FormBuilder), { ssr: false });

export default function NewFormPage() {
  return (
    <div className="p-8">
      <FormBuilder />
    </div>
  );
}
