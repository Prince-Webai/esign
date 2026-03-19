import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface OrganizationSettings {
  name: string;
  logo_url: string | null;
}

export function useOrganization() {
  const [org, setOrg] = useState<OrganizationSettings>({
    name: "TRE Energy",
    logo_url: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchOrg = async () => {
    try {
      const { data, error } = await supabase
        .from("organization_settings")
        .select("name, logo_url")
        .eq("id", 1)
        .single();
      
      if (data && !error) {
        setOrg(data);
      }
    } catch (err) {
      console.error("Failed to fetch organization settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrg();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("org-settings-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "organization_settings",
          filter: "id=eq.1",
        },
        (payload) => {
          setOrg(payload.new as OrganizationSettings);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { org, loading, refreshOrg: fetchOrg };
}
