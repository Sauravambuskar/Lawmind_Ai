import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import guideJudge from "@/assets/guide-judge.webp";

interface PageGuide {
  title: string;
  description: string;
  hindiDescription: string;
  steps?: DriveStep[];
}

const bilingual = (english: string, hindi: string) =>
  `<span class="lawmind-guide-english">${english}</span><span class="lawmind-guide-hindi" lang="hi">${hindi}</span>`;

const PAGE_GUIDES: Array<{ match: (path: string) => boolean; guide: PageGuide }> = [
  {
    match: path => path === "/",
    guide: {
      title: "Practice Dashboard",
      description: "Review practice activity, clients, hearings and shortcuts from this overview.",
      hindiDescription: "यहां से काम, क्लाइंट, सुनवाई और जरूरी शॉर्टकट एक साथ देखें।",
      steps: [
        { element: '[data-guide="dashboard-actions"]', popover: { title: "Quick creation", description: bilingual("Create a case, client or task directly from here.", "यहां से नया केस, क्लाइंट या काम तुरंत बनाएं।") } },
        { element: '[data-guide="dashboard-stats"]', popover: { title: "Practice summary", description: bilingual("These cards show the latest case and client totals.", "इन कार्ड में केस और क्लाइंट की ताजा संख्या दिखती है।") } },
        { element: '[data-guide="dashboard-clients"]', popover: { title: "Client directory", description: bilingual("Open recent client records or move to the complete client list.", "हाल के क्लाइंट खोलें या पूरी क्लाइंट सूची देखें।") } },
        { element: '[data-guide="dashboard-insights"]', popover: { title: "Insights and shortcuts", description: bilingual("Use charts to understand activity and Quick Access for common actions.", "चार्ट से काम समझें और जरूरी कार्यों के लिए Quick Access उपयोग करें।") } },
      ],
    },
  },
  {
    match: path => path === "/sarda-sir-dashboard" || path === "/task-dashboard",
    guide: {
      title: "Sarda Sir Dashboard",
      description: "Assign work, review ownership and monitor team completion from one admin view.",
      hindiDescription: "एक ही जगह से काम सौंपें, जिम्मेदारी देखें और टीम की प्रगति जांचें।",
      steps: [
        { element: '[data-guide="task-summary"]', popover: { title: "Work summary", description: bilingual("Open, assigned, completed, overdue and unassigned work is summarized here.", "खुले, सौंपे गए, पूरे, लेट और बिना जिम्मेदार व्यक्ति वाले काम यहां देखें।") } },
        { element: '[data-guide="task-progress-chart"]', popover: { title: "Team task progress", description: bilingual("Each cylinder shows a team member's overall task completion percentage.", "हर सिलेंडर टीम सदस्य के पूरे किए गए काम का प्रतिशत दिखाता है।") } },
        { element: '[data-guide="team-assignments"]', popover: { title: "Assignments by person", description: bilingual("Search and filter work, then assign or reassign tasks under each team member.", "काम खोजें या फिल्टर करें, फिर सही व्यक्ति को काम सौंपें या दोबारा सौंपें।") } },
        { element: '[data-guide="task-attention"]', popover: { title: "Needs attention", description: bilingual("Overdue, unassigned and high-priority tasks appear here for quick follow-up.", "लेट, बिना असाइन और जरूरी काम यहां तुरंत फॉलो-अप के लिए दिखते हैं।") } },
      ],
    },
  },
  { match: path => path === "/tasks", guide: { title: "Tasks", description: "Create, assign, filter and update work from the task register.", hindiDescription: "काम बनाएं, सौंपें, फिल्टर करें और उसकी स्थिति अपडेट करें।" } },
  { match: path => path.startsWith("/cases/"), guide: { title: "Case Details", description: "Review the case record, linked work, hearings, documents and activity.", hindiDescription: "केस रिकॉर्ड, संबंधित काम, सुनवाई, दस्तावेज और गतिविधि देखें।" } },
  { match: path => path === "/cases", guide: { title: "Cases", description: "Search, create and manage all legal matters from this workspace.", hindiDescription: "यहां से सभी केस खोजें, बनाएं और संभालें।" } },
  { match: path => path === "/hearings", guide: { title: "Hearings", description: "Schedule hearings and manage court, judge, purpose and status details.", hindiDescription: "सुनवाई तय करें और कोर्ट, जज, उद्देश्य व स्थिति की जानकारी संभालें।" } },
  { match: path => path === "/hearing-calendar", guide: { title: "Hearing Calendar", description: "Review upcoming hearing dates in a calendar-focused view.", hindiDescription: "आने वाली सुनवाई की तारीखें कैलेंडर में देखें।" } },
  { match: path => path === "/clients", guide: { title: "Clients", description: "Create, search and manage client records and contact details.", hindiDescription: "क्लाइंट रिकॉर्ड और संपर्क जानकारी बनाएं, खोजें और संभालें।" } },
  { match: path => path === "/advocates", guide: { title: "Advocates", description: "Maintain the advocate directory and related professional details.", hindiDescription: "अधिवक्ता सूची और उनकी पेशेवर जानकारी संभालें।" } },
  { match: path => path === "/documents" || path === "/impdocs", guide: { title: "Documents", description: "Store, find and manage practice documents securely.", hindiDescription: "जरूरी दस्तावेज सुरक्षित रखें, खोजें और संभालें।" } },
  { match: path => path === "/invoices", guide: { title: "Invoices", description: "Review billing, payments, expenses and outstanding amounts.", hindiDescription: "बिल, भुगतान, खर्च और बाकी रकम की जानकारी देखें।" } },
  { match: path => path === "/ai-agent", guide: { title: "LawMind AI Agent", description: "Ask legal-practice questions and use AI assistance within your workspace.", hindiDescription: "कानूनी काम से जुड़े सवाल पूछें और AI सहायता लें।" } },
  { match: path => path.startsWith("/setup/"), guide: { title: "Administration", description: "Configure master data, reports, permissions and system settings.", hindiDescription: "मास्टर डेटा, रिपोर्ट, अनुमति और सिस्टम सेटिंग यहां बदलें।" } },
];

