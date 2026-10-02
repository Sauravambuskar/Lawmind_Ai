import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import guideJudge from "@/assets/guide-judge.webp";

interface PageGuide {
  title: string;
  description: string;
  steps?: DriveStep[];
}

const PAGE_GUIDES: Array<{ match: (path: string) => boolean; guide: PageGuide }> = [
  {
    match: path => path === "/",
    guide: {
      title: "Practice Dashboard",
      description: "Review practice activity, clients, hearings and shortcuts from this overview.",
      steps: [
        { element: '[data-guide="dashboard-actions"]', popover: { title: "Quick creation", description: "Create a case, client or task directly from here." } },
        { element: '[data-guide="dashboard-stats"]', popover: { title: "Practice summary", description: "These cards show the latest case and client totals." } },
        { element: '[data-guide="dashboard-clients"]', popover: { title: "Client directory", description: "Open recent client records or move to the complete client list." } },
        { element: '[data-guide="dashboard-insights"]', popover: { title: "Insights and shortcuts", description: "Use charts to understand activity and Quick Access for common actions." } },
      ],
    },
  },
  {
    match: path => path === "/sarda-sir-dashboard" || path === "/task-dashboard",
    guide: {
      title: "Sarda Sir Dashboard",
      description: "Assign work, review ownership and monitor team completion from one admin view.",
      steps: [
        { element: '[data-guide="task-summary"]', popover: { title: "Work summary", description: "Open, assigned, completed, overdue and unassigned work is summarized here." } },
        { element: '[data-guide="task-progress-chart"]', popover: { title: "Team task progress", description: "Each cylinder shows a team member's overall task completion percentage." } },
        { element: '[data-guide="team-assignments"]', popover: { title: "Assignments by person", description: "Search and filter work, then assign or reassign tasks under each team member." } },
        { element: '[data-guide="task-attention"]', popover: { title: "Needs attention", description: "Overdue, unassigned and high-priority tasks appear here for quick follow-up." } },
      ],
    },
  },
  { match: path => path === "/tasks", guide: { title: "Tasks", description: "Create, assign, filter and update work from the task register." } },
  { match: path => path.startsWith("/cases/"), guide: { title: "Case Details", description: "Review the case record, linked work, hearings, documents and activity." } },
  { match: path => path === "/cases", guide: { title: "Cases", description: "Search, create and manage all legal matters from this workspace." } },
  { match: path => path === "/hearings", guide: { title: "Hearings", description: "Schedule hearings and manage court, judge, purpose and status details." } },
  { match: path => path === "/hearing-calendar", guide: { title: "Hearing Calendar", description: "Review upcoming hearing dates in a calendar-focused view." } },
  { match: path => path === "/clients", guide: { title: "Clients", description: "Create, search and manage client records and contact details." } },
  { match: path => path === "/advocates", guide: { title: "Advocates", description: "Maintain the advocate directory and related professional details." } },
  { match: path => path === "/documents" || path === "/impdocs", guide: { title: "Documents", description: "Store, find and manage practice documents securely." } },
  { match: path => path === "/invoices", guide: { title: "Invoices", description: "Review billing, payments, expenses and outstanding amounts." } },
  { match: path => path === "/ai-agent", guide: { title: "LawMind AI Agent", description: "Ask legal-practice questions and use AI assistance within your workspace." } },
  { match: path => path.startsWith("/setup/"), guide: { title: "Administration", description: "Configure master data, reports, permissions and system settings." } },
];

function getPageGuide(pathname: string): PageGuide {
  return PAGE_GUIDES.find(item => item.match(pathname))?.guide ?? {
    title: "Current Workspace",
    description: "Use this page to manage the selected area of your legal practice.",
  };
}

function availableSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter(step => {
    if (!step.element || typeof step.element !== "string") return true;
    const element = document.querySelector(step.element);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth;
  });
}

export function GuideButton() {
  const location = useLocation();
  const pageGuide = useMemo(() => getPageGuide(location.pathname), [location.pathname]);

  const openGuide = () => {
    const sharedSteps: DriveStep[] = [
      {
        popover: {
          title: `Welcome to ${pageGuide.title}`,
          description: `<div class="lawmind-guide-intro"><img src="${guideJudge}" alt="" /><p>${pageGuide.description}</p></div>`,
        },
      },
      { element: '[data-guide="header"]', popover: { title: "Top workspace", description: "Search globally, open AI, review notifications and access your profile here." } },
      { element: '[data-guide="global-search"]', popover: { title: "Global search", description: "Quickly find cases, clients and records without leaving the current page." } },
      { element: '[data-guide="sidebar"]', popover: { title: "Main navigation", description: "Move between cases, hearings, tasks, documents, billing and administration." } },
      { element: '[data-guide="page-content"]', popover: { title: pageGuide.title, description: pageGuide.description } },
      ...(pageGuide.steps ?? []),
      { element: '[data-guide="guide-button"]', popover: { title: "Guide is always available", description: "Use this corner button whenever you need guidance on the current page.", side: "left", align: "end" } },
    ];

    driver({
      animate: true,
      duration: 350,
      smoothScroll: true,
      allowClose: true,
      allowKeyboardControl: true,
      disableActiveInteraction: true,
      overlayColor: "#0f172a",
      overlayOpacity: 0.72,
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: "lawmind-guide-popover",
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      steps: availableSteps(sharedSteps),
    }).drive();
  };

  return (
    <button
      type="button"
      onClick={openGuide}
      data-guide="guide-button"
      aria-label={`Open guide for ${pageGuide.title}`}
      title="Open page guide"
      className="group fixed bottom-4 right-4 z-50 flex h-[60px] items-center gap-2 rounded-lg border border-amber-400/60 bg-[#172033] px-2.5 pr-4 text-white shadow-[0_10px_30px_rgba(15,23,42,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 md:bottom-6 md:right-6"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/95">
        <img src={guideJudge} alt="" className="h-12 w-12 object-contain transition-transform duration-200 group-hover:scale-105" />
      </span>
      <span className="hidden text-left sm:block">
        <span className="block text-[10px] font-semibold uppercase text-amber-300">Need help?</span>
        <span className="block text-sm font-bold leading-tight">Guide Me</span>
      </span>
    </button>
  );
}
