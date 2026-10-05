import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile, ksh } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Work Cash" }, { name: "description", content: "Work Cash admin panel." }] }),
  component: Admin,
});

function Admin() {
  const { data: p, isLoading } = useProfile();
  if (isLoading) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin" />;
  if (!p?.isAdmin) return <p className="text-center text-muted-foreground">You don't have access to this page.</p>;
  return (
    <div>
      <h1 className="text-3xl font-bold">Admin</h1>
      <Stats />
      <Tabs defaultValue="act" className="mt-6">
        <TabsList><TabsTrigger value="act">Activations</TabsTrigger><TabsTrigger value="wd">Withdrawals</TabsTrigger><TabsTrigger value="vid">Videos</TabsTrigger><TabsTrigger value="users">Users</TabsTrigger></TabsList>
        <TabsContent value="act"><Activations /></TabsContent>
        <TabsContent value="wd"><Withdrawals /></TabsContent>
        <TabsContent value="vid"><VideosAdmin /></TabsContent>
        <TabsContent value="users"><Users /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stats() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [u, a, pend, w] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_activated", true),
        supabase.from("activation_payments").select("id", { count: "exact", head: true }).eq("status", "paid"),
        supabase.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return [["Users", u.count], ["Activated", a.count], ["Awaiting approval", pend.count], ["Pending withdrawals", w.count]] as const;
    },
  });
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {data?.map(([l, n]) => <div key={l} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="font-display text-3xl font-bold">{n ?? 0}</p></div>)}
    </div>
  );
}

const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = { paid: "default", pending: "outline", approved: "secondary", rejected: "destructive", failed: "destructive" };

function Activations() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("paid");
  const { data } = useQuery({
    queryKey: ["admin-act", filter],
    queryFn: async () => (await supabase.from("activation_payments").select("*, profiles(full_name,email,phone)").eq("status", filter).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  async function act(id: string, approve: boolean) {
    const { error } = await supabase.rpc("admin_approve_activation", { _payment: id, _approve: approve });
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Account activated" : "Payment rejected");
    qc.invalidateQueries();
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">{["paid", "pending", "approved", "rejected", "failed"].map((s) => <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize">{s === "paid" ? "Paid (to approve)" : s}</Button>)}</div>
      {!data?.length && <p className="text-sm text-muted-foreground">Nothing here.</p>}
      {data?.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div>
            <p className="font-semibold">{r.profiles?.full_name || "—"} <span className="text-sm font-normal text-muted-foreground">{r.profiles?.email}</span></p>
            <p className="text-sm text-muted-foreground">{r.phone} · {r.method === "stk" ? "M-Pesa prompt" : "Manual code"} · Code: <b>{r.mpesa_receipt ?? "—"}</b> · {new Date(r.created_at).toLocaleString("en-KE")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusColor[r.status]}>{r.status}</Badge>
            {(r.status === "paid" || r.status === "pending") && (<>
              <Button size="sm" onClick={() => act(r.id, true)}><Check className="mr-1 h-4 w-4" />Approve</Button>
              <Button size="sm" variant="outline" onClick={() => act(r.id, false)}><X className="mr-1 h-4 w-4" />Reject</Button>
            </>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Withdrawals() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-wd"],
    queryFn: async () => (await supabase.from("withdrawals").select("*, profiles(full_name,email)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  async function act(id: string, paid: boolean) {
    const { error } = await supabase.rpc("admin_process_withdrawal", { _id: id, _paid: paid });
    if (error) { toast.error(error.message); return; }
    toast.success(paid ? "Marked as paid" : "Rejected & refunded");
    qc.invalidateQueries();
  }
  return (
    <div className="mt-4 space-y-3">
      {!data?.length && <p className="text-sm text-muted-foreground">No withdrawals yet.</p>}
      {data?.map((w) => (
        <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div>
            <p className="font-semibold">{ksh(w.amount)} → {w.phone}</p>
            <p className="text-sm text-muted-foreground">{w.profiles?.full_name} · {w.profiles?.email} · {new Date(w.created_at).toLocaleString("en-KE")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={w.status === "paid" ? "secondary" : w.status === "rejected" ? "destructive" : "outline"}>{w.status}</Badge>
            {w.status === "pending" && (<>
              <Button size="sm" onClick={() => act(w.id, true)}>Mark paid</Button>
              <Button size="sm" variant="outline" onClick={() => act(w.id, false)}>Reject</Button>
            </>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function VideosAdmin() {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", url: "", reward: "15", duration: "30" });
  const { data } = useQuery({ queryKey: ["admin-vid"], queryFn: async () => (await supabase.from("videos").select("*").order("created_at", { ascending: false })).data ?? [] });
  async function save() {
    if (!f.title.trim() || !f.url.trim()) { toast.error("Add a title and YouTube link"); return; }
    const { error } = await supabase.rpc("admin_save_video", { _id: null as unknown as string, _title: f.title.trim(), _url: f.url.trim(), _reward: Number(f.reward), _duration: Number(f.duration), _active: true });
    if (error) { toast.error(error.message); return; }
    setF({ title: "", url: "", reward: "15", duration: "30" });
    qc.invalidateQueries({ queryKey: ["admin-vid"] });
  }
  async function toggle(v: { id: string; title: string; youtube_url: string; reward: number; duration_seconds: number; active: boolean }) {
    await supabase.rpc("admin_save_video", { _id: v.id, _title: v.title, _url: v.youtube_url, _reward: v.reward, _duration: v.duration_seconds, _active: !v.active });
    qc.invalidateQueries({ queryKey: ["admin-vid"] });
  }
  async function del(id: string) {
    await supabase.rpc("admin_delete_video", { _id: id });
    qc.invalidateQueries({ queryKey: ["admin-vid"] });
  }
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-2 rounded-2xl border bg-card p-4 md:grid-cols-[2fr_2fr_1fr_1fr_auto]">
        <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Input placeholder="YouTube link" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <Input type="number" placeholder="Reward KSh" value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} />
        <Input type="number" placeholder="Seconds" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} />
        <Button onClick={save}>Add video</Button>
      </div>
      {data?.map((v) => (
        <div key={v.id} className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div><p className="font-semibold">{v.title}</p><p className="text-sm text-muted-foreground">{ksh(v.reward)} · {v.duration_seconds}s · {v.youtube_url}</p></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toggle(v)}>{v.active ? "Hide" : "Show"}</Button>
            <Button size="sm" variant="ghost" onClick={() => del(v.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Users() {
  const [q, setQ] = useState("");
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [] });
  const list = data?.filter((u) => `${u.full_name} ${u.email} ${u.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mt-4 space-y-3">
      <Input placeholder="Search name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Status</th><th className="p-3">Balance</th><th className="p-3">Joined</th></tr></thead>
          <tbody>{list?.map((u) => (
            <tr key={u.id} className="border-t"><td className="p-3">{u.full_name}</td><td className="p-3">{u.email}</td><td className="p-3">{u.phone}</td>
              <td className="p-3">{u.is_activated ? <Badge>Active</Badge> : <Badge variant="outline">Not active</Badge>}</td>
              <td className="p-3">{ksh(u.balance)}</td><td className="p-3">{new Date(u.created_at).toLocaleDateString("en-KE")}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
