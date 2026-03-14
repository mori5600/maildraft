import { useEffect, useState } from "react";

import { FALLBACK_APP_INFO, loadAppInfo } from "../../../shared/lib/app-info";
import type { HelpSection } from "../model";
import { HelpSectionNav } from "./panes/HelpSectionNav";
import { ShortcutGuide } from "./panes/ShortcutGuide";
import { UsageGuide } from "./panes/UsageGuide";

export function HelpWorkspace() {
  const [activeSection, setActiveSection] = useState<HelpSection>("usage");
  const [appInfo, setAppInfo] = useState(FALLBACK_APP_INFO);

  useEffect(() => {
    let isMounted = true;

    void loadAppInfo().then((nextAppInfo) => {
      if (isMounted) {
        setAppInfo(nextAppInfo);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="grid h-full min-h-0 gap-3 overflow-y-auto pr-1 lg:grid-cols-[188px_minmax(0,1fr)] lg:overflow-hidden lg:pr-0">
      <HelpSectionNav
        activeSection={activeSection}
        appInfo={appInfo}
        onSelectSection={setActiveSection}
      />

      <div className="min-h-0 overflow-y-auto">
        {activeSection === "usage" ? <UsageGuide /> : <ShortcutGuide />}
      </div>
    </div>
  );
}
