import { notFound } from "next/navigation";
import {
  getPersonById,
  getPersonTimeline,
  getPersonActivities,
  getPersonOpportunities,
  getPersonProductsList,
  getPersonDocuments,
  getPersonCrossSell,
  getPersonCustomerSuccess,
  getPersonErpSync,
  getUsers,
  getProductTypes,
  getPipelinesWithStages,
} from "@/lib/queries";
import { PersonWorkspace } from "./PersonWorkspace";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) notFound();

  const person = await getPersonById(personId);
  if (!person) notFound();

  const [timeline, activities, opportunities, products, documents, crossSell, customerSuccess, erpSync, users, productTypes, pipelines] =
    await Promise.all([
      getPersonTimeline(personId),
      getPersonActivities(personId),
      getPersonOpportunities(personId),
      getPersonProductsList(personId),
      getPersonDocuments(personId),
      getPersonCrossSell(personId),
      getPersonCustomerSuccess(personId),
      getPersonErpSync(personId),
      getUsers(),
      getProductTypes(),
      getPipelinesWithStages(),
    ]);

  return (
    <PersonWorkspace
      person={person}
      timeline={timeline}
      activities={activities}
      opportunities={opportunities}
      products={products}
      documents={documents}
      crossSell={crossSell}
      customerSuccess={customerSuccess}
      erpSync={erpSync}
      users={users}
      productTypes={productTypes}
      pipelines={pipelines}
    />
  );
}
