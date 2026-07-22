import { getCustomerSuccessList } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { CustomerSuccessBoard } from "./CustomerSuccessBoard";

export const dynamic = "force-dynamic";

export default async function CustomerSuccessPage() {
  const stages = await getCustomerSuccessList();
  return (
    <div>
      <PageHeader
        title="Customer Success"
        description="Após o fechamento, a jornada não termina. Estas etapas iniciam automaticamente para garantir o acompanhamento do cliente."
      />
      <CustomerSuccessBoard stages={stages} />
    </div>
  );
}
