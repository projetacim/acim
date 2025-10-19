'use client';

import { StripeImportView } from './components/stripe-import-view';
import { DataProvider } from '@/app/(app)/data-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WebmasterPage() {
  return (
    <DataProvider>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Espace Webmaster</h1>
          <p className="text-muted-foreground">
            Outils avancés pour la gestion de l'application.
          </p>
        </div>
        <Tabs defaultValue="import-stripe">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="import-stripe">Import Stripe</TabsTrigger>
          </TabsList>
          <TabsContent value="import-stripe">
            <StripeImportView />
          </TabsContent>
        </Tabs>
      </div>
    </DataProvider>
  );
}
