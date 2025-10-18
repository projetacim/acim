
'use client';

import { MembersTable } from '../members/components/members-table';

export default function MembersPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Membres et Dons</h1>
      <p className="text-muted-foreground">
        Sélectionnez un membre dans la liste pour voir ses dons et ajouter de nouvelles contributions.
      </p>
      <MembersTable />
    </div>
  );
}
