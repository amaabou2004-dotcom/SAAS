import { getCountries } from "@/lib/integrations/countries";
import { NewInvoiceForm } from "./NewInvoiceForm";

export const revalidate = 86_400;

export default async function NewInvoicePage() {
  const countries = await getCountries();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Nouvelle facture</h1>
          <p className="sub">
            Le taux de change et l&apos;échéance (jours fériés + week-end) sont calculés côté serveur.
          </p>
        </div>
      </div>
      <NewInvoiceForm countries={countries.data} countriesSource={countries.source} />
    </>
  );
}
