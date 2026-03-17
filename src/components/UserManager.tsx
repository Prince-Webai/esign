"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { UserPlus, Trash2, Mail, Loader2, ShieldCheck, Key, User, ShieldAlert, BadgeCheck, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  created_at: string;
}

export function UserManager() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPIN, setNewPIN] = useState(""); 
  const [newRole, setNewRole] = useState("signer");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase
      .from("registered_users")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (data) setUsers(data);
    setLoading(false);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newEmail || !newPIN) return;

    setIsAdding(true);
    
    const userData: any = { 
      name: newName, 
      email: newEmail, 
      password_hash: newPIN 
    };

    const { error: initialError } = await supabase
      .from("registered_users")
      .insert([{ ...userData, role: newRole }]);

    if (initialError) {
      const { error: retryError } = await supabase
        .from("registered_users")
        .insert([userData]);

      if (retryError) {
        alert("Error adding user: " + retryError.message);
      } else {
        alert("User added! Reminder: Run setup-database.sql for full role features.");
        resetForm();
      }
    } else {
      resetForm();
    }
    setIsAdding(false);
  }

  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPIN("");
    setNewRole("signer");
    fetchUsers();
  };

  async function handleDeleteUser(id: string) {
    const { error } = await supabase.from("registered_users").delete().eq("id", id);
    if (!error) fetchUsers();
    else alert("Failed to delete: " + error.message);
  }

  async function handleUpdatePIN(id: string, pin: string) {
    const { error } = await supabase
      .from("registered_users")
      .update({ password_hash: pin })
      .eq("id", id);
    
    if (!error) {
      fetchUsers();
      return true;
    } else {
      alert("Update failed: " + error.message);
      return false;
    }
  }

  const admins = users.filter(u => u.role === 'admin');
  const signers = users.filter(u => u.role !== 'admin');

  return (
    <div className="space-y-12 pb-20">
      {/* Create User Card */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-lg shadow-primary/5">
              <UserPlus className="w-6 h-6" />
           </div>
           <div>
              <h2 className="text-2xl font-extrabold text-white">Identity Registration</h2>
              <p className="text-slate-500 text-sm font-medium">Provision new accounts for the RAMS portal</p>
           </div>
        </div>

        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Name</label>
            <input 
              value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Full Name"
              className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-800"
            />
          </div>
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Email</label>
            <input 
              value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-800"
            />
          </div>
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Security PIN</label>
            <div className="relative">
               <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
               <input 
                 type="password"
                 value={newPIN} onChange={(e) => setNewPIN(e.target.value)}
                 placeholder="PIN Code"
                 className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-800"
               />
            </div>
          </div>
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Account Role</label>
            <div className="relative">
              <select 
                value={newRole} 
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
              >
                <option value="signer">Signer (Document Execution)</option>
                <option value="admin">Admin (System Overlord)</option>
              </select>
            </div>
          </div>
          <button 
            disabled={isAdding}
            type="submit"
            className="premium-gradient text-primary-foreground font-bold h-[54px] rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-primary/10"
          >
            {isAdding ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Add"}
          </button>
        </form>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-1">
        {/* Administrators */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 flex items-center gap-3 pl-2">
             <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
             Administrators
          </h3>
          <div className="bg-slate-900/20 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl">
            {admins.length === 0 ? (
              <div className="p-12 text-center text-slate-600 italic text-sm">No administrators provisioned.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {admins.map(user => (
                  <UserRow key={user.id} user={user} onDelete={handleDeleteUser} onUpdatePIN={handleUpdatePIN} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Signers */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3 pl-2">
             <div className="w-1.5 h-1.5 rounded-full bg-primary" />
             Verified Signers
          </h3>
          <div className="bg-slate-900/20 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl">
             {signers.length === 0 ? (
                <div className="p-12 text-center text-slate-600 italic text-sm">No signers registered yet.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {signers.map(user => (
                    <UserRow key={user.id} user={user} onDelete={handleDeleteUser} onUpdatePIN={handleUpdatePIN} />
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserRow({ 
  user, 
  onDelete,
  onUpdatePIN 
}: { 
  user: RegisteredUser, 
  onDelete: (id: string) => void,
  onUpdatePIN: (id: string, pin: string) => Promise<boolean>
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingPIN, setIsEditingPIN] = useState(false);
  const [newPIN, setNewPIN] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const performDelete = async () => {
    setIsDeleting(true);
    await onDelete(user.id);
    setIsDeleting(false);
    setConfirmDelete(false);
  };

  const performUpdatePIN = async () => {
    if (newPIN.length < 4) {
      alert("PIN must be 4 digits");
      return;
    }
    setIsUpdating(true);
    const success = await onUpdatePIN(user.id, newPIN);
    if (success) {
      setIsEditingPIN(false);
      setNewPIN("");
    }
    setIsUpdating(false);
  };

  return (
    <div className="group flex flex-col hover:bg-white/[0.03] transition-all divide-y divide-white/5">
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-[11px] font-black shadow-lg transition-transform group-hover:scale-110",
            user.role === 'admin' ? "bg-amber-500/10 text-amber-500 shadow-amber-500/5 border border-amber-500/10" : "bg-primary/10 text-primary shadow-primary/5 border border-primary/10"
          )}>
            {user.name.charAt(0)}
          </div>
          <div className="space-y-0.5">
            <p className="font-bold text-white text-base leading-tight">{user.name}</p>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {user.email}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!confirmDelete && !isEditingPIN && (
            <button 
              onClick={() => setIsEditingPIN(true)}
              className="p-3 text-slate-700 hover:text-amber-500 hover:bg-amber-500/10 rounded-2xl transition-all"
              title="Change PIN"
            >
              <Key className="w-5 h-5" />
            </button>
          )}

          {confirmDelete ? (
            <div className="flex items-center gap-1 bg-slate-950 border border-white/5 rounded-xl p-1 animate-in fade-in zoom-in duration-200">
              <button 
                onClick={performDelete}
                disabled={isDeleting}
                className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all"
                title="Confirm Removal"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setConfirmDelete(false)}
                className="p-2 text-slate-500 hover:bg-white/5 rounded-lg transition-all"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : !isEditingPIN ? (
            <button 
              onClick={() => setConfirmDelete(true)}
              className="p-3 text-slate-700 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
              title="Remove User"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </div>

      {isEditingPIN && (
        <div className="px-6 py-4 bg-slate-950/20 animate-in slide-in-from-top-2 duration-300">
           <div className="flex items-center gap-4">
              <div className="flex-1 max-w-[200px]">
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500" />
                  <input 
                    type="password"
                    maxLength={4}
                    value={newPIN}
                    onChange={(e) => setNewPIN(e.target.value)}
                    placeholder="New 4-digit PIN"
                    className="w-full bg-slate-950 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 outline-none transition-all placeholder:text-slate-800"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={performUpdatePIN}
                  disabled={isUpdating || newPIN.length < 4}
                  className="px-4 py-2 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-500/20 transition-all disabled:opacity-30"
                >
                  {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Update PIN"}
                </button>
                <button 
                  onClick={() => setIsEditingPIN(false)}
                  className="p-2 text-slate-500 hover:bg-white/5 rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
