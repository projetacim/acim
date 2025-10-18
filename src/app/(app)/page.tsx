
'use client';

import { useState } from 'react';
import { MembersTable } from './members/components/members-table';
import { DonationsTable } from './donations/components/donations-table';
import { PendingDonationsTable } from './donations/components/pending-donations-table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { Member, Donation, DonationCategory } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DonationForm } from './donations/components/donation-form';
import { useRouter } from 'next/navigation';
import { DataProvider, useData } from '@/app/(app)/data-provider';
import { Loader2 } from 'lucide-react';

function DashboardContent() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);
  const [editingDonationId, setEditingDonationId] = useState<string | null>(null);
  
  const { isLoading: isLoadingData } = useData();

  const handleAddDonationClick = (member: Member) => {
    if (member) {
      setSelectedMember(member);
      setEditingDonationId(null);
      setIsDonationFormOpen(true);
    }
  };
  
  const onDonationFormClose = () => {
    setIsDonationFormOpen(false);
    // Keep member selected
    setEditingDonationId(null);
  }

  const handleMemberSelect = (member: Member | null) => {
    setSelectedMember(member);
  }
  
  if (isLoadingData) {
     return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
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
            <DialogTitle>
                {editingDonationId ? 'Modifier un don' : 'Ajouter un don'} pour {selectedMember?.nom}
            </DialogTitle>
          </DialogHeader>
          {selectedMember && <DonationForm memberIdParam={selectedMember.id} donationId={editingDonationId ?? undefined} onFormSubmit={onDonationFormClose} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default function DashboardPage() {
  return (
    <DataProvider>
      <DashboardContent />
    </DataProvider>
  )
}
