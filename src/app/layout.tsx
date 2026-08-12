import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getContainer } from "@/infrastructure/container";
import { identitySwitchingEnabled } from "@/infrastructure/identity";
import { AccountMenu } from "@/presentation/components/account-menu";
import { NavLink } from "@/presentation/components/nav-link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Operations Console",
  description:
    "Internal operations console for refunds, KYC, and feature flags",
};

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/refunds", label: "Refunds" },
  { href: "/kyc", label: "KYC" },
  { href: "/flags", label: "Feature Flags" },
  { href: "/activity", label: "Activity" },
] as const;

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const container = await getContainer();
  const actor = await container.identity.getCurrentActor();
  const switchingEnabled = identitySwitchingEnabled();
  const actors = switchingEnabled ? await container.identity.listActors() : [];

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <aside className="w-52 shrink-0 border-r border-zinc-200 bg-white">
            <div className="px-4 py-5">
              <p className="text-sm font-semibold tracking-tight text-zinc-900">
                Operations Console
              </p>
            </div>
            <nav aria-label="Main" className="px-2">
              <ul className="space-y-0.5">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <NavLink href={item.href}>{item.label}</NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center justify-end border-b border-zinc-200 bg-white px-6">
              <AccountMenu
                actor={{
                  id: actor.id,
                  name: actor.name,
                  title: actor.title,
                  roles: [...actor.roles],
                }}
                actors={actors.map((a) => ({
                  id: a.id,
                  name: a.name,
                  title: a.title,
                }))}
                switchingEnabled={switchingEnabled}
              />
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
