"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const SigningPage = dynamic(
  () => import("@/components/SigningPage").then((mod) => mod.default),
  { ssr: false }
);

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;

  return (
    <main className="min-h-screen bg-background">
      <SigningPage token={token} />
    </main>
  );
}
