import { useState } from "react";
import { Sparkles, Copy, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export const AI_ASSIST_PROMPT = `You are helping me log a work task for a personal productivity/appraisal tracker.
Based on my description of the work session below, extract ONLY the following fields as a single valid JSON object.
Do not add commentary, markdown formatting, or extra fields. If a field isn't mentioned, use an empty string or empty array.
Do NOT guess at ticket numbers, dates, priority, or status — I fill those in myself.

Schema:
{
  "description": string,        // 1-3 sentence plain-language summary of what was done
  "designDecisions": string,    // key technical/architectural choices and why, if any
  "techStack": string[],        // technologies, frameworks, services touched
  "collaborators": string[],    // names/teams worked with, if mentioned
  "tags": string[],             // a few freeform keywords for search
  "riskOrBlockerNotes": string  // any blocker resolved or risk mitigated, if applicable
}

My work session notes:
"<PASTE YOUR RAW NOTES HERE>"`;

interface Extracted {
  description?: string;
  designDecisions?: string;
  techStack?: string[];
  collaborators?: string[];
  tags?: string[];
  riskOrBlockerNotes?: string;
}

export function AiAssistBox({ onApply }: { onApply: (data: Extracted) => void }) {
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleCopyPrompt() {
    navigator.clipboard.writeText(AI_ASSIST_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleApply() {
    setError(null);
    try {
      const cleaned = pasted.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      const parsed = JSON.parse(cleaned) as Extracted;
      onApply(parsed);
      setPasted("");
    } catch {
      setError("Couldn't parse that as JSON. Make sure you pasted the AI's full response, with nothing extra before or after it.");
    }
  }

  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-brand">
          <Sparkles className="h-4 w-4" />
          AI-assist: fill the text-heavy fields automatically
        </div>
        <p className="text-xs text-muted">
          Copy this prompt into Claude / Cursor / Copilot along with your session notes, then paste the JSON reply below.
          Only description, design decisions, tech stack, collaborators, tags and risk notes get filled — you keep control of ticket ID, dates, priority and status.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={handleCopyPrompt}>
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? "Copied!" : "Copy AI prompt"}
        </Button>
        <Textarea
          placeholder="Paste the AI's JSON response here..."
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={4}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="button" size="sm" onClick={handleApply} disabled={!pasted.trim()}>
          <Wand2 />
          Apply to form
        </Button>
      </CardContent>
    </Card>
  );
}
