"use client";

import { useState, useEffect } from "react";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Settings2, 
  Save, 
  Eye, 
  X, 
  Type, 
  AlignLeft, 
  CheckSquare, 
  CircleDot, 
  Image as ImageIcon, 
  ChevronDown, 
  Calendar,
  Webhook,
  Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Types
type FieldType = 'input' | 'textarea' | 'select' | 'radio' | 'image' | 'date';

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  order_index: number;
}

interface FormConfig {
  name: string;
  webhook_url: string;
}

// Draggable Sidebar Item
function SidebarItem({ type, label, icon: Icon }: { type: FieldType, label: string, icon: any }) {
  return (
    <div 
      className="flex items-center gap-3 p-4 bg-slate-900/40 border border-white/5 rounded-2xl cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all group"
      onClick={() => {}} // In a real JotForm, you'd click or drag to add
    >
      <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <span className="font-bold text-sm text-slate-400 group-hover:text-white transition-colors">{label}</span>
    </div>
  );
}

// Sortable Field Item
function SortableField({ 
  field, 
  onDelete, 
  onSelect, 
  isSelected 
}: { 
  field: FormField, 
  onDelete: () => void, 
  onSelect: () => void,
  isSelected: boolean 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.3 : 1
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "relative group bg-slate-900/40 border border-white/5 rounded-3xl p-6 transition-all",
        isSelected ? "ring-2 ring-primary bg-primary/5 border-primary/20" : "hover:border-white/10"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        <button 
          {...attributes} 
          {...listeners} 
          className="p-2 cursor-grab active:cursor-grabbing text-slate-600 hover:text-primary transition-colors mt-1"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">{field.type}</span>
              <h4 className="text-lg font-bold text-white">{field.label || "Untitled Field"}</h4>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 text-slate-600 hover:text-red-500 transition-colors bg-slate-950/50 rounded-xl"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="pointer-events-none opacity-40">
            {field.type === 'input' && (
              <div className="bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-600">
                {field.placeholder || "Enter text..."}
              </div>
            )}
            {field.type === 'textarea' && (
              <div className="bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-600 h-24">
                {field.placeholder || "Enter long text..."}
              </div>
            )}
            {field.type === 'select' && (
              <div className="bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-600 flex justify-between items-center">
                <span>Select option...</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            )}
            {field.type === 'image' && (
                <div className="border-2 border-dashed border-white/5 rounded-2xl h-32 flex flex-col items-center justify-center text-slate-700">
                   <ImageIcon className="w-8 h-8 mb-2" />
                   <span className="text-xs font-bold uppercase tracking-widest">Image Upload Dropzone</span>
                </div>
            )}
          </div>
        </div>
      </div>

      {field.required && (
        <div className="absolute top-6 right-16">
           <span className="text-red-500 text-xl">*</span>
        </div>
      )}
    </div>
  );
}

