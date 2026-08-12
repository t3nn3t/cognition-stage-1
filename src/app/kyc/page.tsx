import Link from "next/link";
import { listKycQueue } from "@/application/queries";
import { getContainer } from "@/infrastructure/container";
import {
  KycStateBadge,
  RiskBadge,
  StatusBadge,
} from "@/presentation/components/badges";
import { PageHeader } from "@/presentation/components/page-header";
import {
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@/presentation/components/table";
import { formatAge } from "@/presentation/format";

export const dynamic = "force-dynamic";

export default function KycPage() {
  const { context } = getContainer();
  const queue = listKycQueue(context);

  return (
    <div>
      <PageHeader
        title="KYC review"
        description="Customer verification cases awaiting reviewer decisions."
      />
      <Table>
        <TableHead
          columns={[
            "Customer",
            "Trigger",
            "Risk",
            "Case state",
            "Decision",
            "Age",
          ]}
        />
        <tbody>
          {queue.map(({ kycCase, request }) => (
            <TableRow key={kycCase.id}>
              <TableCell>
                <Link
                  href={`/kyc/${kycCase.id}`}
                  className="font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {kycCase.customerName}
                </Link>
                <span className="block text-xs text-zinc-400">
                  {kycCase.customerEmail}
                </span>
              </TableCell>
              <TableCell>{kycCase.reviewTrigger}</TableCell>
              <TableCell>
                <RiskBadge level={kycCase.riskLevel} />
              </TableCell>
              <TableCell>
                <KycStateBadge state={kycCase.state} />
              </TableCell>
              <TableCell>
                {request ? (
                  <StatusBadge state={request.state} />
                ) : (
                  <span className="text-xs text-zinc-400">None</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-zinc-500">
                {formatAge(kycCase.openedAt)}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
