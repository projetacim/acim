
'use client';

import { useState } from 'react';
import { MembersTable } from './members/components/members-table';
import { DonationsTable } from './donations/components/donations-table';
import { PendingDonationsTable } from './donations/components/pending-donations-table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { Member } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DonationForm } from './donations/components/donation-form';

export default function DashboardPage() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);

  const handleAddDonationClick = (member: Member) => {
    if (member) {
      setSelectedMember(member);
      setIsDonationFormOpen(true);
    }
  };
  
  const onDonationFormClose = () => {
    setIsDonationFormOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestion des Membres</CardTitle>
          <CardDescription>Sélectionnez un membre pour voir et gérer ses dons.</CardDescription>
        </CardHeader>
        <CardContent>
           <MembersTable onMemberSelect={setSelectedMember} selectedMember={selectedMember} onAddDonation={handleAddDonationClick} />
        </CardContent>
      </Card>

      {selectedMember && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Dons en attente et partiels</CardTitle>
              <CardDescription>Vue d'ensemble des dons non soldés pour {selectedMember.nom}.</CardDescription>
            </CardHeader>
            <CardContent>
                <PendingDonationsTable selectedMemberId={selectedMember?.id ?? null} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Historique des dons</CardTitle>
                <p className="text-muted-foreground font-medium">{selectedMember.nom}</p>
              </div>
            </CardHeader>
            <CardContent>
                <DonationsTable selectedMemberId={selectedMember?.id ?? null} />
            </CardContent>
          </Card>
        </div>
      )}

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

    