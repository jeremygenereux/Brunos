"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/app/admin/notifications/actions";
import { formatEventDateTime } from "@/lib/dates/event-time";

export type BellNotif = {
  id: string;
  message: string;
  created_at: string;
  read_at: string | null;
  edition_id: string;
};

function fmt(value: string) {
  return formatEventDateTime(value, "short");
}

export function NotificationBell({
  notifications,
  unread,
}: {
  notifications: BellNotif[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function markAll() {
    start(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="text-ivoire-muted hover:text-or-300 relative flex h-9 w-9 items-center justify-center rounded-full transition"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="bg-or-500 text-noir-900 absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="border-or-400/20 bg-noir-800/95 absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl">
          <div className="border-or-400/12 flex items-center justify-between border-b px-4 py-3">
            <span className="text-ivoire font-sans text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                disabled={pending}
                className="text-or-300 hover:text-or-400 font-sans text-xs transition disabled:opacity-60"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-ivoire-faint px-4 py-8 text-center font-sans text-sm">
              Aucune notification.
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`border-or-400/8 border-b last:border-0 ${
                    n.read_at ? "" : "bg-or-500/5"
                  }`}
                >
                  <Link
                    href={`/admin/editions/${n.edition_id}`}
                    onClick={() => setOpen(false)}
                    className="hover:bg-noir-700/50 flex items-start gap-2.5 px-4 py-3 transition"
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        n.read_at ? "bg-transparent" : "bg-or-400"
                      }`}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-ivoire font-sans text-sm">{n.message}</span>
                      <span className="text-ivoire-faint font-sans text-xs">
                        {fmt(n.created_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/admin/notifications"
            onClick={() => setOpen(false)}
            className="border-or-400/12 text-ivoire-muted hover:text-or-300 block border-t px-4 py-2.5 text-center font-sans text-xs transition"
          >
            Voir tout
          </Link>
        </div>
      )}
    </div>
  );
}
