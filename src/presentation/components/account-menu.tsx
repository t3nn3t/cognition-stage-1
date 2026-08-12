"use client";

import { useEffect, useRef, useState } from "react";
import { switchIdentityAction } from "@/app/actions";
import { initialsOf } from "../format";
import { ROLE_LABELS } from "../labels";
import type { Role } from "@/domain/shared";

interface AccountMenuActor {
  id: string;
  name: string;
  title: string;
  roles: Role[];
}

export function AccountMenu({
  actor,
  actors,
  switchingEnabled,
}: {
  actor: AccountMenuActor;
  actors: { id: string; name: string; title: string }[];
  switchingEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-zinc-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          {initialsOf(actor.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium text-zinc-900">
            {actor.name}
          </span>
          <span className="block text-xs text-zinc-500">{actor.title}</span>
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-max min-w-64 max-w-md rounded-lg border border-zinc-200 bg-white py-2 shadow-lg"
        >
          <div className="border-b border-zinc-100 px-4 pb-2">
            <p className="text-sm font-medium text-zinc-900">{actor.name}</p>
            <p className="text-xs text-zinc-500">
              {actor.roles.map((role) => ROLE_LABELS[role]).join(" · ")}
            </p>
          </div>
          {switchingEnabled ? (
            <div className="px-4 pt-2">
              <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                Switch user
              </p>
              <ul className="mt-1 space-y-0.5">
                {actors.map((candidate) => (
                  <li key={candidate.id}>
                    <form action={switchIdentityAction}>
                      <input type="hidden" name="userId" value={candidate.id} />
                      <button
                        type="submit"
                        role="menuitem"
                        disabled={candidate.id === actor.id}
                        className="block w-full rounded px-2 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:font-medium disabled:text-indigo-700"
                      >
                        {candidate.name}{" "}
                        <span className="ml-1.5 text-xs text-zinc-400">
                          {candidate.title}
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
