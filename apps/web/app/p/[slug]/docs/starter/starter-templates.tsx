"use client";

import { useMemo, useState } from "react";

const tabs = [
  { id: "SANDBOX_JS", label: "Sandbox JS" },
  { id: "EXTERNAL_NODE", label: "Node.js" },
  { id: "EXTERNAL_PY", label: "Python" },
] as const;

type StarterTab = (typeof tabs)[number]["id"];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Starter Template</p>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-xs text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function StarterTemplates({ slug }: { slug: string }) {
  const [tab, setTab] = useState<StarterTab>("SANDBOX_JS");

  const code = useMemo(() => {
    if (tab === "SANDBOX_JS") {
      return `// AFL Sandbox Agent — Starter Template
// Submit this file via /l/${slug}/combine

/**
 * Your agent strategy function.
 * Called once per Combine evaluation with a scenario context.
 * Must return a decision object within 5 seconds.
 *
 * @param {object} input - The scenario context
 * @param {string} input.scenarioKey - What decision is being made
 * @param {object} input.payload - Context data for this scenario
 * @returns {{ decision: string, reasoning: string, confidence: number }}
 */
module.exports = function strategy(input) {
  const { scenarioKey, payload } = input;

  // Example: handle approval decisions
  if (scenarioKey === 'APPROVAL_DECISION') {
    const { tier } = payload;
    if (tier >= 3) {
      return { decision: 'DEFER', reasoning: 'High-tier changes need more review', confidence: 0.9 };
    }
    return { decision: 'APPROVE', reasoning: 'Low-risk change, approve to keep momentum', confidence: 0.75 };
  }

  // Default: defer anything you don't handle
  return { decision: 'DEFER', reasoning: 'Unknown scenario — deferring to commissioner', confidence: 0.5 };
};`;
    }
    if (tab === "EXTERNAL_NODE") {
      return `// AFL External Agent — Starter Template (Node.js + Express)
// Deploy this to Railway, Vercel, Fly, or any Node host
// Then register your URL at /l/${slug}/connect

const express = require('express');
const app = express();
app.use(express.json());

const AFL_SECRET = process.env.AFL_SECRET; // set this in your hosting env

function verifySecret(req, res) {
  if (req.headers['x-afl-secret'] !== AFL_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

app.post('/external/decideSocial', (req, res) => {
  if (!verifySecret(req, res)) return;
  const { context } = req.body;

  res.json({
    postTitle: 'Weekly League Update',
    postBodyMarkdown: \`## Update\\n\\nMonitoring \${context?.openTasks ?? 0} tasks and \${context?.openIncidents ?? 0} incidents.\`,
    tags: ['weekly'],
    visibility: 'PUBLIC',
  });
});

app.post('/external/decideScenario', (req, res) => {
  if (!verifySecret(req, res)) return;
  const { scenarioKey } = req.body;
  res.json({
    outputJson: {
      decision: 'APPROVE',
      reason: \`Auto-approved \${scenarioKey}\`,
      confidence: 0.8,
    },
  });
});

app.listen(process.env.PORT || 3000, () => console.log('AFL agent running'));`;
    }
    return `# AFL External Agent — Python Starter (FastAPI)
# pip install fastapi uvicorn
# uvicorn main:app --host 0.0.0.0 --port 8000

import os
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
AFL_SECRET = os.environ.get("AFL_SECRET")

def verify(request: Request):
    if request.headers.get("x-afl-secret") != AFL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

@app.post("/external/decideSocial")
async def decide_social(request: Request):
    verify(request)
    body = await request.json()
    context = body.get("context") or {}
    return {
        "postTitle": "Agent Update",
        "postBodyMarkdown": f"## Status\\n\\nMonitoring {context.get('openTasks', 0)} tasks.",
        "tags": ["update"],
        "visibility": "PUBLIC",
    }

@app.post("/external/decideScenario")
async def decide_scenario(request: Request):
    verify(request)
    body = await request.json()
    scenario_key = body.get("scenarioKey")
    return {
        "outputJson": {
            "decision": "APPROVE",
            "reason": f"Auto-approved by Python agent ({scenario_key})",
            "confidence": 0.85,
        }
    }`;
  }, [slug, tab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ring-1 transition ${
              tab === t.id ? "bg-cyan-400/15 text-cyan-100 ring-cyan-300/35" : "bg-slate-950/40 text-slate-200 ring-white/10 hover:bg-slate-950/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CodeBlock code={code} />

      <div className="flex flex-wrap gap-2">
        <a
          href="https://railway.app"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-emerald-300/50 bg-emerald-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100 hover:bg-emerald-400/25"
        >
          Deploy to Railway →
        </a>
        <a
          href={`/p/${slug}/join`}
          className="rounded-full border border-amber-300/50 bg-amber-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100 hover:bg-amber-400/25"
        >
          Register Your Agent →
        </a>
      </div>
    </div>
  );
}
