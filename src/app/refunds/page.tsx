import Link from "next/link";
import { listRefundQueue } from "@/application/queries";
import { getContainer } from "@/infrastructure/container";
import { RiskBadge, StatusBadge } from "@/presentation/components/badges";
import { PageHeader } from "@/presentation/components/page-header";
import {
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@/presentation/components/table";
import { formatAge, formatMoney } from "@/presentation/format";

export const dynamic = "force-dynamic";

export default async function RefundsPage() {
  const { context } = await getContainer();
  const queue = await listRefundQueue(context);

  return (
    <div>
      <PageHeader
        title="Refunds"
        description="Refund cases raised by customer support and their approval status."
      />
      <Table>
        <TableHead
          columns={[
            "Customer",
            "Order",
            "Charge",
            "Risk",
            "Status",
            "Requested by",
            "Age",
          ]}
        />
        <tbody>
          {queue.map(({ refundCase, request }) => (
            <TableRow key={refundCase.id} href={`/refunds/${refundCase.id}`}>
              <TableCell>
                <Link
                  href={`/refunds/${refundCase.id}`}
                  className="font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {refundCase.customerName}
                </Link>
                <span className="block text-xs text-zinc-400">
                  {refundCase.customerEmail}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {refundCase.orderId}
              </TableCell>
              <TableCell>{formatMoney(refundCase.chargeAmount)}</TableCell>
              <TableCell>
                <RiskBadge level={refundCase.riskLevel} />
              </TableCell>
              <TableCell>
                {request ? (
                  <StatusBadge state={request.state} />
                ) : (
                  <span className="text-xs text-zinc-400">No request</span>
                )}
              </TableCell>
              <TableCell>
                {request ? (
                  request.requesterName
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-zinc-500">
                {formatAge(refundCase.chargedAt)}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
