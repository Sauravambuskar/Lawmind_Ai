import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/AuthContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { PageLoader } from "@/components/PageLoader";

// Lazy-load every page so each route is a separate JS chunk.
// This cuts the initial bundle size significantly.
const Dashboard         = lazy(() => import("./pages/Dashboard"));
const UsersPage         = lazy(() => import("./pages/UsersPage"));
const ClientsPage       = lazy(() => import("./pages/ClientsPage"));
const ClientDetailPage  = lazy(() => import("./pages/ClientDetailPage"));
const AdvocatesPage     = lazy(() => import("./pages/AdvocatesPage"));
const AdvocateDetailPage = lazy(() => import("./pages/AdvocateDetailPage"));
const AdvicePage        = lazy(() => import("./pages/AdvicePage"));
const CasesPage         = lazy(() => import("./pages/CasesPage"));
const CaseDetailPage    = lazy(() => import("./pages/CaseDetailPage"));
const HearingsPage      = lazy(() => import("./pages/HearingsPage"));
const EvidencePage      = lazy(() => import("./pages/EvidencePage"));
const InvoicesPage      = lazy(() => import("./pages/InvoicesPage"));
const DocumentsPage     = lazy(() => import("./pages/DocumentsPage"));
const ExpensesPage      = lazy(() => import("./pages/ExpensesPage"));
const ContactsPage      = lazy(() => import("./pages/ContactsPage"));
const NotesPage         = lazy(() => import("./pages/NotesPage"));
const MattersPage       = lazy(() => import("./pages/MattersPage"));
const TagsPage          = lazy(() => import("./pages/TagsPage"));
const ExpenseTypesPage  = lazy(() => import("./pages/ExpenseTypesPage"));
const CaseTemplatesPage = lazy(() => import("./pages/CaseTemplatesPage"));
const ReportsPage       = lazy(() => import("./pages/ReportsPage"));
const AuditLogsPage     = lazy(() => import("./pages/AuditLogsPage"));
const ProfilePage       = lazy(() => import("./pages/ProfilePage"));
const AuthPage          = lazy(() => import("./pages/AuthPage"));
const AIAgentPage       = lazy(() => import("./pages/AIAgentPage"));
const AISettingsPage    = lazy(() => import("./pages/AISettingsPage"));
const TasksPage         = lazy(() => import("./pages/TasksPage"));
const TodayPage         = lazy(() => import("./pages/TodayPage"));
const ImpDocsPage      = lazy(() => import("./pages/ImpDocsPage"));
const NoticeMakerPage   = lazy(() => import("./pages/NoticeMakerPage"));
const QuickDocsPage     = lazy(() => import("./pages/QuickDocsPage"));
const NotFound          = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,      // 2 min before refetch
      retry: 1,
    },
  },
});

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<AuthPage />} />
                <Route
                  element={
                     <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/"                    element={<Dashboard />} />
                  <Route path="/staff/users"         element={<UsersPage />} />
                  <Route path="/clients"             element={<ClientsPage />} />
                  <Route path="/clients/:id"         element={<ClientDetailPage />} />
                  <Route path="/advocates"           element={<AdvocatesPage />} />
                  <Route path="/advocates/:id"       element={<AdvocateDetailPage />} />
                  <Route path="/advice"              element={<AdvicePage />} />
                  <Route path="/cases"               element={<CasesPage />} />
                  <Route path="/cases/:id"           element={<CaseDetailPage />} />
                  <Route path="/hearings"            element={<HearingsPage />} />
                  <Route path="/evidence"            element={<EvidencePage />} />
                  <Route path="/invoices"            element={<InvoicesPage />} />
                  <Route path="/documents"           element={<DocumentsPage />} />
                  <Route path="/impdocs"             element={<ImpDocsPage />} />
                  <Route path="/notice-maker"        element={<NoticeMakerPage />} />
                  <Route path="/quick-docs"          element={<QuickDocsPage />} />
                  <Route path="/expenses"            element={<ExpensesPage />} />
                  <Route path="/contacts"            element={<ContactsPage />} />
                  <Route path="/notes"               element={<NotesPage />} />
                  <Route path="/setup/matters"       element={<MattersPage />} />
                  <Route path="/setup/tags"          element={<TagsPage />} />
                  <Route path="/setup/expense-types" element={<ExpenseTypesPage />} />
                  <Route path="/setup/templates"     element={<CaseTemplatesPage />} />
                  <Route path="/setup/reports"       element={<ReportsPage />} />
                  <Route path="/setup/logs"          element={<AuditLogsPage />} />
                  <Route path="/setup/ai-settings"   element={<AISettingsPage />} />
                  <Route path="/ai-agent"            element={<AIAgentPage />} />
                  <Route path="/tasks"               element={<TasksPage />} />
                  <Route path="/today"               element={<TodayPage />} />
                  <Route path="/profile"             element={<ProfilePage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
