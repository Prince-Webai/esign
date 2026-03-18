"use client";

import dynamic from "next/dynamic";
const FormDashboard = dynamic(() => import("@/components/forms/FormDashboard").then(mod => mod.FormDashboard), { ssr: false });

export default function FormsPage() {
  return (
    <div className="container mx-auto py-8">
      <FormDashboard />
    </div>
  );
}
