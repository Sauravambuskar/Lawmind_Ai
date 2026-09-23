import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { restGetAll } from "@/lib/restClient";
import { PageLoader } from "@/components/PageLoader";
import { InvoiceOverview } from "@/components/invoices/InvoiceOverview";
import { InvoiceList } from "@/components/invoices/InvoiceList";
import { PaymentsList } from "@/components/invoices/PaymentsList";
import { OverduesList } from "@/components/invoices/OverduesList";
import { ExpensesList } from "@/components/invoices/ExpensesList";

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => restGetAll("invoices?select=*,clients(name),cases(title)&order=created_at.desc"),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-lookup"],
    queryFn: () => restGetAll("clients?select=id,name&order=name.asc"),
  });

  // Lookup list only — a distinct key from the Cases page cache
  const { data: cases = [] } = useQuery({
    queryKey: ["cases-lookup"],
    queryFn: () => restGetAll("cases?select=id,title&order=created_at.desc"),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => restGetAll("expenses?select=*&order=expense_date.desc"),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: () =>
      restGetAll("payments?select=*,invoices(invoice_number,total_amount,clients(name))&order=payment_date.desc"),
  });

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Invoices & Billing" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Invoices & Billing" }]} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="overdues">Payment Overdues</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <InvoiceOverview invoices={invoices} expenses={expenses} payments={payments} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoiceList invoices={invoices} clients={clients} cases={cases} payments={payments} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsList invoices={invoices} payments={payments} />
        </TabsContent>

        <TabsContent value="overdues">
          <OverduesList invoices={invoices} />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpensesList expenses={expenses} cases={cases} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
