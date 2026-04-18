import { Link } from "react-router-dom";
import { Bath, BedDouble, Bookmark, Car, MapPin, Users } from "lucide-react";
import type { Property } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PropertyCardProps {
  property: Property;
  applicantCount: number;
  topScore?: number;
  shortlistedCount?: number;
}

const statusStyles: Record<Property["status"], string> = {
  active: "bg-tier-good-soft text-tier-good",
  leased: "bg-secondary text-muted-foreground",
  draft: "bg-tier-average-soft text-tier-average",
};

export const PropertyCard = ({ property, applicantCount, topScore, shortlistedCount = 0 }: PropertyCardProps) => (
  <Link
    to={`/dashboard/properties/${property.id}`}
    className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
  >
    <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
      <img
        src={property.imageUrl}
        alt={`${property.address}, ${property.suburb}`}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute left-3 top-3 flex gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", statusStyles[property.status])}>
          {property.status}
        </span>
        {shortlistedCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground shadow-sm">
            <Bookmark className="h-3 w-3" fill="currentColor" />
            {shortlistedCount} shortlisted
          </span>
        )}
      </div>
      <div className="absolute bottom-3 right-3 rounded-lg bg-background/95 px-3 py-1.5 text-sm font-bold text-foreground shadow-sm backdrop-blur">
        ${property.weeklyRent}
        <span className="text-xs font-medium text-muted-foreground"> /wk</span>
      </div>
    </div>

    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">{property.address}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {property.suburb}, {property.city}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <BedDouble className="h-4 w-4" />
          {property.bedrooms}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Bath className="h-4 w-4" />
          {property.bathrooms}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Car className="h-4 w-4" />
          {property.parking}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {applicantCount} applicant{applicantCount === 1 ? "" : "s"}
        </span>
        {topScore !== undefined && (
          <span className="text-xs font-medium text-muted-foreground">
            Top score <span className="font-bold text-foreground">{topScore}</span>
          </span>
        )}
      </div>
    </div>
  </Link>
);
