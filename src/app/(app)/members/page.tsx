'use client';

import { useState } from 'react';
import { MembersTable } from './components/members-table';
import { DonationsTable } from '../donations/components/donations-table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Member } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DonationForm } from '../donations/components/donation-form';

export default function MembersPage() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);

  const handleAddDonationClick = () => {
    if (selectedMember) {
      setIsDonationFormOpen(true);
    }
  };
  
  const onDonationFormClose = () => {
    setIsDonationFormOpen(false);
  }

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
             {!selectedMember && <p className="text-sm text-muted-foreground">Sélectionnez un membre pour voir ses dons.</p>}
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

      <Dialog open={isDonationFormOpen} onOpenChange={setIsDonationFormOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Ajouter un don</DialogTitle>
             {selectedMember && <DialogDescription>Enregistrement d'un nouveau don pour {selectedMember.nom}.</DialogDescription>}
          </DialogHeader>
          {selectedMember && <DonationForm memberIdParam={selectedMember.id} onFormSubmit={onDonationFormClose} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
