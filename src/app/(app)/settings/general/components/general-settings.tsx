'use client';

import { useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';

export function GeneralSettings() {
  const [isResetting, setIsResetting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const handleReset = async () => {
    if (!firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Non authentifié.',
      });
      return;
    }

    setIsResetting(true);

    try {
      // Step 1: Reset CERFA numbers on all donations
      const donationsRef = collection(firestore, 'users', user.uid, 'donations');
      const donationsSnapshot = await getDocs(donationsRef);
      const donationBatch = writeBatch(firestore);
      
      donationsSnapshot.forEach(donationDoc => {
        // We remove the cerfaNumber field
        donationBatch.update(donationDoc.ref, { cerfaNumber: "" });
      });
      await donationBatch.commit();

      // Step 2: Delete all transactions
      const transactionsRef = collection(firestore, 'users', user.uid, 'transactions');
      const transactionsSnapshot = await getDocs(transactionsRef);
      const transactionBatch = writeBatch(firestore);

      transactionsSnapshot.forEach(transactionDoc => {
        transactionBatch.delete(transactionDoc.ref);
      });
      await transactionBatch.commit();

      toast({
        title: 'Réinitialisation terminée',
        description: 'Toutes les transactions et les numéros CERFA ont été effacés.',
      });
    } catch (error) {
      console.error('Failed to reset data:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de réinitialisation',
        description: 'Une erreur est survenue. Consultez la console pour plus de détails.',
      });
    } finally {
      setIsResetting(false);
      setIsAlertOpen(false);
    }
  };

  return (
    <>
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Zone de Danger</CardTitle>
          <CardDescription>
            Ces actions sont irréversibles. Soyez absolument certain avant de continuer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Réinitialiser les données</h3>
            <p className="text-sm text-muted-foreground">
              Supprime toutes les transactions et réinitialise tous les numéros CERFA.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setIsAlertOpen(true)}
            disabled={isResetting}
          >
            {isResetting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="mr-2 h-4 w-4" />
            )}
            Réinitialiser
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est **irréversible**. Elle supprimera définitivement **toutes** les transactions enregistrées et effacera **tous** les numéros de CERFA générés pour tous les dons. Les dons eux-mêmes ne seront pas supprimés, mais leur lien avec les reçus fiscaux sera perdu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={isResetting}
              className="bg-destructive hover:bg-destructive/90"
            >
              Je comprends le risque, supprimer les données
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
