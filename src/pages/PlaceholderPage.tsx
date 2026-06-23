import { PageHeader } from "@/components/PageHeader";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  breadcrumbs: { label: string; path?: string }[];
}

export default function PlaceholderPage({ title, breadcrumbs }: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} breadcrumbs={breadcrumbs} />
      <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <Construction className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">This module is coming soon. Data will be connected to the database.</p>
      </div>
    </div>
  );
}