export function FormBuilder({ formId }: { formId?: string }) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [config, setConfig] = useState<FormConfig>({ name: "Untitled Form", webhook_url: "" });
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (formId) {
      fetchForm();
    }
  }, [formId]);

  async function fetchForm() {
    const { data: form } = await supabase.from("forms").select("*").eq("id", formId).single();
    if (form) setConfig({ name: form.name, webhook_url: form.webhook_url || "" });

    const { data: fieldsData } = await supabase
      .from("form_fields")
      .select("*")
      .eq("form_id", formId)
      .order("order_index", { ascending: true });
    
    if (fieldsData) setFields(fieldsData);
  }

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      placeholder: "",
      required: false,
      options: type === 'select' || type === 'radio' ? ["Option 1", "Option 2"] : undefined,
      order_index: fields.length
    };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);
        return newArray.map((item, index) => ({ ...item, order_index: index }));
      });
    }
  };

  const saveForm = async () => {
    setIsSaving(true);
    try {
      let currentFormId = formId;

      const formPayload = {
        name: config.name,
        webhook_url: config.webhook_url,
        updated_at: new Date().toISOString()
      };

      if (currentFormId) {
        await supabase.from("forms").update(formPayload).eq("id", currentFormId);
      } else {
        const { data } = await supabase.from("forms").insert([formPayload]).select().single();
        currentFormId = data.id;
      }

      // Sync fields (Delete all and re-insert for simplicity in this implementation)
      await supabase.from("form_fields").delete().eq("form_id", currentFormId);
      
      const fieldsPayload = fields.map((f, index) => ({
        form_id: currentFormId,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder,
        required: f.required,
        options: f.options,
        order_index: index
      }));

      await supabase.from("form_fields").insert(fieldsPayload);
      
      alert("Form deployed successfully!");
      if (!formId) window.location.href = `/forms/${currentFormId}/edit`;
    } catch (error: any) {
      alert("Error saving form: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedField = fields.find(f => f.id === selectedFieldId);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-6">
           <Link href="/forms" className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors">
              <X className="w-6 h-6" />
           </Link>
           <div className="space-y-1">
              <input 
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="bg-transparent text-3xl font-black text-white outline-none focus:text-primary transition-colors border-b border-transparent focus:border-primary/30"
                placeholder="Form Name"
              />
              <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                 Builder Interface Active
              </p>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 border border-white/5 rounded-2xl text-slate-400 font-bold hover:text-white transition-all active:scale-95">
              <Eye className="w-5 h-5" />
              PREVIEW
           </button>
           <button 
             onClick={saveForm}
             disabled={isSaving}
             className="premium-gradient px-8 py-3 rounded-2xl flex items-center gap-3 text-primary-foreground font-black shadow-xl shadow-primary/20 hover:scale-[1.03] transition-all active:scale-95"
           >
             {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> DEPLOY FORM</>}
           </button>
        </div>
      </div>

      <div className="flex-1 flex gap-8 min-h-0">
        {/* Left Sidebar: Components */}
        <div className="w-72 flex flex-col gap-6">
           <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-6 flex-1 overflow-y-auto space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 pl-2">Elements</h3>
              <div className="space-y-3">
                 <button onClick={() => addField('input')} className="w-full text-left">
                    <SidebarItem type="input" label="Short Text" icon={Type} />
                 </button>
                 <button onClick={() => addField('textarea')} className="w-full text-left">
                    <SidebarItem type="textarea" label="Long Text" icon={AlignLeft} />
                 </button>
                 <button onClick={() => addField('select')} className="w-full text-left">
                    <SidebarItem type="select" label="Dropdown" icon={ChevronDown} />
                 </button>
                 <button onClick={() => addField('radio')} className="w-full text-left">
                    <SidebarItem type="radio" label="Multiple Choice" icon={CircleDot} />
                 </button>
                 <button onClick={() => addField('date')} className="w-full text-left">
                    <SidebarItem type="date" label="Date Picker" icon={Calendar} />
                 </button>
                 <button onClick={() => addField('image')} className="w-full text-left">
                    <SidebarItem type="image" label="Image Upload" icon={ImageIcon} />
                 </button>
              </div>
           </div>
           
           <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] p-6 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-6 pl-2">Integrations</h3>
              <div className="space-y-2">
                 <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Webhook Target</label>
                 <div className="relative">
                    <Webhook className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      value={config.webhook_url}
                      onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                      placeholder="https://n8n.cloud/webhook/..."
                      className="w-full bg-slate-950 border border-white/5 rounded-xl pl-9 pr-4 py-3 text-[11px] focus:ring-1 focus:ring-amber-500/30 outline-none transition-all placeholder:text-slate-800"
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 bg-slate-950/40 border border-white/5 rounded-[48px] overflow-hidden flex flex-col">
           <div className="p-8 pb-0 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/10 px-4 py-2 rounded-full ring-1 ring-primary/20 shadow-lg shadow-primary/5">
                 Live Canvas
              </span>
              <span className="text-slate-600 font-bold text-xs uppercase tracking-widest">{fields.length} Components Active</span>
           </div>
           
           <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setActiveId(e.active.id as string)}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="max-w-2xl mx-auto space-y-4">
                    {fields.map((field) => (
                      <SortableField 
                        key={field.id} 
                        field={field} 
                        isSelected={selectedFieldId === field.id}
                        onDelete={() => deleteField(field.id)}
                        onSelect={() => setSelectedFieldId(field.id)}
                      />
                    ))}
                    {fields.length === 0 && (
                      <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl group">
                         <Plus className="w-12 h-12 text-slate-900 mx-auto mb-4 group-hover:text-slate-700 transition-colors" />
                         <p className="text-slate-700 font-black uppercase tracking-[0.2em] text-[10px]">Drag or click elements to begin</p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
           </div>
        </div>

        {/* Right Sidebar: Editor */}
        <div className="w-80">
           <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[32px] h-full p-8 flex flex-col">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 flex items-center gap-3">
                 <Settings2 className="w-4 h-4" /> Properties
              </h3>

              {selectedField ? (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                   <div className="space-y-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Label Name</label>
                         <input 
                           value={selectedField.label}
                           onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                           className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Placeholder</label>
                         <input 
                           value={selectedField.placeholder}
                           onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                           className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                         />
                      </div>
                   </div>

                   <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-white/5">
                      <div className="space-y-1">
                         <p className="text-xs font-bold text-white">Required Field</p>
                         <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest">Mandatory Entry</p>
                      </div>
                      <button 
                         onClick={() => updateField(selectedField.id, { required: !selectedField.required })}
                         className={cn(
                           "p-1 w-12 h-6 rounded-full transition-all duration-300 flex items-center",
                           selectedField.required ? "bg-primary" : "bg-slate-800"
                         )}
                      >
                         <div className={cn(
                           "w-4 h-4 bg-white rounded-full transition-all shadow-md",
                           selectedField.required ? "translate-x-6" : "translate-x-1"
                         )} />
                      </button>
                   </div>

                   {(selectedField.type === 'select' || selectedField.type === 'radio') && (
                     <div className="space-y-4">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Options List</label>
                        <div className="space-y-2">
                           {selectedField.options?.map((opt, idx) => (
                             <div key={idx} className="flex gap-2 group/opt">
                                <input 
                                  value={opt}
                                  onChange={(e) => {
                                    const next = [...(selectedField.options || [])];
                                    next[idx] = e.target.value;
                                    updateField(selectedField.id, { options: next });
                                  }}
                                  className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:ring-1 focus:ring-primary/30"
                                />
                                <button 
                                  onClick={() => {
                                    const next = selectedField.options?.filter((_, i) => i !== idx);
                                    updateField(selectedField.id, { options: next });
                                  }}
                                  className="p-3 text-slate-800 hover:text-red-500 transition-colors"
                                >
                                   <X className="w-4 h-4" />
                                </button>
                             </div>
                           ))}
                           <button 
                             onClick={() => updateField(selectedField.id, { options: [...(selectedField.options || []), "New Option"] })}
                             className="w-full py-3 bg-slate-950 border-2 border-dashed border-white/5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 hover:text-primary hover:border-primary/20 transition-all"
                           >
                              + Append Option
                           </button>
                        </div>
                     </div>
                   )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 space-y-4 opacity-30">
                   <Settings2 className="w-12 h-12 text-slate-800" />
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Select a component to access property configuration</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