function getPageGuide(pathname: string): PageGuide {
  return PAGE_GUIDES.find(item => item.match(pathname))?.guide ?? {
    title: "Current Workspace",
    description: "Use this page to manage the selected area of your legal practice.",
    hindiDescription: "अपनी कानूनी प्रैक्टिस के इस भाग को यहां से संभालें।",
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
          description: `<div class="lawmind-guide-intro"><img src="${guideJudge}" alt="" /><div>${bilingual(pageGuide.description, pageGuide.hindiDescription)}</div></div>`,
        },
      },
      { element: '[data-guide="header"]', popover: { title: "Top workspace", description: bilingual("Search globally, open AI, review notifications and access your profile here.", "यहां से पूरे सॉफ्टवेयर में खोजें, AI खोलें, सूचनाएं और प्रोफाइल देखें।") } },
      { element: '[data-guide="global-search"]', popover: { title: "Global search", description: bilingual("Quickly find cases, clients and records without leaving the current page.", "यह पेज छोड़े बिना केस, क्लाइंट और रिकॉर्ड जल्दी खोजें।") } },
      { element: '[data-guide="sidebar"]', popover: { title: "Main navigation", description: bilingual("Move between cases, hearings, tasks, documents, billing and administration.", "केस, सुनवाई, काम, दस्तावेज, बिलिंग और सेटिंग में जाने के लिए इसका उपयोग करें।") } },
      { element: '[data-guide="page-content"]', popover: { title: pageGuide.title, description: bilingual(pageGuide.description, pageGuide.hindiDescription) } },
      ...(pageGuide.steps ?? []),
      { element: '[data-guide="guide-button"]', popover: { title: "Guide is always available", description: bilingual("Use this corner button whenever you need guidance on the current page.", "इस पेज पर मदद चाहिए तो कोने में यह Guide बटन कभी भी दबाएं।"), side: "left", align: "end" } },
    ];

    driver({
      animate: true,
      duration: 700,
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
      nextBtnText: "Next / आगे",
      prevBtnText: "Back / पीछे",
      doneBtnText: "Done / पूर्ण",
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
      className="group fixed bottom-4 right-4 z-50 flex h-[78px] items-center gap-3 rounded-lg border border-amber-400/60 bg-[#172033] px-2.5 pr-4 text-white shadow-[0_12px_34px_rgba(15,23,42,0.32)] transition-all duration-500 hover:-translate-y-1 hover:bg-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 md:bottom-6 md:right-6"
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/95">
        <img src={guideJudge} alt="" className="lawmind-guide-mascot h-16 w-16 object-contain transition-transform duration-700 group-hover:scale-110" />
      </span>
      <span className="hidden text-left sm:block">
        <span className="block text-[10px] font-semibold uppercase text-amber-300">Need help?</span>
        <span className="block text-base font-bold leading-tight">Guide Me</span>
        <span className="mt-0.5 block text-[11px] font-medium leading-tight text-slate-200" lang="hi">मार्गदर्शन लें</span>
      </span>
    </button>
  );
}
