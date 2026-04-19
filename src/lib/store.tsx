"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Applicant, ApplicantStatus, Property } from "./types";
import { getSupabaseBrowserClient } from "./supabase/browser";
import { UpgradeRequiredError, isUpgradeRequiredPayload } from "./billing/upgrade-required-error";
import { serializePropertyForApi } from "./billing/property-payload";
import {
  applicantToInsert,
  applicantToUpdateRowPartial,
  normalizeDocumentKeys,
  type PropertyRow,
  rowToApplicant,
  rowToProperty,
} from "./db/mappers";
import type { ApplicantUpdatePatch } from "./db/mappers";

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string" && err.trim()) return new Error(err);
  if (err && typeof err === "object") {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return new Error(maybeMessage);
  }
  return new Error("Unknown database error");
}

interface DataStore {
  properties: Property[];
  applicants: Applicant[];
  loading: boolean;
  userId: string | null;
  refreshData: () => Promise<Applicant[]>;
  addProperty: (p: Omit<Property, "id" | "createdAt">) => Promise<Property>;
  updateProperty: (id: string, p: Omit<Property, "id" | "createdAt">) => Promise<Property>;
  addApplicant: (a: Omit<Applicant, "id" | "appliedAt" | "status">) => Promise<Applicant>;
  updateApplicant: (id: string, a: ApplicantUpdatePatch) => Promise<Applicant>;
  setApplicantStatus: (id: string, status: ApplicantStatus) => Promise<void>;
  deleteApplicant: (id: string) => Promise<void>;
}

