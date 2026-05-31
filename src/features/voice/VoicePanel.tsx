"use client";

import { useEffect, useMemo } from "react";
import { useVoiceControl } from "realtime-voice-component";
import { createVoiceController } from "./controller";

export function VoicePanel() {
  const controller = useMemo(() => createVoiceController(), []);
  const runtime = useVoiceControl(controller);

  useEffect(() => {
    return () => {
      controller.destroy();
    };
  }, [controller]);

  const isConnected = runtime.connected;
  const isConnecting = runtime.status === "connecting";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-700 p-6">
      <div className="flex items-center gap-3">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            isConnected
              ? "bg-green-500"
              : isConnecting
                ? "bg-yellow-400"
                : "bg-neutral-500"
          }`}
        />
        <span className="text-sm uppercase tracking-wide text-neutral-300">
          {runtime.status}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isConnected || isConnecting}
          onClick={() => void runtime.connect()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start session
        </button>
        <button
          type="button"
          disabled={!isConnected && !isConnecting}
          onClick={() => runtime.disconnect()}
          className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Stop session
        </button>
      </div>

      <div className="text-sm text-neutral-400">
        Allow microphone access when prompted, then say &ldquo;hello&rdquo;. You
        should hear the model reply.
      </div>
    </div>
  );
}
