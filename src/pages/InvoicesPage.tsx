import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
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
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, clients(name), cases(title)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => { const { data } = await supabase.from("clients").select("id, name"); return data || []; },
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => { const { data } = await supabase.from("cases").select("id, title"); return data || []; },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*, invoices(invoice_number, total, clients(name))").order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
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
