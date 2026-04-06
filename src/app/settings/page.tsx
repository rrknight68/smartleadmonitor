"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Settings {
  smartlead_api_key: string;
  bounce_auto_delete: boolean;
  slack_webhook_url: string;
  notify_email: string;
}

const DEFAULT_SETTINGS: Settings = {
  smartlead_api_key: "",
  bounce_auto_delete: true,
  slack_webhook_url: "",
  notify_email: "",
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem("smartlead_settings");
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: Settings) {
  localStorage.setItem("smartlead_settings", JSON.stringify(settings));
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestConnection = async () => {
    if (!settings.smartlead_api_key) {
      setTestResult({ success: false, message: "Please enter an API key first." });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: settings.smartlead_api_key }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
    } catch (error) {
      setTestResult({ success: false, message: `Request failed: ${String(error)}` });
    } finally {
      setTesting(false);
    }
  };

  const update = (field: keyof Settings, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Configure your SmartLead Monitor</p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="space-y-8">
        {/* SmartLead API Key */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">SmartLead API Key</h2>
          <p className="text-sm text-gray-500 mb-4">
            Find your API key at{" "}
            <a
              href="https://app.smartlead.ai/app/settings/profile"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              SmartLead Settings → Profile
            </a>
          </p>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type={showApiKey ? "text" : "password"}
                value={settings.smartlead_api_key}
                onChange={(e) => update("smartlead_api_key", e.target.value)}
                placeholder="Enter your SmartLead API key"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-20"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>
            <button
              onClick={handleTestConnection}
              disabled={testing || !settings.smartlead_api_key}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-lg text-sm ${
                testResult.success
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {testResult.message}
            </div>
          )}
        </section>

        {/* Bounce Settings */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Bounce Handling</h2>
          <p className="text-sm text-gray-500 mb-4">
            Configure how bounced leads are handled during monitoring
          </p>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.bounce_auto_delete ? "bg-blue-600" : "bg-gray-300"
              }`}
              onClick={() => update("bounce_auto_delete", !settings.bounce_auto_delete)}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings.bounce_auto_delete ? "translate-x-5" : ""
                }`}
              />
            </div>
            <div>
              <span className="font-medium text-gray-900">Auto-delete bounced leads</span>
              <p className="text-sm text-gray-500">
                Automatically remove leads with bounce status from campaigns
              </p>
            </div>
          </label>
        </section>

        {/* Slack Notifications */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Slack Notifications</h2>
          <p className="text-sm text-gray-500 mb-4">
            Get notified about bounces, positive responses, and daily reports
          </p>

          <input
            type="url"
            value={settings.slack_webhook_url}
            onChange={(e) => update("slack_webhook_url", e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-2">
            Create a webhook at{" "}
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              api.slack.com/messaging/webhooks
            </a>
          </p>
        </section>

        {/* Email Notifications */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Email Notifications</h2>
          <p className="text-sm text-gray-500 mb-4">
            Email address for daily summary and end-of-day reports
          </p>

          <input
            type="email"
            value={settings.notify_email}
            onChange={(e) => update("notify_email", e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </section>

        {/* Vercel Environment Variables Info */}
        <section className="bg-amber-50 rounded-xl border border-amber-200 p-6">
          <h2 className="text-lg font-semibold text-amber-900 mb-1">Automated Cron Jobs</h2>
          <p className="text-sm text-amber-700 mb-4">
            For the automated monitoring cron jobs (every 30 min) and daily reports to work,
            you also need to set these environment variables in your{" "}
            <strong>Vercel Dashboard → Settings → Environment Variables</strong>:
          </p>
          <div className="bg-amber-100 rounded-lg p-4 font-mono text-sm text-amber-900 space-y-1">
            <div>
              <span className="text-amber-600">SMARTLEAD_API_KEY</span>=your_api_key
            </div>
            <div>
              <span className="text-amber-600">CRON_SECRET</span>=any_random_secret
            </div>
            <div>
              <span className="text-amber-600">BOUNCE_AUTO_DELETE</span>=true
            </div>
            <div>
              <span className="text-amber-600">SLACK_WEBHOOK_URL</span>=https://hooks.slack.com/...
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-3">
            Dashboard settings above are stored in your browser. Vercel env vars are needed
            for server-side cron jobs that run automatically.
          </p>
        </section>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Save Settings
          </button>
          {saved && (
            <span className="text-green-600 text-sm font-medium">
              Settings saved successfully!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
