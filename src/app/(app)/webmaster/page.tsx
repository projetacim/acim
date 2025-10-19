
'use client';

import { StripeImportView } from './components/stripe-import-view';
import { DataProvider } from '@/app/(app)/data-provider';

export default function WebmasterPage() {
  return (
    <DataProvider>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Importation Stripe</h1>
          <p className="text-muted-foreground">
            Traitez et assignez les dons provenant de votre exportation Stripe.
          </p>
        </div>
        <StripeImportView />
      </div>
    </DataProvider>
  );
}
