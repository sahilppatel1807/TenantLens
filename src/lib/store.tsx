import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { mockApplicants, mockProperties } from "./mock-data";
import type { Applicant, ApplicantStatus, Property } from "./types";

interface DataStore {
  properties: Property[];
  applicants: Applicant[];
  addProperty: (p: Omit<Property, "id" | "createdAt">) => Property;
  addApplicant: (a: Omit<Applicant, "id" | "appliedAt" | "status">) => Applicant;
  setApplicantStatus: (id: string, status: ApplicantStatus) => void;
}

const Ctx = createContext<DataStore | null>(null);

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80";

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [applicants, setApplicants] = useState<Applicant[]>(
    mockApplicants.map((a) => ({ status: "new" as ApplicantStatus, ...a })),
  );

  const addProperty = useCallback<DataStore["addProperty"]>((p) => {
    const property: Property = {
      ...p,
      imageUrl: p.imageUrl || FALLBACK_IMAGE,
      id: `p_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setProperties((prev) => [property, ...prev]);
    return property;
  }, []);

  const addApplicant = useCallback<DataStore["addApplicant"]>((a) => {
    const applicant: Applicant = {
      ...a,
      id: `a_${Date.now().toString(36)}`,
      appliedAt: new Date().toISOString().slice(0, 10),
      status: "new",
    };
    setApplicants((prev) => [applicant, ...prev]);
    return applicant;
  }, []);

  const setApplicantStatus = useCallback<DataStore["setApplicantStatus"]>((id, status) => {
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const value = useMemo(
    () => ({ properties, applicants, addProperty, addApplicant, setApplicantStatus }),
    [properties, applicants, addProperty, addApplicant, setApplicantStatus],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useData = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
};