const Ctx = createContext<DataStore | null>(null);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const refreshData = useCallback(async (): Promise<Applicant[]> => {
    setLoading(true);
    try {
      if (!supabase) {
        setUserId(null);
        setProperties([]);
        setApplicants([]);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUserId(null);
        setProperties([]);
        setApplicants([]);
        return;
      }
      setUserId(user.id);

      const { data: propRows, error: propErr } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (propErr) {
        console.error(propErr);
        setProperties([]);
        setApplicants([]);
        return [];
      }

      const rows = propRows ?? [];
      setProperties(rows.map((r) => rowToProperty(r)));

      const ids = rows.map((r: { id: string }) => r.id);
      if (ids.length === 0) {
        setApplicants([]);
        return;
      }

      const { data: appRows, error: appErr } = await supabase
        .from("applicants")
        .select("*")
        .in("property_id", ids);

      if (appErr) {
        console.error(appErr);
        setApplicants([]);
        return [];
      }

      const mapped = (appRows ?? []).map((r) => rowToApplicant(r));
      setApplicants(mapped);
      return mapped;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshData();
    });
    return () => subscription.unsubscribe();
  }, [supabase, refreshData]);

  const addProperty = useCallback<DataStore["addProperty"]>(
    async (p) => {
      if (!supabase) throw new Error("Supabase is not configured");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      let res: Response;
      try {
        res = await fetch("/api/properties", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serializePropertyForApi(p)),
        });
      } catch {
        throw new Error("Network error — check your connection and try again.");
      }

      const raw = await res.text();
      let data: unknown;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(res.ok ? "Invalid response from server." : `Could not save property (${res.status}).`);
      }

      if (!res.ok) {
        if (res.status === 403 && isUpgradeRequiredPayload(data)) {
          throw new UpgradeRequiredError(
            data.message,
            data.activePropertyCount,
            data.billablePropertyCount,
          );
        }
        const msg =
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Could not save property (${res.status}).`;
        throw new Error(msg);
      }

      await refreshData();
      return rowToProperty(data as PropertyRow);
    },
    [supabase, refreshData],
  );

  const updateProperty = useCallback<DataStore["updateProperty"]>(
    async (id, p) => {
      if (!supabase) throw new Error("Supabase is not configured");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      let res: Response;
      try {
        res = await fetch(`/api/properties/${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serializePropertyForApi(p)),
        });
      } catch {
        throw new Error("Network error — check your connection and try again.");
      }

      const raw = await res.text();
      let data: unknown;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(res.ok ? "Invalid response from server." : `Could not update property (${res.status}).`);
      }

      if (!res.ok) {
        if (res.status === 403 && isUpgradeRequiredPayload(data)) {
          throw new UpgradeRequiredError(
            data.message,
            data.activePropertyCount,
            data.billablePropertyCount,
          );
        }
        const msg =
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Could not update property (${res.status}).`;
        throw new Error(msg);
      }

      await refreshData();
      return rowToProperty(data as PropertyRow);
    },
    [supabase, refreshData],
  );

  const addApplicant = useCallback<DataStore["addApplicant"]>(
    async (a) => {
      if (!supabase) throw new Error("Supabase is not configured");
      const insert = applicantToInsert({
        ...a,
        submittedDocuments: normalizeDocumentKeys(a.submittedDocuments),
      });
      const { data, error } = await supabase.from("applicants").insert(insert).select("*").single();
      if (error) throw toError(error);
      await refreshData();
      return rowToApplicant(data);
    },
    [supabase, refreshData],
  );

  const setApplicantStatus = useCallback<DataStore["setApplicantStatus"]>(
    async (id, status) => {
      if (!supabase) throw new Error("Supabase is not configured");
      const { error } = await supabase.from("applicants").update({ status }).eq("id", id);
      if (error) throw toError(error);
      await refreshData();
    },
    [supabase, refreshData],
  );

  const updateApplicant = useCallback<DataStore["updateApplicant"]>(
    async (id, a) => {
      if (!supabase) throw new Error("Supabase is not configured");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: ownedProperties, error: ownedErr } = await supabase
        .from("properties")
        .select("id")
        .eq("user_id", user.id);
      if (ownedErr) throw toError(ownedErr);
      const propertyIds = (ownedProperties ?? []).map((p: { id: string }) => p.id);
      if (propertyIds.length === 0) {
        throw new Error("No accessible properties found for this account.");
      }

      const patch = applicantToUpdateRowPartial({
        ...a,
        ...(a.submittedDocuments !== undefined
          ? { submittedDocuments: normalizeDocumentKeys(a.submittedDocuments) }
          : {}),
      });
      if (Object.keys(patch).length === 0) {
        throw new Error("No applicant fields to update.");
      }
      const { data, error } = await supabase
        .from("applicants")
        .update(patch)
        .eq("id", id)
        .in("property_id", propertyIds)
        .select("*")
        .single();
      if (error) throw toError(error);
      await refreshData();
      return rowToApplicant(data);
    },
    [supabase, refreshData],
  );

  const deleteApplicant = useCallback<DataStore["deleteApplicant"]>(
    async (id) => {
      if (!supabase) throw new Error("Supabase is not configured");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: ownedProperties, error: ownedErr } = await supabase
        .from("properties")
        .select("id")
        .eq("user_id", user.id);
      if (ownedErr) throw toError(ownedErr);

      const propertyIds = (ownedProperties ?? []).map((p: { id: string }) => p.id);
      if (propertyIds.length === 0) {
        throw new Error("No accessible properties found for this account.");
      }

      const { error } = await supabase
        .from("applicants")
        .delete()
        .eq("id", id)
        .in("property_id", propertyIds);
      if (error) throw toError(error);
      await refreshData();
    },
    [supabase, refreshData],
  );

  const value = useMemo(
    () => ({
      properties,
      applicants,
      loading,
      userId,
      refreshData,
      addProperty,
      updateProperty,
      addApplicant,
      updateApplicant,
      setApplicantStatus,
      deleteApplicant,
    }),
    [
      properties,
      applicants,
      loading,
      userId,
      refreshData,
      addProperty,
      updateProperty,
      addApplicant,
      updateApplicant,
      setApplicantStatus,
      deleteApplicant,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useData = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
};
