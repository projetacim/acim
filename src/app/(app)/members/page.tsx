
'use client';

import { useState } from 'react';
import { MembersTable } from './components/members-table';
import { DonationsTable } from '../donations/components/donations-table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Member } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MembersPage() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const router = useRouter();

  const handleAddDonationClick = () => {
    if (selectedMember) {
      router.push(`/donations/new?memberId=${selectedMember.id}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Membres et Dons</h1>
        <p className="text-muted-foreground">
          Gérez les membres et leurs contributions sur une seule page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membres</CardTitle>
        </CardHeader>
        <CardContent>
          <MembersTable onMemberSelect={setSelectedMember} selectedMember={selectedMember} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Dons du membre sélectionné</CardTitle>
            {selectedMember && <p className="text-muted-foreground font-medium">{selectedMember.nom}</p>}
          </div>
           {selectedMember && (
            <Button onClick={handleAddDonationClick}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter un don
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <DonationsTable selectedMemberId={selectedMember?.id ?? null} />
        </CardContent>
      </Card>

    </div>
  );
}
