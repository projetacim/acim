
'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/app/(app)/data-provider';
import { useFirestore, useUser } from '@/firebase';
import { collection, writeBatch, getDocs, doc, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Archive, Loader2, UploadCloud, AlertTriangle, History } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ArchiveData = {
  donations: any[];
  transactions: any[];
};

export function ArchiveView() {
  const { donations, transactions, isLoading } = useData();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isArchiveAlertOpen, setIsArchiveAlertOpen] = useState(false);
  const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
  const [fileToRestore, setFileToRestore] = useState<File | null>(null);
  const [yearToArchive, setYearToArchive] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    if (!donations) return [];
    const years = new Set(donations.map(d => new Date(d.createdAt).getFullYear()));
    const currentYear = new Date().getFullYear();
    return Array.from(years).filter(y => y < currentYear).sort((a, b) => b - a);
  }, [donations]);

  const handleExportJson = (data: any, fileName: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleArchive = async () => {
    if (!yearToArchive || !firestore || !user) return;

    setIsArchiving(true);
    
    // 1. Filter data for the selected year
    const donationsToArchive = donations?.filter(d => new Date(d.createdAt).getFullYear() === parseInt(yearToArchive));
    const donationIdsToArchive = new Set(donationsToArchive?.map(d => d.id));
    const transactionsToArchive = transactions?.filter(t => donationIdsToArchive.has(t.relatedId));
    
    if (!donationsToArchive || donationsToArchive.length === 0) {
      toast({ variant: 'destructive', title: 'Aucune donnée', description: `Aucun don trouvé pour l'année ${yearToArchive}.` });
      setIsArchiving(false);
      return;
    }

    // 2. Create and download the backup file
    const archiveData: ArchiveData = {
      donations: donationsToArchive,
      transactions: transactionsToArchive || [],
    };
    handleExportJson(archiveData, `archive-${yearToArchive}.json`);
    toast({ title: 'Sauvegarde créée', description: `Le fichier d'archive pour ${yearToArchive} a été téléchargé.` });

    // 3. Delete the data from Firestore
    try {
        const donationsBatch = writeBatch(firestore);
        donationsToArchive.forEach(d => {
            donationsBatch.delete(doc(firestore, 'users', user.uid, 'donations', d.id));
        });
        await donationsBatch.commit();
        
        if (transactionsToArchive && transactionsToArchive.length > 0) {
            const transactionsBatch = writeBatch(firestore);
            transactionsToArchive.forEach(t => {
                transactionsBatch.delete(doc(firestore, 'users', user.uid, 'transactions', t.id));
            });
            await transactionsBatch.commit();
        }
        
        toast({ title: 'Archivage terminé', description: `Les données de ${yearToArchive} ont été archivées et supprimées de l'application.` });
        // It's good practice to force a data refresh after this
        setTimeout(() => window.location.reload(), 2000);

    } catch (error: any) {
        console.error("Erreur lors de la suppression des données archivées:", error);
        toast({ variant: 'destructive', title: 'Erreur de suppression', description: `L'archivage a échoué lors de la suppression: ${error.message}` });
    }

    setIsArchiving(false);
    setYearToArchive(null);
  };
  
  const handleRestore = async () => {
    if (!fileToRestore || !firestore || !user) return;
    setIsRestoring(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target?.result as string;
            const data: ArchiveData = JSON.parse(content);
            
            if (!Array.isArray(data.donations) || !Array.isArray(data.transactions)) {
                throw new Error("Le fichier d'archive est invalide.");
            }

            const donationsBatch = writeBatch(firestore);
            data.donations.forEach(d => {
                const { id, ...donationData } = d;
                donationsBatch.set(doc(firestore, 'users', user.uid, 'donations', id), donationData);
            });
            await donationsBatch.commit();

            if (data.transactions.length > 0) {
                const transactionsBatch = writeBatch(firestore);
                data.transactions.forEach(t => {
                    const { id, ...transactionData } = t;
                    transactionsBatch.set(doc(firestore, 'users', user.uid, 'transactions', id), transactionData);
                });
                await transactionsBatch.commit();
            }

            toast({ title: 'Restauration réussie', description: `Les données de l'archive ont été restaurées. La page va se recharger.` });
            setTimeout(() => window.location.reload(), 2000);

        } catch (error: any) {
             console.error("Erreur de restauration:", error);
             toast({ variant: 'destructive', title: 'Erreur de restauration', description: error.message });
        } finally {
            setIsRestoring(false);
            setFileToRestore(null);
        }
    };
    reader.readAsText(fileToRestore);
  }

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Archiver les Données Annuelles</CardTitle>
          <CardDescription>
            Sauvegardez puis supprimez les données d'une année pour alléger l'application.
            L'opération est irréversible sans le fichier de sauvegarde.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Select onValueChange={setYearToArchive} value={yearToArchive || ''} disabled={isLoading}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Choisir une année" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.length > 0 ? availableYears.map(year => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              )) : <SelectItem value="none" disabled>Aucune année à archiver</SelectItem>}
            </SelectContent>
          </Select>
          <Button onClick={() => setIsArchiveAlertOpen(true)} disabled={!yearToArchive || isArchiving}>
            {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
            Archiver l'année {yearToArchive}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/50">
        <CardHeader>
           <CardTitle>Restaurer une Archive</CardTitle>
          <CardDescription>
             Réintégrez les données d'une année archivée à partir d'un fichier de sauvegarde.
             Les données seront ajoutées à celles déjà présentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center space-x-2">
            <Input id="restore-file" type="file" accept=".json" onChange={(e) => setFileToRestore(e.target.files?.[0] || null)} className="hidden" />
            <Button asChild variant="outline">
                <label htmlFor="restore-file" className="cursor-pointer">
                    <UploadCloud className="mr-2 h-4 w-4" /> Choisir un fichier
                </label>
            </Button>
            {fileToRestore && <span className="text-sm text-muted-foreground">{fileToRestore.name}</span>}
          </div>
           <Button onClick={() => setIsRestoreAlertOpen(true)} disabled={!fileToRestore || isRestoring}>
             {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <History className="mr-2 h-4 w-4" />}
             Lancer la Restauration
          </Button>
        </CardContent>
      </Card>
      
      {/* Archive Alert */}
      <AlertDialog open={isArchiveAlertOpen} onOpenChange={setIsArchiveAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver l'année {yearToArchive} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va premièrement télécharger un fichier de sauvegarde (`archive-{yearToArchive}.json`), puis **supprimer définitivement** tous les dons et transactions de l'année {yearToArchive} de la base de données.
              <br/><br/>
              **Assurez-vous de conserver le fichier téléchargé**, il est indispensable pour toute restauration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsArchiveAlertOpen(false);
                handleArchive();
              }}
              disabled={isArchiving}
              className="bg-destructive hover:bg-destructive/90"
            >
              Oui, archiver {yearToArchive}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Restore Alert */}
      <AlertDialog open={isRestoreAlertOpen} onOpenChange={setIsRestoreAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer depuis une archive ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va ajouter les dons et transactions du fichier `{fileToRestore?.name}` à votre base de données. Elle ne supprime pas les données existantes.
              <br/><br/>
              Assurez-vous de ne pas restaurer une archive déjà présente pour éviter les doublons.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsRestoreAlertOpen(false);
                handleRestore();
              }}
              disabled={isRestoring}
            >
              Oui, restaurer l'archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
