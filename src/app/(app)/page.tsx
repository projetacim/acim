
'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [memberForNewDonation, setMemberForNewDonation] = useState<Member | null>(null);
  const [editingDonationId, setEditingDonationId] = useState<string | null>(null);
  
  const { members, donations: alldonations, isLoading: isLoadingData } = useData();

  const handleAddDonationClick = (member: Member) => {
    if (member) {
      setMemberForNewDonation(member);
      setEditingDonationId(null);
      setIsDonationFormOpen(true);
    }
  };
  
  const handleEditDonationClick = (donationId: string) => {
    const donation = (alldonations || []).find(d => d.id === donationId);
    if(donation) {
      const member = (members || []).find(m => m.id === donation.memberId);
      setMemberForNewDonation(member || null);
      setEditingDonationId(donationId);
      setIsDonationFormOpen(true);
    }
  };
  
  const onDonationFormClose = () => {
    setIsDonationFormOpen(false);
    setMemberForNewDonation(null);
    setEditingDonationId(null);
  }

  const handleMemberSelect = (member: Member | null) => {
    setSelectedMember(member);
  }

  const handleSelectMemberById = (memberId: string) => {
    const member = members?.find(m => m.id === memberId) || null;
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
      
      <Card>
        <CardHeader>
          <CardTitle>Dons en attente et partiels</CardTitle>
          {selectedMember ? 
            <CardDescription>Dons non soldés pour {selectedMember.nom}.</CardDescription>
            :
            <CardDescription>Vue d'ensemble de tous les dons non soldés.</CardDescription>
          }
        </CardHeader>
        <CardContent>
            <PendingDonationsTable 
              selectedMemberId={selectedMember?.id ?? null} 
              onEditDonation={handleEditDonationClick} 
            />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
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
            <DonationsTable 
              selectedMemberId={selectedMember?.id ?? null} 
              onEditDonation={handleEditDonationClick}
              onSelectMember={handleSelectMemberById}
            />
        </CardContent>
      </Card>

      <Dialog open={isDonationFormOpen} onOpenChange={onDonationFormClose}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
                {editingDonationId ? 'Modifier un don' : 'Ajouter un don'} pour {memberForNewDonation?.nom}
            </DialogTitle>
          </DialogHeader>
          {memberForNewDonation && <DonationForm memberIdParam={memberForNewDonation.id} donationId={editingDonationId ?? undefined} onFormSubmit={onDonationFormClose} />}
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
