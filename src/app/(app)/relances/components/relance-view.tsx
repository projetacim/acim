
'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/app/(app)/data-provider';
import type { Donation, Member } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendReminderEmail } from '@/lib/email';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type DonationWithDetails = Donation & {
  memberName: string;
  memberEmail?: string;
  remainingAmount: number;
  memberIsDelicate: boolean;
};

export function RelanceView() {
  const { donations, members, isLoading } = useData();
  const { toast } = useToast();
  
  const [selectedDonationIds, setSelectedDonationIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  const pendingDonations = useMemo((): DonationWithDetails[] => {
    if (!donations || !members) return [];

    const memberMap = new Map(members.map(m => [m.id, m]));

    return donations
      .filter(d => (d.paymentStatus === 'EN ATTENTE' || d.paymentStatus === 'Partiel') && d.paymentStatus !== 'Annulé')
      .map(d => {
        const member = memberMap.get(d.memberId);
        const paidAmount = d.payments.reduce((acc, p) => acc + p.amount, 0);
        return {
          ...d,
          memberName: member?.nom || 'Membre inconnu',
          memberEmail: member?.email,
          remainingAmount: d.totalAmount - paidAmount,
          memberIsDelicate: member?.delicat || false,
        };
      })
      .filter(d => d.remainingAmount > 0);
  }, [donations, members]);
  
  const selectableDonations = useMemo(() => {
      return pendingDonations.filter(d => !d.memberIsDelicate);
  }, [pendingDonations]);

  const handleSelect = (donationId: string) => {
    setSelectedDonationIds(prev =>
      prev.includes(donationId)
        ? prev.filter(id => id !== donationId)
        : [...prev, donationId]
    );
  };
  
  const handleSelectAll = (checked: boolean | string) => {
      if (checked) {
          setSelectedDonationIds(selectableDonations.map(d => d.id));
      } else {
          setSelectedDonationIds([]);
      }
  }

  const handleSendReminders = async () => {
    if (selectedDonationIds.length === 0) return;
    
    setIsSending(true);
    let successCount = 0;
    let errorCount = 0;

    for (const donationId of selectedDonationIds) {
      const donation = pendingDonations.find(d => d.id === donationId);
      const member = members?.find(m => m.id === donation?.memberId);

      if (donation && member && (member.email || donation.cerfaEmail)) {
        try {
          await sendReminderEmail(donation, member);
          successCount++;
        } catch (error) {
          console.error(`Failed to send reminder for donation ${donation.id}:`, error);
          errorCount++;
        }
      } else {
        errorCount++;
      }
    }

    setIsSending(false);
    setSelectedDonationIds([]);
    
    toast({
        title: "Envoi des relances terminé",
        description: `${successCount} e-mail(s) envoyé(s) avec succès. ${errorCount} erreur(s).`,
        variant: errorCount > 0 ? 'destructive' : 'default',
    });
  };

  const totalSelectedAmount = useMemo(() => {
    return selectedDonationIds.reduce((acc, id) => {
        const donation = pendingDonations.find(d => d.id === id);
        return acc + (donation?.remainingAmount || 0);
    }, 0);
  }, [selectedDonationIds, pendingDonations]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <CardTitle>Dons nécessitant une relance</CardTitle>
                <CardDescription>Liste des dons non soldés pour les membres non marqués comme "délicats".</CardDescription>
            </div>
            <Button onClick={handleSendReminders} disabled={selectedDonationIds.length === 0 || isSending}>
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                Relancer la sélection ({selectedDonationIds.length})
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {selectedDonationIds.length > 0 && (
             <Alert className="mb-4">
              <AlertTitle>Résumé de la sélection</AlertTitle>
              <AlertDescription>
                Vous êtes sur le point de relancer {selectedDonationIds.length} don(s) pour un montant total restant de {totalSelectedAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}.
              </AlertDescription>
            </Alert>
        )}
        <ScrollArea className="h-96 w-full rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    onCheckedChange={handleSelectAll}
                    checked={selectableDonations.length > 0 && selectedDonationIds.length === selectableDonations.length}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead>Membre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Date du don</TableHead>
                <TableHead>Relances</TableHead>
                <TableHead className="text-right">Montant Total</TableHead>
                <TableHead className="text-right">Montant Restant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : pendingDonations.length > 0 ? (
                pendingDonations.map(donation => (
                  <TableRow key={donation.id} className={donation.memberIsDelicate ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDonationIds.includes(donation.id)}
                        onCheckedChange={() => handleSelect(donation.id)}
                        disabled={donation.memberIsDelicate}
                        aria-label={`Sélectionner le don de ${donation.memberName}`}
                      />
                    </TableCell>
                    <TableCell>
                        <div className="font-medium">{donation.memberName}</div>
                        {donation.memberIsDelicate && <Badge variant="destructive" className="mt-1">Membre délicat</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={donation.type === 'Don' ? 'secondary' : 'outline'}>{donation.type}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(donation.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                        {donation.reminders && donation.reminders.length > 0 ? (
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge variant="secondary">{donation.reminders.length}</Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Relances envoyées le:</p>
                                    <ul className="list-disc pl-4">
                                        {donation.reminders.map((r, i) => <li key={i}>{format(new Date(r), 'dd/MM/yyyy', {locale: fr})}</li>)}
                                    </ul>
                                </TooltipContent>
                            </Tooltip>
                        ) : <Badge variant="outline">0</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{donation.totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</TableCell>
                    <TableCell className="text-right font-bold text-destructive">{donation.remainingAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Aucun don en attente de paiement. Excellent travail !
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
