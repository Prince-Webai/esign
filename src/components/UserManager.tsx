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
    <div className="space-y-12 pb-20 animate-in fade-in slide-in-from-top-4 duration-700">
      {/* Create User Card */}
      <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-xl shadow-slate-900/5">
        <div className="flex items-center gap-6 mb-10">
           <div className="w-16 h-16 rounded-[24px] bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm transition-transform hover:scale-105 duration-300">
              <UserPlus className="w-7 h-7" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Identity Registration</h2>
              <p className="text-slate-500 font-medium text-lg">Provision new accounts for the secure portal</p>
           </div>
        </div>

        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-8 items-end">
          <div className="space-y-2.5 text-left md:col-span-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Name</label>
            <input 
              value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Full Name"
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 outline-none transition-all placeholder:text-slate-300"
            />
          </div>
          <div className="space-y-2.5 text-left md:col-span-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Email</label>
            <input 
              value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 outline-none transition-all placeholder:text-slate-300"
            />
          </div>
          <div className="space-y-2.5 text-left md:col-span-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Security PIN</label>
            <div className="relative">
               <Key className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
               <input 
                 type="password"
                 value={newPIN} onChange={(e) => setNewPIN(e.target.value)}
                 placeholder="PIN Code"
                 className="w-full bg-slate-50 border border-slate-200 rounded-3xl pl-14 pr-6 py-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 outline-none transition-all placeholder:text-slate-300"
               />
            </div>
          </div>
          <div className="space-y-2.5 text-left md:col-span-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Account Role</label>
            <div className="relative group">
              <select 
                value={newRole} 
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 outline-none appearance-none cursor-pointer"
              >
                <option value="signer">Signer (Execution)</option>
                <option value="admin">Admin (Systems)</option>
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                 <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
          </div>
          <button 
            disabled={isAdding}
            type="submit"
            className="bg-emerald-600 text-white font-black h-[64px] rounded-3xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 uppercase text-[10px] tracking-[0.2em]"
          >
            {isAdding ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Add"}
          </button>
        </form>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Administrators */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-4 pl-6">
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" />
             Administrators
          </h3>
          <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-900/5 transition-all duration-500">
            {admins.length === 0 ? (
              <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs py-24">No administrators provisioned</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {admins.map(user => (
                  <UserRow key={user.id} user={user} onDelete={handleDeleteUser} onUpdatePIN={handleUpdatePIN} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Signers */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-4 pl-6">
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" />
             Verified Signers
          </h3>
          <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-900/5 transition-all duration-500">
             {signers.length === 0 ? (
                <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs py-24">No signers registered yet</div>
              ) : (
                <div className="divide-y divide-slate-100">
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
    <div className="group flex flex-col hover:bg-slate-50 transition-all divide-y divide-slate-50">
      <div className="flex items-center justify-between p-8">
        <div className="flex items-center gap-6">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-black shadow-sm border transition-transform group-hover:scale-110 duration-300",
            user.role === 'admin' ? "bg-amber-50 border-amber-100 text-amber-600 font-black" : "bg-emerald-50 border-emerald-100 text-emerald-600 font-black"
          )}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <p className="font-black text-slate-900 text-lg leading-tight tracking-tight">{user.name}</p>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-[0.15em]">
                {user.email}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!confirmDelete && !isEditingPIN && (
            <button 
              onClick={() => setIsEditingPIN(true)}
              className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all border border-transparent hover:border-emerald-100"
              title="Change PIN"
            >
              <Key className="w-5 h-5" />
            </button>
          )}

          {confirmDelete ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 animate-in fade-in zoom-in duration-200">
              <button 
                onClick={performDelete}
                disabled={isDeleting}
                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                title="Confirm Removal"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => setConfirmDelete(false)}
                className="p-2 text-slate-400 hover:bg-white rounded-xl transition-all"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : !isEditingPIN ? (
            <button 
              onClick={() => setConfirmDelete(true)}
              className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
              title="Remove User"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </div>

      {isEditingPIN && (
        <div className="px-8 py-6 bg-slate-50 animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-6">
              <div className="flex-1 max-w-[240px]">
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  <input 
                    type="password"
                    maxLength={4}
                    value={newPIN}
                    onChange={(e) => setNewPIN(e.target.value)}
                    placeholder="New 4-digit PIN"
                    className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={performUpdatePIN}
                  disabled={isUpdating || newPIN.length < 4}
                  className="px-6 py-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all disabled:opacity-30 shadow-lg shadow-emerald-500/10"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update PIN"}
                </button>
                <button 
                  onClick={() => setIsEditingPIN(false)}
                  className="p-3 bg-white text-slate-400 hover:text-slate-900 border border-slate-200 rounded-2xl transition-all shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
