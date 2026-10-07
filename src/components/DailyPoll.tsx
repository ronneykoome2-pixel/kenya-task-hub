import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Vote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ksh } from "@/lib/account";

const BANK: { q: string; o: string[] }[] = [
  { q: "How do you mostly access the internet?", o: ["Smartphone", "Laptop", "Cyber café", "Tablet"] },
  { q: "Which mobile network do you use most?", o: ["Safaricom", "Airtel", "Telkom", "Other"] },
  { q: "How often do you use M-Pesa?", o: ["Daily", "Weekly", "Monthly", "Rarely"] },
  { q: "What's your favourite meal?", o: ["Ugali & sukuma", "Chapati & beans", "Pilau", "Nyama choma"] },
  { q: "Which social app do you use most?", o: ["WhatsApp", "TikTok", "Facebook", "Instagram"] },
  { q: "How do you usually travel?", o: ["Matatu", "Boda boda", "Walking", "Own car"] },
  { q: "What would you do with extra KSh 1,000?", o: ["Save it", "Buy airtime/data", "Food", "Invest in business"] },
  { q: "Which sport do you enjoy most?", o: ["Football", "Athletics", "Rugby", "None"] },
  { q: "What time do you go online most?", o: ["Morning", "Afternoon", "Evening", "Late night"] },
  { q: "Where do you buy groceries?", o: ["Supermarket", "Local kiosk", "Open market", "Online"] },
  { q: "How do you watch TV/shows?", o: ["TV", "YouTube", "Showmax/Netflix", "I don't"] },
  { q: "What skill would you like to learn?", o: ["Coding", "Design", "Business", "Farming"] },
  { q: "Do you prefer saving in…", o: ["M-Shwari", "Bank", "Chama", "Cash at home"] },
  { q: "What's your favourite music?", o: ["Gengetone", "Bongo", "Gospel", "Afrobeats"] },
  { q: "How much data do you buy weekly?", o: ["Under 1GB", "1–5GB", "5–10GB", "Unlimited"] },
  { q: "What's most important in a job?", o: ["Pay", "Flexibility", "Growth", "Location"] },
];

function todaysQuestions() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  const seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return Array.from({ length: 8 }, (_, i) => BANK[(seed * 3 + i * 5) % BANK.length]).filter((v, i, a) => a.indexOf(v) === i).concat(BANK).filter((v, i, a) => a.indexOf(v) === i).slice(0, 8);
}

export function DailyPoll() {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const questions = todaysQuestions();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const { data: done } = useQuery({
    queryKey: ["poll-today", today],
    queryFn: async () => !!(await supabase.from("poll_completions").select("id").eq("poll_date", today).maybeSingle()).data,
  });

  async function submit() {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_daily_poll", { _answers: answers });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Bonus earned: ${ksh(data ?? 0)}!`);
    qc.invalidateQueries();
  }

  return (
    <div className="rounded-3xl border-2 border-primary bg-card p-6">
      <div className="flex items-center gap-3"><Vote className="h-6 w-6 text-primary" /><h2 className="text-xl font-bold">Daily poll — earn KSh 10 bonus</h2></div>
      <p className="mt-1 text-sm text-muted-foreground">Answer 8 quick questions once a day. New poll every morning.</p>
      {done ? (
        <p className="mt-5 flex items-center gap-2 font-medium text-primary"><CheckCircle2 className="h-5 w-5" />Done for today — come back tomorrow!</p>
      ) : (
        <>
          <ol className="mt-5 space-y-5">
            {questions.map((item, i) => (
              <li key={item.q}>
                <p className="font-medium">{i + 1}. {item.q}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.o.map((o) => (
                    <button key={o} type="button" onClick={() => setAnswers((a) => ({ ...a, [`q${i + 1}`]: o }))}
                      className={`rounded-full border px-3 py-1.5 text-sm ${answers[`q${i + 1}`] === o ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}>
                      {o}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <Button className="mt-6 h-11 w-full" disabled={busy || Object.keys(answers).length < 8} onClick={submit}>
            {Object.keys(answers).length < 8 ? `Answer all questions (${Object.keys(answers).length}/8)` : "Submit & claim KSh 10"}
          </Button>
        </>
      )}
    </div>
  );
}
