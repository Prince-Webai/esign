"use client";

import dynamic from "next/dynamic";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

const UserManager = dynamic(
  () => import("@/components/UserManager").then((mod) => mod.UserManager),
  { ssr: false }
);

export default function UsersPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link 
          href="/" 
          className="p-2 h-10 w-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/70 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-muted-foreground">Manage authorized signers and their credentials.</p>
        </div>
      </div>

      <UserManager />
    </div>
  );
}
