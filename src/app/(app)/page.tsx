
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
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);
  const [editingDonationId, setEditingDonationId] = useState<string | null>(null);
  const router = useRouter();


  const handleAddDonationClick = (member: Member) => {
    if (member) {
      setSelectedMember(member);
      setEditingDonationId(null);
      setIsDonationFormOpen(true);
    }
  };

  const handleEditDonationClick = (donationId: string, member: Member) => {
    setSelectedMember(member);
    setEditingDonationId(donationId);
    setIsDonationFormOpen(true);
  }
  
  const onDonationFormClose = () => {
    setIsDonationFormOpen(false);
    setSelectedMember(null);
    setEditingDonationId(null);
    // Maybe refresh data here if needed
  }

  const handleMemberSelect = (member: Member | null) => {
    // If we click the same member, we still want to keep it selected
    // It will be deselected only by clicking on another member or a dedicated clear button if we add one.
    setSelectedMember(member);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestion des Membres</CardTitle>
          <CardDescription>Sélectionnez un membre pour voir et gérer ses dons.</CardDescription>
        </CardHeader>
        <CardContent>
           <MembersTable onMemberSelect={handleMemberSelect} selectedMember={selectedMember} onAddDonation={handleAddDonationClick} />
        </CardContent>
      </Card>
      
      {selectedMember && (
          <Card>
            <CardHeader>
              <CardTitle>Dons en attente et partiels</CardTitle>
              <CardDescription>Vue d'ensemble des dons non soldés pour {selectedMember.nom}. Cliquez sur une ligne pour la modifier.</CardDescription>
            </CardHeader>
            <CardContent>
                <PendingDonationsTable selectedMemberId={selectedMember?.id ?? null} />
            </CardContent>
          </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Historique des dons</CardTitle>
            {selectedMember ? 
                <p className="text-muted-foreground font-medium">{selectedMember.nom}</p>
                :
                <p className="text-muted-foreground">Tous les dons de tous les membres.</p>
            }
          </div>
        </CardHeader>
        <CardContent>
            <DonationsTable selectedMemberId={selectedMember?.id ?? null} />
        </CardContent>
      </Card>

      <Dialog open={isDonationFormOpen} onOpenChange={onDonationFormClose}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingDonationId ? 'Modifier le don' : 'Ajouter un don'}</DialogTitle>
             {selectedMember && <DialogDescription>Enregistrement pour {selectedMember.nom}.</DialogDescription>}
          </DialogHeader>
          {selectedMember && <DonationForm memberIdParam={selectedMember.id} donationId={editingDonationId ?? undefined} onFormSubmit={onDonationFormClose} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
