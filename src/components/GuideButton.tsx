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

const guideAudioId = (text: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const bilingual = (english: string, hindi: string) =>
  `<span class="lawmind-guide-english">${english}</span><span class="lawmind-guide-hindi" lang="hi" data-guide-audio="${guideAudioId(hindi)}">${hindi}</span>`;

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

function controlLabel(element: HTMLElement): string {
  const input = element as HTMLInputElement;
  return (
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    input.placeholder ||
    element.textContent ||
    ""
  ).replace(/\s+/g, " ").trim().slice(0, 80);
}

function explainControl(element: HTMLElement, label: string) {
  const normalized = label.toLowerCase();
  const safeLabel = label.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role");

  if (tag === "table") return {
    key: "records-table",
    title: "Records table",
    english: "Read each record across the row. Use the last column for actions such as view, edit or progress update.",
    hindi: "हर रिकॉर्ड को पंक्ति में पढ़ें। आखिरी कॉलम से देखें, बदलें या प्रगति अपडेट करें।",
  };
  if (role === "tab") return {
    key: `tab-${normalized}`,
    title: `${safeLabel} tab`,
    english: `Select ${safeLabel} to switch this workspace to that section without leaving the page.`,
    hindi: `${safeLabel} भाग देखने के लिए इस टैब को दबाएं; पेज छोड़े बिना जानकारी बदल जाएगी।`,
  };
  if (role === "combobox") return {
    key: `filter-${normalized}`,
    title: safeLabel || "Selection menu",
    english: "Open this menu and choose one option to narrow the list or set the required value.",
    hindi: "यह मेन्यू खोलकर एक विकल्प चुनें। इससे सूची फिल्टर होगी या जरूरी मान सेट होगा।",
  };
  if (tag === "input" || tag === "textarea") {
    const isSearch = normalized.includes("search") || (element as HTMLInputElement).type === "search";
    return isSearch ? {
      key: "page-search",
      title: "Search records",
      english: "Type a name, number or keyword here. The visible list updates to show matching records.",
      hindi: "यहां नाम, नंबर या शब्द लिखें। नीचे की सूची केवल मिलते हुए रिकॉर्ड दिखाएगी।",
    } : {
      key: `field-${normalized}`,
      title: safeLabel || "Information field",
      english: "Enter the requested information here. Check the value before saving the form.",
      hindi: "यहां मांगी गई जानकारी भरें। फॉर्म सेव करने से पहले जानकारी जांच लें।",
    };
  }
  if (normalized.includes("export") || normalized.includes("download")) return {
    key: "export-action",
    title: safeLabel || "Export records",
    english: "Download the currently available records for reporting or offline review.",
    hindi: "रिपोर्ट या बाद में जांच के लिए मौजूदा रिकॉर्ड डाउनलोड करें।",
  };
  if (/new|add|create/.test(normalized)) return {
    key: "create-action",
    title: safeLabel || "Create new record",
    english: "Open the entry form, complete the required fields and use Save to create the record.",
    hindi: "नया फॉर्म खोलें, जरूरी जानकारी भरें और Save दबाकर रिकॉर्ड बनाएं।",
  };
  if (normalized.includes("progress")) return {
    key: "progress-action",
    title: safeLabel || "Update progress",
    english: "Record how much work is complete and add the latest work update for the assigned task.",
    hindi: "सौंपे गए काम की पूर्णता और नया कार्य अपडेट यहां दर्ज करें।",
  };
  if (normalized.includes("edit")) return {
    key: "edit-action",
    title: safeLabel || "Edit record",
    english: "Open the selected record for correction or update, then save the changes.",
    hindi: "चुने हुए रिकॉर्ड को सुधारने या अपडेट करने के लिए खोलें, फिर बदलाव सेव करें।",
  };
  if (normalized.includes("view") || normalized.includes("open")) return {
    key: "view-action",
    title: safeLabel || "Open details",
    english: "Open the selected record to review its complete details and linked activity.",
    hindi: "चुने हुए रिकॉर्ड की पूरी जानकारी और संबंधित गतिविधि देखने के लिए खोलें।",
  };
  if (/previous|next|page/.test(normalized)) return {
    key: "page-navigation",
    title: "List pages",
    english: "Move through additional result pages when all records do not fit in the current list.",
    hindi: "जब सभी रिकॉर्ड एक सूची में न दिखें, तो अगले या पिछले पेज पर जाएं।",
  };
  return {
    key: `action-${normalized}`,
    title: safeLabel || "Page action",
    english: `Use ${safeLabel || "this control"} to perform the indicated action on this page.`,
    hindi: `इस पेज पर बताया गया काम करने के लिए ${safeLabel || "इस नियंत्रण"} का उपयोग करें।`,
  };
}

function microGuideSteps(): DriveStep[] {
  const page = document.querySelector<HTMLElement>('[data-guide="page-content"]');
  if (!page) return [];

  const candidates = Array.from(page.querySelectorAll<HTMLElement>(
    'input, textarea, button, [role="combobox"], [role="tab"], table, nav[aria-label="pagination"]',
  ));
  const seen = new Set<string>();
  const steps: DriveStep[] = [];

  for (const element of candidates) {
    if (element.closest('[data-guide="guide-button"]') || element.disabled || element.getAttribute("aria-hidden") === "true") continue;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (rect.width < 12 || rect.height < 12 || style.display === "none" || style.visibility === "hidden") continue;

    const label = controlLabel(element);
    if (!label && element.tagName.toLowerCase() !== "table") continue;
    const explanation = explainControl(element, label);
    if (seen.has(explanation.key)) continue;
    seen.add(explanation.key);
    steps.push({
      element,
      popover: {
        title: explanation.title,
        description: bilingual(explanation.english, explanation.hindi),
      },
    });
    if (steps.length >= 18) break;
  }

  return steps;
}

export function GuideButton() {
  const location = useLocation();
  const pageGuide = useMemo(() => getPageGuide(location.pathname), [location.pathname]);

  const openGuide = () => {
    const speechAvailable = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    let voiceEnabled = localStorage.getItem("lawmind-guide-voice") !== "off";
    let selectedHindiVoice: SpeechSynthesisVoice | undefined;
    let activeAudio: HTMLAudioElement | undefined;
    let usingNaturalAudio = false;
    let speechSession = 0;
    let speechProgress = "";
    const missingAudio = new Set<string>();

    const selectBestHindiVoice = () => {
      if (!speechAvailable) return undefined;
      const voices = window.speechSynthesis.getVoices();
      const hindiVoices = voices.filter(voice => voice.lang.toLowerCase().startsWith("hi"));
      const preferredNames: Array<[string, number]> = [
        ["swara", 1000],
        ["madhur", 950],
        ["google हिन्दी", 925],
        ["google hindi", 925],
        ["heera", 875],
        ["lekha", 850],
        ["kalpana", 825],
        ["hemant", 800],
      ];

      return hindiVoices
        .map(voice => {
          const name = voice.name.toLowerCase();
          const preferred = preferredNames.find(([candidate]) => name.includes(candidate))?.[1] ?? 0;
          const natural = name.includes("natural") || name.includes("online") ? 180 : 0;
          const exactLocale = voice.lang.toLowerCase() === "hi-in" ? 100 : 0;
          return { voice, score: preferred + natural + exactLocale };
        })
        .sort((a, b) => b.score - a.score)[0]?.voice;
    };

    const refreshHindiVoice = () => {
      selectedHindiVoice = selectBestHindiVoice();
      updateVoiceControls();
    };

    const narrationForStep = (step?: DriveStep) => {
      const source = step?.popover?.description;
      if (!source) return { text: "", audioId: "" };
      const content = document.createElement("div");
      content.innerHTML = source;
      const hindi = content.querySelector<HTMLElement>(".lawmind-guide-hindi");
      return {
        text: hindi?.textContent?.trim() || content.textContent?.trim() || "",
        audioId: hindi?.dataset.guideAudio || "",
      };
    };

    const narrationChunks = (text: string) => {
      const sentences = text.match(/[^।.!?]+[।.!?]?/g)?.map(sentence => sentence.trim()).filter(Boolean) ?? [text];
      const chunks: string[] = [];
      sentences.forEach(sentence => {
        let remaining = sentence;
        while (remaining.length > 110) {
          const searchFrom = Math.min(110, remaining.length - 1);
          const commaBreak = Math.max(remaining.lastIndexOf(",", searchFrom), remaining.lastIndexOf("،", searchFrom));
          const spaceBreak = remaining.lastIndexOf(" ", searchFrom);
          const breakAt = commaBreak >= 55 ? commaBreak + 1 : spaceBreak >= 55 ? spaceBreak : 110;
          chunks.push(remaining.slice(0, breakAt).trim());
          remaining = remaining.slice(breakAt).trim();
        }
        if (remaining) chunks.push(remaining);
      });
      return chunks;
    };

    const updateVoiceControls = () => {
      document.querySelectorAll<HTMLElement>(".lawmind-guide-voice-toggle").forEach(button => {
        button.textContent = voiceEnabled ? "Voice: On" : "Voice: Off";
        button.dataset.active = String(voiceEnabled);
      });
      document.querySelectorAll<HTMLElement>(".lawmind-guide-voice-pause").forEach(button => {
        const paused = activeAudio ? activeAudio.paused && activeAudio.currentTime > 0 : window.speechSynthesis?.paused;
        button.textContent = paused ? "Resume" : "Pause";
      });
      document.querySelectorAll<HTMLElement>(".lawmind-guide-voice-status").forEach(status => {
        const voiceName = selectedHindiVoice?.name || "device Hindi voice";
        const source = usingNaturalAudio ? "Natural Hindi: Swara" : `Hindi fallback: ${voiceName}`;
        status.textContent = voiceEnabled ? `${source}${speechProgress}` : "Voice guidance is off";
      });
    };

    const stopNarration = () => {
      speechSession += 1;
      speechProgress = "";
      usingNaturalAudio = false;
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.removeAttribute("src");
        activeAudio.load();
        activeAudio = undefined;
      }
      if (speechAvailable) window.speechSynthesis.cancel();
      updateVoiceControls();
    };

    const speakWithDeviceVoice = (narration: string, session: number) => {
      if (!speechAvailable || session !== speechSession || !voiceEnabled) return;
      const chunks = narrationChunks(narration);
      window.speechSynthesis.cancel();
      selectedHindiVoice ??= selectBestHindiVoice();
      usingNaturalAudio = false;

      const speakChunk = (index: number) => {
        if (session !== speechSession || !voiceEnabled) return;
        if (index >= chunks.length) {
          speechProgress = " - completed";
          updateVoiceControls();
          return;
        }

        speechProgress = chunks.length > 1 ? ` - speaking ${index + 1}/${chunks.length}` : " - speaking";
        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = "hi-IN";
        utterance.rate = 0.9;
        utterance.pitch = 1.02;
        utterance.volume = 1;
        if (selectedHindiVoice) utterance.voice = selectedHindiVoice;
        utterance.onstart = updateVoiceControls;
        utterance.onend = () => speakChunk(index + 1);
        utterance.onerror = event => {
          if (session !== speechSession) return;
          if (event.error !== "canceled" && event.error !== "interrupted") speakChunk(index + 1);
        };
        window.speechSynthesis.speak(utterance);
        updateVoiceControls();
      };

      speakChunk(0);
    };

    const speakStep = (step?: DriveStep) => {
      if (!voiceEnabled) return;
      const narration = narrationForStep(step);
      if (!narration.text) return;

      stopNarration();
      const session = ++speechSession;
      if (!narration.audioId || missingAudio.has(narration.audioId)) {
        speakWithDeviceVoice(narration.text, session);
        return;
      }

      const audio = new Audio(`/audio/guide/${narration.audioId}.mp3`);
      let fallbackStarted = false;
      const useFallback = () => {
        if (fallbackStarted || session !== speechSession) return;
        fallbackStarted = true;
        activeAudio = undefined;
        speakWithDeviceVoice(narration.text, session);
      };
      activeAudio = audio;
      audio.preload = "auto";
      audio.onplay = () => {
        if (session !== speechSession) return;
        usingNaturalAudio = true;
        speechProgress = " - speaking";
        updateVoiceControls();
      };
      audio.onended = () => {
        if (session !== speechSession) return;
        activeAudio = undefined;
        speechProgress = " - completed";
        updateVoiceControls();
      };
      audio.onerror = () => {
        if (session !== speechSession) return;
        missingAudio.add(narration.audioId);
        useFallback();
      };
      void audio.play().catch(useFallback);
    };

    if (speechAvailable) {
      selectedHindiVoice = selectBestHindiVoice();
      window.speechSynthesis.addEventListener("voiceschanged", refreshHindiVoice);
    }

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
      ...microGuideSteps(),
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
      onPopoverRender: (popover, { driver: guideDriver }) => {
        const controls = document.createElement("div");
        controls.className = "lawmind-guide-voice-controls";
        controls.innerHTML = `
          <button type="button" class="lawmind-guide-voice-toggle" aria-label="Turn voice guidance on or off"></button>
          <button type="button" class="lawmind-guide-voice-pause" aria-label="Pause or resume voice guidance">Pause</button>
          <button type="button" class="lawmind-guide-voice-replay" aria-label="Replay this guidance">Replay</button>
          <span class="lawmind-guide-voice-status" aria-live="polite"></span>
        `;
        controls.querySelector<HTMLButtonElement>(".lawmind-guide-voice-toggle")?.addEventListener("click", () => {
          voiceEnabled = !voiceEnabled;
          localStorage.setItem("lawmind-guide-voice", voiceEnabled ? "on" : "off");
          if (voiceEnabled) speakStep(guideDriver.getActiveStep());
          else stopNarration();
          updateVoiceControls();
        });
        controls.querySelector<HTMLButtonElement>(".lawmind-guide-voice-pause")?.addEventListener("click", () => {
          if (!voiceEnabled) return;
          if (activeAudio) {
            if (activeAudio.paused) void activeAudio.play();
            else activeAudio.pause();
          } else if (speechAvailable && window.speechSynthesis.paused) window.speechSynthesis.resume();
          else if (speechAvailable && window.speechSynthesis.speaking) window.speechSynthesis.pause();
          else speakStep(guideDriver.getActiveStep());
          updateVoiceControls();
        });
        controls.querySelector<HTMLButtonElement>(".lawmind-guide-voice-replay")?.addEventListener("click", () => {
          speakStep(guideDriver.getActiveStep());
        });
        popover.description.appendChild(controls);
        updateVoiceControls();
      },
      onHighlighted: (_element, step) => speakStep(step),
      onDeselected: stopNarration,
      onDestroyed: () => {
        stopNarration();
        if (speechAvailable) window.speechSynthesis.removeEventListener("voiceschanged", refreshHindiVoice);
      },
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
