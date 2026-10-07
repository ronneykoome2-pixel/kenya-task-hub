import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, PlayCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProfile, ksh } from "@/lib/account";
import { LockedNotice } from "@/components/LockedNotice";

export const Route = createFileRoute("/_authenticated/videos")({
  head: () => ({ meta: [{ title: "Watch & earn — Work Cash" }, { name: "description", content: "Watch ad videos and earn KSh." }] }),
  component: Videos,
});

function ytId(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

type Video = { id: string; title: string; youtube_url: string; reward: number; duration_seconds: number };

function Videos() {
  const { data: p } = useProfile();
  const [open, setOpen] = useState<Video | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["videos"],
    enabled: !!p?.is_activated,
    queryFn: async () => {
      const [{ data: v }, { data: w }] = await Promise.all([
        supabase.from("videos").select("*").eq("active", true).order("created_at", { ascending: false }),
        supabase.from("video_views").select("video_id"),
      ]);
      const watched = new Set((w ?? []).map((x) => x.video_id));
      return { videos: ((v ?? []) as Video[]).filter((x) => !watched.has(x.id)), watched };
    },
  });

  if (p && !p.is_activated) return <LockedNotice />;
  return (
    <div>
      <h1 className="text-3xl font-bold">Watch & earn</h1>
      <p className="text-muted-foreground">Watch each video to the end, then claim your reward.</p>
      {isLoading ? <Loader2 className="mx-auto mt-10 h-8 w-8 animate-spin text-primary" /> : !data?.videos.length ? (
        <p className="mt-8 rounded-2xl border bg-card p-8 text-center text-muted-foreground">No videos right now. Check back soon!</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.videos.map((v) => {
            const id = ytId(v.youtube_url);
            const done = data.watched.has(v.id);
            return (
              <div key={v.id} className="overflow-hidden rounded-2xl border bg-card">
                <div className="relative aspect-video bg-muted">
                  {id && <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={v.title} className="h-full w-full object-cover" />}
                  <span className="absolute right-2 top-2 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-gold-foreground">+{ksh(v.reward)}</span>
                </div>
                <div className="p-4">
                  <p className="font-semibold">{v.title}</p>
                  <Button className="mt-3 w-full" variant={done ? "secondary" : "default"} disabled={done} onClick={() => setOpen(v)}>
                    {done ? <><CheckCircle2 className="mr-2 h-4 w-4" />Earned</> : <><PlayCircle className="mr-2 h-4 w-4" />Watch ({v.duration_seconds}s)</>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {open && <Player video={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Player({ video, onClose }: { video: Video; onClose: () => void }) {
  const [left, setLeft] = useState(video.duration_seconds);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setLeft((l) => Math.max(0, l - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const id = ytId(video.youtube_url);

  async function claim() {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_video_reward", { _video: video.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`You earned ${ksh(data ?? 0)}!`);
    qc.invalidateQueries();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{video.title}</DialogTitle></DialogHeader>
        <div className="aspect-video overflow-hidden rounded-xl bg-ink">
          {id ? <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`} allow="autoplay; encrypted-media" allowFullScreen title={video.title} /> : <p className="p-6 text-ink-foreground">Invalid video link</p>}
        </div>
        <Button className="h-11" disabled={left > 0 || busy} onClick={claim}>
          {left > 0 ? `Keep watching… ${left}s` : `Claim ${ksh(video.reward)}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
