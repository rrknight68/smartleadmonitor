"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Settings {
  smartlead_api_key: string;
  bounce_auto_delete: boolean;
  slack_webhook_url: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  notify_email: string;
}

interface NotificationLog {
  id: string;
  type: "email" | "slack";
  subject: string;
  recipient: string;
  status: "sent" | "failed";
  error?: string;
  timestamp: string;
}

const DEFAULT_SETTINGS: Settings = {
  smartlead_api_key: "",
  bounce_auto_delete: true,
  slack_webhook_url: "",
  smtp_host: "smtp.gmail.com",
  smtp_port: "587",
  smtp_user: "",
  smtp_password: "",
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  // Test states
  const [testingApi, setTestingApi] = useState(false);
  const [apiResult, setApiResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingSlack, setTestingSlack] = useState(false);
  const [slackResult, setSlackResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setLogs(await res.json());
    } catch {
      // ignore
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestApi = async () => {
    if (!settings.smartlead_api_key) {
      setApiResult({ success: false, message: "Please enter an API key first." });
      return;
    }
    setTestingApi(true);
    setApiResult(null);
    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: settings.smartlead_api_key }),
      });
      setApiResult(await res.json());
    } catch (error) {
      setApiResult({ success: false, message: String(error) });
    } finally {
      setTestingApi(false);
    }
  };

  const handleTestEmail = async () => {
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password || !settings.notify_email) {
      setEmailResult({ success: false, message: "Fill in all SMTP fields first." });
      return;
    }
    setTestingEmail(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_user: settings.smtp_user,
          smtp_password: settings.smtp_password,
          notify_email: settings.notify_email,
        }),
      });
      const data = await res.json();
      setEmailResult(data);
      if (data.success) fetchLogs();
    } catch (error) {
      setEmailResult({ success: false, message: String(error) });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestSlack = async () => {
    if (!settings.slack_webhook_url) {
      setSlackResult({ success: false, message: "Enter a Slack webhook URL first." });
      return;
    }
    setTestingSlack(true);
    setSlackResult(null);
    try {
      const res = await fetch("/api/test-slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_url: settings.slack_webhook_url }),
      });
      const data = await res.json();
      setSlackResult(data);
      if (data.success) fetchLogs();
    } catch (error) {
      setSlackResult({ success: false, message: String(error) });
    } finally {
      setTestingSlack(false);
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
              SmartLead Settings &rarr; Profile
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
              onClick={handleTestApi}
              disabled={testingApi || !settings.smartlead_api_key}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {testingApi ? "Testing..." : "Test Connection"}
            </button>
          </div>

          <TestResultBanner result={apiResult} />
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

        {/* Email Notifications */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Email Notifications</h2>
            <button
              onClick={handleTestEmail}
              disabled={testingEmail}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {testingEmail ? "Sending..." : "Send Test Email"}
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            SMTP settings for sending daily reports and alerts
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
              <input
                type="text"
                value={settings.smtp_host}
                onChange={(e) => update("smtp_host", e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
              <input
                type="text"
                value={settings.smtp_port}
                onChange={(e) => update("smtp_port", e.target.value)}
                placeholder="587"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
              <input
                type="email"
                value={settings.smtp_user}
                onChange={(e) => update("smtp_user", e.target.value)}
                placeholder="you@gmail.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
              <div className="relative">
                <input
                  type={showSmtpPassword ? "text" : "password"}
                  value={settings.smtp_password}
                  onChange={(e) => update("smtp_password", e.target.value)}
                  placeholder="App password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showSmtpPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Send Reports To</label>
            <input
              type="email"
              value={settings.notify_email}
              onChange={(e) => update("notify_email", e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>

          <p className="text-xs text-gray-400 mt-3">
            For Gmail, use an{" "}
            <a
              href="https://support.google.com/accounts/answer/185833"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              App Password
            </a>{" "}
            (not your regular password).
          </p>

          <TestResultBanner result={emailResult} />
        </section>

        {/* Slack Notifications */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Slack Notifications</h2>
            <button
              onClick={handleTestSlack}
              disabled={testingSlack}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {testingSlack ? "Sending..." : "Send Test Message"}
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Get notified about bounces, positive responses, and daily reports
          </p>

          <input
            type="url"
            value={settings.slack_webhook_url}
            onChange={(e) => update("slack_webhook_url", e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
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

          <TestResultBanner result={slackResult} />
        </section>

        {/* Vercel Environment Variables Info */}
        <section className="bg-amber-50 rounded-xl border border-amber-200 p-6">
          <h2 className="text-lg font-semibold text-amber-900 mb-1">Vercel Environment Variables</h2>
          <p className="text-sm text-amber-700 mb-4">
            For automated cron jobs to work, also set these in{" "}
            <strong>Vercel Dashboard &rarr; Settings &rarr; Environment Variables</strong>:
          </p>
          <div className="bg-amber-100 rounded-lg p-4 font-mono text-sm text-amber-900 space-y-1">
            <div><span className="text-amber-600">SMARTLEAD_API_KEY</span>=your_api_key</div>
            <div><span className="text-amber-600">CRON_SECRET</span>=any_random_secret</div>
            <div><span className="text-amber-600">BOUNCE_AUTO_DELETE</span>=true</div>
            <div><span className="text-amber-600">SMTP_HOST</span>=smtp.gmail.com</div>
            <div><span className="text-amber-600">SMTP_PORT</span>=587</div>
            <div><span className="text-amber-600">SMTP_USER</span>=your_email</div>
            <div><span className="text-amber-600">SMTP_PASSWORD</span>=your_app_password</div>
            <div><span className="text-amber-600">NOTIFY_EMAIL</span>=recipient_email</div>
            <div><span className="text-amber-600">SLACK_WEBHOOK_URL</span>=https://hooks.slack.com/...</div>
          </div>
          <p className="text-xs text-amber-600 mt-3">
            Dashboard settings are stored in your browser. Vercel env vars are needed
            for server-side cron jobs that run automatically.
          </p>
        </section>

        {/* Notification Log */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notification Log</h2>
              <p className="text-sm text-gray-500">Recent emails and Slack messages sent</p>
            </div>
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No notifications sent yet</p>
              <p className="text-sm mt-1">Use the test buttons above to send your first notification</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                    log.status === "sent"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 w-16 text-center text-xs font-medium px-2 py-0.5 rounded ${
                        log.type === "email"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {log.type === "email" ? "Email" : "Slack"}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{log.subject}</div>
                      <div className="text-xs text-gray-500">
                        To: {log.recipient}
                        {log.error && (
                          <span className="text-red-600 ml-2">{log.error}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span
                      className={`text-xs font-medium ${
                        log.status === "sent" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {log.status === "sent" ? "Sent" : "Failed"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Save Button */}
        <div className="flex items-center gap-4 pb-8">
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

function TestResultBanner({ result }: { result: { success: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <div
      className={`mt-3 p-3 rounded-lg text-sm ${
        result.success
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-red-50 text-red-700 border border-red-200"
      }`}
    >
      {result.message}
    </div>
  );
}
