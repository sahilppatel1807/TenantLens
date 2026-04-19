import { z } from "zod";
import type { DocumentKey, Property } from "@/lib/types";
import { DOCUMENT_KEYS } from "@/lib/types";

const documentKeySchema = z.enum(DOCUMENT_KEYS as [DocumentKey, ...DocumentKey[]]);

export const propertyPayloadSchema = z.object({
  address: z.string().min(1),
  suburb: z.string().min(1),
  city: z.string().min(1),
  weeklyRent: z.number().int().nonnegative(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  parking: z.number().int().nonnegative(),
  status: z.enum(["active", "leased", "draft"]),
  imageUrl: z.string(),
  requiredDocuments: z.array(documentKeySchema),
});

export type PropertyPayload = z.infer<typeof propertyPayloadSchema>;

export function serializePropertyForApi(p: Omit<Property, "id" | "createdAt">): PropertyPayload {
  return {
    address: p.address,
    suburb: p.suburb,
    city: p.city,
    weeklyRent: p.weeklyRent,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    parking: p.parking,
    status: p.status,
    imageUrl: p.imageUrl,
    requiredDocuments: p.requiredDocuments,
  };
}

export function payloadToPropertyInput(payload: PropertyPayload): Omit<Property, "id" | "createdAt"> {
  return {
    address: payload.address,
    suburb: payload.suburb,
    city: payload.city,
    weeklyRent: payload.weeklyRent,
    bedrooms: payload.bedrooms,
    bathrooms: payload.bathrooms,
    parking: payload.parking,
    status: payload.status,
    imageUrl: payload.imageUrl,
    requiredDocuments: payload.requiredDocuments as Property["requiredDocuments"],
  };
}
