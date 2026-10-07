import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useProfile } from "@/lib/account";
import { LockedNotice } from "@/components/LockedNotice";
import { getSurveyWallUrl } from "@/lib/surveys.functions";
import { DailyPoll } from "@/components/DailyPoll";

export const Route = createFileRoute("/_authenticated/surveys")({
  head: () => ({ meta: [{ title: "Paid surveys — Work Cash" }, { name: "description", content: "Complete live surveys and earn KSh." }] }),
  component: Surveys,
});

function Surveys() {
  const { data: p } = useProfile();
  const fn = useServerFn(getSurveyWallUrl);
  const { data, isLoading } = useQuery({ queryKey: ["survey-url"], queryFn: () => fn(), enabled: !!p?.is_activated });

  if (p && !p.is_activated) return <LockedNotice />;
  return (
    <div>
      <h1 className="text-3xl font-bold">Paid surveys</h1>
      <p className="text-muted-foreground">Complete a survey and your reward is added to your wallet automatically.</p>
      <div className="mt-6"><DailyPoll /></div>
      {isLoading ? <Loader2 className="mx-auto mt-10 h-8 w-8 animate-spin text-primary" /> : data?.url ? (
        <iframe src={data.url} title="Surveys" className="mt-6 h-[1600px] w-full rounded-2xl border bg-card" />
      ) : (
        <p className="mt-8 rounded-2xl border bg-card p-8 text-center text-muted-foreground">More partner surveys are being set up. Please check back soon.</p>
      )}
    </div>
  );
}
