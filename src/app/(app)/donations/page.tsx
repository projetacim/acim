'use client';
import { DonationsTable } from './components/donations-table';

export default function DonationsPage() {
  return (
    <div className="flex flex-col gap-6">
       <div className="space-y-1 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Gestion des Dons et Cotisations</h1>
        <p className="text-muted-foreground">
          Enregistrez, modifiez et suivez tous les dons et cotisations.
        </p>
      </div>
      <DonationsTable />
    </div>
  );
}
