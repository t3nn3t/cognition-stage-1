import Link from "next/link";
import { listFlags } from "@/application/queries";
import { getContainer } from "@/infrastructure/container";
import {
  EnvironmentBadge,
  StatusBadge,
} from "@/presentation/components/badges";
import { PageHeader } from "@/presentation/components/page-header";
import {
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@/presentation/components/table";
import { formatDateTime } from "@/presentation/format";

export const dynamic = "force-dynamic";

export default function FlagsPage() {
  const { context } = getContainer();
  const flags = listFlags(context);

  return (
    <div>
      <PageHeader
        title="Feature flags"
        description="Rollout state by environment. Production increases route through Release Management."
      />
      <Table>
        <TableHead
          columns={[
            "Flag",
            "Environment",
            "Rollout",
            "Owner",
            "Open request",
            "Last change",
          ]}
        />
        <tbody>
          {flags.map(({ flag, request }) => (
            <TableRow key={flag.id} href={`/flags/${flag.id}`}>
              <TableCell>
                <Link
                  href={`/flags/${flag.id}`}
                  className="font-mono text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {flag.key}
                </Link>
                <span className="block text-xs text-zinc-400">
                  {flag.description}
                </span>
              </TableCell>
              <TableCell>
                <EnvironmentBadge environment={flag.environment} />
              </TableCell>
              <TableCell className="font-medium">
                {flag.rolloutPercent}%
              </TableCell>
              <TableCell>{flag.ownerTeam}</TableCell>
              <TableCell>
                {request &&
                (request.state === "pending" ||
                  request.state === "approved" ||
                  request.state === "executing") ? (
                  <StatusBadge state={request.state} />
                ) : (
                  <span className="text-xs text-zinc-400">None</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-zinc-500">
                {flag.lastChangedAt ? formatDateTime(flag.lastChangedAt) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
