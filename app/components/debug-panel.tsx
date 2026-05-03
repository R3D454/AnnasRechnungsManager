/**
 * Debug panel component - shows in development and when debug mode is enabled
 * Access via browser console: setDebugMode(true) or localStorage.setItem('DEBUG_MODE', 'true')
 */

import { useEffect, useState } from "react";
import { isDebugMode, setDebugMode } from "@/lib/client-validation";

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    setDebugEnabled(isDebugMode());
  }, []);

  const toggleDebug = () => {
    const newState = !debugEnabled;
    setDebugMode(newState);
    setDebugEnabled(newState);
  };

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full font-bold text-white text-lg transition-all ${
          debugEnabled
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-gray-400 hover:bg-gray-500"
        }`}
        title={debugEnabled ? "Debug Mode: ON" : "Debug Mode: OFF"}
      >
        🐛
      </button>

      {/* Debug panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-40 bg-gray-900 text-white rounded-lg shadow-2xl p-4 w-80 max-h-96 overflow-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Debug Mode</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="border-t border-gray-700 pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={debugEnabled}
                  onChange={toggleDebug}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  {debugEnabled ? "✅ Enabled" : "⭕ Disabled"}
                </span>
              </label>
            </div>

            <div className="bg-gray-800 p-3 rounded text-xs space-y-1">
              <p className="text-gray-400">Browser Console Commands:</p>
              <code className="block text-blue-400">
                setDebugMode(true)
              </code>
              <code className="block text-blue-400">
                localStorage.setItem('DEBUG_MODE', 'true')
              </code>
              <code className="block text-green-400">
                isDebugMode()
              </code>
            </div>

            <div className="bg-gray-800 p-3 rounded text-xs">
              <p className="text-gray-400 mb-1">Current State:</p>
              <p className="text-yellow-300">
                DEBUG: <strong>{debugEnabled ? "ON" : "OFF"}</strong>
              </p>
              <p className="text-yellow-300">
                ENV: <strong>{process.env.NODE_ENV}</strong>
              </p>
            </div>

            <button
              onClick={() => {
                if (debugEnabled) {
                  console.log("🔍 Debug Info:");
                  console.log({
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                  });
                } else {
                  alert("Enable Debug Mode first!");
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-medium"
            >
              Log Debug Info
            </button>
          </div>
        </div>
      )}
    </>
  );
}
