import { Gauge } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Section, Segmented, ToggleRow } from "../shared";
import { TrayRow } from "../tray-row";
import { DownloadsSection } from "../player-panel";
import { DesktopOnlyBlock, isTauri } from "../player-panel/internals";

type GfxBackend = "auto" | "d3d11" | "opengl" | "vulkan" | "software";

export function SystemTab() {
  const t = useT();
  const { settings, update } = useSettings();
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");
  return (
    <>
      <Section
        title={t("Downloads")}
        subtitle={t(
          "Choose where videos and eBooks are saved, and how their folders are organized.",
        )}
      >
        {isTauri ? (
          <DownloadsSection />
        ) : (
          <div data-tv-skip="">
            <DesktopOnlyBlock>
              <DownloadsSection />
            </DesktopOnlyBlock>
          </div>
        )}
      </Section>

      <PerformanceControls />
      {isTauri && (
        <Section
          title={t("Window behavior")}
          subtitle={t("Choose what happens when you close, minimize, or switch away from Harbor.")}
        >
          <TrayRow />
        </Section>
      )}
      {isTauri && isWindows && (
        <Section
          title={t("Graphics")}
          subtitle={t(
            "Leave this on Automatic unless Harbor's interface flickers or stutters. This controls the app window, not video playback.",
          )}
        >
          <Segmented<GfxBackend>
            value={settings.uiGraphicsBackend}
            options={[
              { value: "auto", label: t("Automatic") },
              { value: "d3d11", label: t("Direct3D") },
              { value: "opengl", label: t("OpenGL") },
              { value: "vulkan", label: t("Vulkan") },
              { value: "software", label: t("Software") },
            ]}
            onChange={(uiGraphicsBackend) => update({ uiGraphicsBackend })}
            label={t("Rendering backend")}
            sub={t("Takes effect the next time Harbor starts.")}
          />
        </Section>
      )}
    </>
  );
}

function PerformanceControls() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <Section
      title={t("Performance & resource use")}
      subtitle={t(
        "Choose whether Harbor favours the lightest idle footprint or warms up common pages and keeps optional automation active while hidden.",
      )}
    >
      <ToggleRow
        leading={<Gauge size={17} strokeWidth={2} />}
        label={t("Warm up common pages after launch")}
        sub={t(
          "Preloads the player, source picker, details, and Settings when the app is idle. Leave this off for lower startup memory and battery use.",
        )}
        value={settings.preloadViews}
        onChange={(preloadViews) => update({ preloadViews })}
      />
      <ToggleRow
        leading={<Gauge size={17} strokeWidth={2} />}
        label={t("Allow optional background checks")}
        sub={t(
          "Lets scheduled downloads and release webhooks check for updates while Harbor is hidden. Turn it off to keep background network activity to a minimum.",
        )}
        value={settings.backgroundNetworkActivity}
        onChange={(backgroundNetworkActivity) => update({ backgroundNetworkActivity })}
      />
    </Section>
  );
}
