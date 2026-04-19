import { PropertyDetailPage } from "@/components/pages/property-detail-page";

type Props = {
  params: { propertyId: string };
};

export default function Page({ params }: Props) {
  return <PropertyDetailPage propertyId={params.propertyId} />;
}
