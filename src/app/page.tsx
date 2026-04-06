"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type {
  CampaignAnalytics,
  BounceEvent,
  ResponseEvent,
  EmailAccountHealth,
} from "@/lib/types";

type Tab = "campaigns" | "bounces" | "responses" | "health";

function getApiKey(): string {
  try {
    const stored = localStorage.getItem("smartlead_settings");
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.smartlead_api_key || "";
    }
  } catch {
    // ignore
  }
  return "";
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<CampaignAnalytics[]>([]);
  const [bounces, setBounces] = useState<BounceEvent[]>([]);
  const [responses, setResponses] = useState<ResponseEvent[]>([]);
  const [health, setHealth] = useState<EmailAccountHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [hasApiKey, setHasApiKey] = useState(true);

  const fetchData = useCallback(async () => {
    const apiKey = getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["x-smartlead-api-key"] = apiKey;
    }

    setLoading(true);
    setError(null);
    try {
      const [cRes, bRes, rRes, hRes] = await Promise.all([
        fetch("/api/campaigns", { headers }),
        fetch("/api/bounces", { headers }),
        fetch("/api/responses", { headers }),
        fetch("/api/health", { headers }),
      ]);

      if (cRes.status === 401) {
        setHasApiKey(false);
        throw new Error("API key not configured.");
      }

      if (!cRes.ok || !bRes.ok || !rRes.ok || !hRes.ok) {
        throw new Error("Failed to fetch data. Check your API key in Settings.");
      }

      setHasApiKey(true);
      setCampaigns(await cRes.json());
      setBounces(await bRes.json());
      setResponses(await rRes.json());
      setHealth(await hRes.json());
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalOpened = campaigns.reduce((s, c) => s + c.opened, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.replied, 0);
  const totalBounced = campaigns.reduce((s, c) => s + c.bounced, 0);
  const positiveCount = responses.filter((r) => r.type === "positive").length;
  const criticalHealth = health.filter((h) => h.health_status === "critical").length;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "campaigns", label: "Campaigns", count: campaigns.length },
    { key: "bounces", label: "Bounces", count: bounces.length },
    { key: "responses", label: "Responses", count: responses.length },
    { key: "health", label: "Email Health", count: health.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SmartLead Monitor</h1>
          <p className="text-gray-500 mt-1">Campaign monitoring dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-sm text-gray-400">Last refresh: {lastRefresh}</span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <Link
            href="/settings"
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Settings
          </Link>
        </div>
      </div>

      {!hasApiKey && (
        <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-xl text-center">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">Welcome to SmartLead Monitor</h2>
          <p className="text-blue-700 mb-4">
            To get started, add your SmartLead API key in the settings.
          </p>
          <Link
            href="/settings"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Go to Settings
          </Link>
        </div>
      )}

      {error && hasApiKey && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Campaigns" value={campaigns.length} color="blue" />
        <StatCard label="Total Sent" value={totalSent} color="gray" />
        <StatCard
          label="Opened"
          value={totalSent > 0 ? `${((totalOpened / totalSent) * 100).toFixed(1)}%` : "0%"}
          color="indigo"
        />
        <StatCard label="Replied" value={totalReplied} color="green" />
        <StatCard label="Positive" value={positiveCount} color="emerald" />
        <StatCard
          label="Bounced"
          value={totalBounced}
          color={totalBounced > 0 ? "red" : "gray"}
        />
      </div>

      {criticalHealth > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <span className="text-red-600 font-semibold">
            {criticalHealth} email account{criticalHealth > 1 ? "s" : ""} in critical health
          </span>
          <button
            onClick={() => setTab("health")}
            className="text-red-600 underline text-sm"
          >
            View details
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {loading && !campaigns.length ? (
        <div className="text-center py-20 text-gray-400">Loading data...</div>
      ) : (
        <>
          {tab === "campaigns" && <CampaignsTab campaigns={campaigns} />}
          {tab === "bounces" && <BouncesTab bounces={bounces} />}
          {tab === "responses" && <ResponsesTab responses={responses} />}
          {tab === "health" && <HealthTab health={health} />}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    gray: "bg-gray-50 text-gray-700",
    indigo: "bg-indigo-50 text-indigo-700",
    green: "bg-green-50 text-green-700",
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className={`rounded-xl p-4 ${colorMap[color] ?? colorMap.gray}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-70 mt-1">{label}</div>
    </div>
  );
}

function CampaignsTab({ campaigns }: { campaigns: CampaignAnalytics[] }) {
  if (campaigns.length === 0) {
    return <EmptyState message="No campaigns found" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-left text-gray-600">
            <th className="px-4 py-3 rounded-l-lg">Campaign</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Leads</th>
            <th className="px-4 py-3 text-right">Sent</th>
            <th className="px-4 py-3 text-right">Opened</th>
            <th className="px-4 py-3 text-right">Clicked</th>
            <th className="px-4 py-3 text-right">Replied</th>
            <th className="px-4 py-3 text-right rounded-r-lg">Bounced</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const openRate = c.sent > 0 ? ((c.opened / c.sent) * 100).toFixed(1) : "0";
            const replyRate = c.sent > 0 ? ((c.replied / c.sent) * 100).toFixed(1) : "0";
            return (
              <tr key={c.campaign_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-right">{c.total_leads}</td>
                <td className="px-4 py-3 text-right">{c.sent}</td>
                <td className="px-4 py-3 text-right">
                  {c.opened} <span className="text-gray-400">({openRate}%)</span>
                </td>
                <td className="px-4 py-3 text-right">{c.clicked}</td>
                <td className="px-4 py-3 text-right">
                  {c.replied} <span className="text-gray-400">({replyRate}%)</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={c.bounced > 0 ? "text-red-600 font-medium" : ""}>
                    {c.bounced}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BouncesTab({ bounces }: { bounces: BounceEvent[] }) {
  if (bounces.length === 0) {
    return <EmptyState message="No bounces detected" />;
  }

  return (
    <div className="space-y-3">
      {bounces.map((b, i) => (
        <div
          key={`${b.campaign_id}-${b.lead_id}-${i}`}
          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
        >
          <div>
            <div className="font-medium text-gray-900">{b.email}</div>
            <div className="text-sm text-gray-500">{b.campaign_name}</div>
          </div>
          <div className="flex items-center gap-3">
            {b.deleted && (
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                Auto-deleted
              </span>
            )}
            <span className="text-xs text-gray-400">
              {new Date(b.detected_at).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResponsesTab({ responses }: { responses: ResponseEvent[] }) {
  if (responses.length === 0) {
    return <EmptyState message="No responses yet" />;
  }

  const positives = responses.filter((r) => r.type === "positive");
  const replies = responses.filter((r) => r.type === "reply");

  return (
    <div className="space-y-6">
      {positives.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-green-700 mb-3">
            Positive Responses ({positives.length})
          </h3>
          <div className="space-y-3">
            {positives.map((r, i) => (
              <div
                key={`${r.campaign_id}-${r.lead_id}-${i}`}
                className="p-4 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="font-medium text-gray-900">{r.email}</div>
                <div className="text-sm text-gray-600">{r.campaign_name}</div>
                {r.message_preview && (
                  <div className="mt-2 text-sm text-gray-500 italic">
                    &quot;{r.message_preview}&quot;
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-blue-700 mb-3">
            Replies ({replies.length})
          </h3>
          <div className="space-y-3">
            {replies.map((r, i) => (
              <div
                key={`${r.campaign_id}-${r.lead_id}-${i}`}
                className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <div className="font-medium text-gray-900">{r.email}</div>
                <div className="text-sm text-gray-600">{r.campaign_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthTab({ health }: { health: EmailAccountHealth[] }) {
  if (health.length === 0) {
    return <EmptyState message="No email accounts found" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-left text-gray-600">
            <th className="px-4 py-3 rounded-l-lg">Email Account</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Warmup</th>
            <th className="px-4 py-3 text-right">Reputation</th>
            <th className="px-4 py-3 text-right">Sent</th>
            <th className="px-4 py-3 text-right rounded-r-lg">Bounce Rate</th>
          </tr>
        </thead>
        <tbody>
          {health.map((h) => (
            <tr key={h.account_id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{h.email}</td>
              <td className="px-4 py-3">
                <HealthBadge status={h.health_status} />
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    h.warmup_enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {h.warmup_enabled ? "On" : "Off"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {(h.warmup_reputation * 100).toFixed(0)}%
              </td>
              <td className="px-4 py-3 text-right">{h.total_sent}</td>
              <td className="px-4 py-3 text-right">
                <span
                  className={
                    h.bounce_rate > 10
                      ? "text-red-600 font-bold"
                      : h.bounce_rate > 5
                        ? "text-yellow-600 font-medium"
                        : ""
                  }
                >
                  {h.bounce_rate.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const color =
    s === "active" || s === "started"
      ? "bg-green-100 text-green-700"
      : s === "paused"
        ? "bg-yellow-100 text-yellow-700"
        : s === "completed"
          ? "bg-blue-100 text-blue-700"
          : "bg-gray-100 text-gray-600";

  return (
    <span className={`text-xs px-2 py-1 rounded font-medium ${color}`}>
      {status}
    </span>
  );
}

function HealthBadge({ status }: { status: string }) {
  const color =
    status === "healthy"
      ? "bg-green-100 text-green-700"
      : status === "warning"
        ? "bg-yellow-100 text-yellow-700"
        : status === "critical"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600";

  return (
    <span className={`text-xs px-2 py-1 rounded font-medium uppercase ${color}`}>
      {status}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-lg">{message}</p>
    </div>
  );
}
