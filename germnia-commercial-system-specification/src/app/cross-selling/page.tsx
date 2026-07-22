import { getCrossSellList } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { CrossSellList } from "./CrossSellList";

export const dynamic = "force-dynamic";

export default async function CrossSellingPage() {
  const suggestions = await getCrossSellList();

  return (
    <div>
      <PageHeader
        title="Cross Selling"
        description="Onde existe oportunidade de vender mais para quem já é cliente? O sistema identifica automaticamente lacunas de produtos."
      />
      <CrossSellList suggestions={suggestions} />
    </div>
  );
}
