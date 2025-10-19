
'use client';

import { useState } from 'react';
import { useData } from '@/app/(app)/data-provider';
import { useFirestore, useUser } from '@/firebase';
import { collection, writeBatch, getDocs, doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, UploadCloud, AlertTriangle } from 'lucide-react';
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
import backendConfig from '@/../docs/backend.json';

type CollectionName = 'members' | 'donations' | 'transactions' | 'categories';

interface BackupData {
  members: any[];
  donations: any[];
  transactions: any[];
  categories: any[];
}


export function BackupRestoreView() {
  const { members, donations, transactions, categories, isLoading } = useData();
  const { toast } } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isExporting, setIsExporting] = useState<CollectionName | 'all' | 'config' | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
  const [fileToRestore, setFileToRestore] = useState<File | null>(null);

  const collections = {
    members,
    donations,
    transactions,
    categories,
  };

  const exportToJson = (data: any, fileName: string) => {
    try {
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
    } catch (error) {
      console.error('Erreur durant l\'exportation JSON :', error);
      toast({
        variant: 'destructive',
        title: 'Erreur d\'exportation',
        description: 'La création du fichier de sauvegarde a échoué.',
      });
    }
  };

  const handleExport = (collectionName: CollectionName | 'all' | 'config') => {
    setIsExporting(collectionName);

    setTimeout(() => {
      const date = new Date().toISOString().split('T')[0];

      if (collectionName === 'all') {
        const allData = {
          members: collections.members,
          donations: collections.donations,
          transactions: collections.transactions,
          categories: collections.categories,
        };
        exportToJson(allData, `sauvegarde-complete-${date}.json`);
        toast({ title: 'Exportation complète réussie' });
      } else if (collectionName === 'config') {
        exportToJson(backendConfig, `sauvegarde-config-${date}.json`);
        toast({ title: 'Exportation de la configuration réussie' });
      } else {
        const data = collections[collectionName];
        if (data) {
          exportToJson(data, `sauvegarde-${collectionName}-${date}.json`);
          toast({ title: `Exportation ${collectionName} réussie` });
        }
      }
      setIsExporting(null);
    }, 500);
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileToRestore(file);
    }
  };

  const handleRestore = async () => {
    if (!fileToRestore || !firestore || !user) {
        toast({variant: 'destructive', title: 'Erreur', description: 'Fichier ou utilisateur non trouvé.'})
        return;
    }

    setIsRestoring(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target?.result;
            if (typeof content !== 'string') throw new Error("Contenu du fichier invalide.");
            
            const data: BackupData = JSON.parse(content);
            
            // Validate data structure
            const requiredCollections: CollectionName[] = ['members', 'donations', 'transactions', 'categories'];
            for(const col of requiredCollections) {
                if(!Array.isArray(data[col])) throw new Error(`La collection '${col}' est manquante ou invalide dans le fichier.`);
            }

            // 1. Delete existing data
            const collectionsToDelete = ['members', 'donations', 'transactions', 'categories'];
             for (const collectionName of collectionsToDelete) {
                const collectionRef = collection(firestore, 'users', user.uid, collectionName);
                const snapshot = await getDocs(collectionRef);
                const batch = writeBatch(firestore);
                snapshot.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
             }

            // 2. Import new data
            const importPromises = [];
             for (const colName of requiredCollections) {
                 const batch = writeBatch(firestore);
                 const colData = data[colName] as {id: string, [key: string]: any}[];
                 
                 colData.forEach(item => {
                     const { id, ...itemData } = item;
                     const docRef = doc(firestore, 'users', user.uid, colName === 'members' ? 'membre' : colName, id);
                     batch.set(docRef, itemData);
                 });
                 importPromises.push(batch.commit());
             }

             // Handle donationCategories separately as it is not under user's collection
             const categoriesBatch = writeBatch(firestore);
             const categoriesData = data['categories'] as {id: string, [key: string]: any}[];
             categoriesData.forEach(item => {
                 const { id, ...itemData } = item;
                 const docRef = doc(firestore, 'donationCategories', id);
                 categoriesBatch.set(docRef, itemData);
             });
             importPromises.push(categoriesBatch.commit());

            await Promise.all(importPromises);

            toast({ title: 'Restauration réussie', description: 'Toutes les données ont été restaurées avec succès. La page va être rechargée.' });
            
            setTimeout(() => window.location.reload(), 2000);

        } catch (error: any) {
            console.error("Restore error:", error);
            toast({ variant: 'destructive', title: 'Erreur de restauration', description: error.message });
        } finally {
            setIsRestoring(false);
            setFileToRestore(null);
        }
    };

    reader.readAsText(fileToRestore);
  }
  
  const collectionMetadata = [
      { name: 'Membres', key: 'members', data: members },
      { name: 'Dons', key: 'donations', data: donations },
      { name: 'Transactions', key: 'transactions', data: transactions },
      { name: 'Catégories', key: 'categories', data: categories },
  ] as const;

  return (
    <div className="grid gap-8">
       <Card>
        <CardHeader>
          <CardTitle>Sauvegardes</CardTitle>
          <CardDescription>
            Téléchargez une sauvegarde complète ou individuelle de vos collections de données au format JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Button onClick={() => handleExport('all')} disabled={isLoading || isExporting !== null} className="w-full sm:w-auto">
                {isExporting === 'all' ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Download className="mr-2 h-4 w-4" /> )}
                Télécharger la sauvegarde complète
            </Button>
            <div className="grid gap-4 sm:grid-cols-2">
            {collectionMetadata.map(meta => (
                <div key={meta.key} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                    <h3 className="font-semibold">{meta.name}</h3>
                    <p className="text-sm text-muted-foreground">
                    {isLoading ? 'Chargement...' : `${meta.data?.length || 0} enregistrements`}
                    </p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleExport(meta.key)} 
                    disabled={isLoading || isExporting !== null}
                >
                    {isExporting === meta.key ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Download className="mr-2 h-4 w-4" /> )}
                    Exporter
                </Button>
                </div>
            ))}
            </div>
        </CardContent>
      </Card>
      
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Restaurer depuis une sauvegarde</CardTitle>
          <CardDescription>
             Cette action est irréversible. Elle remplacera toutes les données existantes par celles du fichier de sauvegarde.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center space-x-2">
            <Input id="restore-file" type="file" accept=".json" onChange={handleFileChange} className="hidden" />
            <Button asChild variant="outline">
                <label htmlFor="restore-file" className="cursor-pointer">
                    <UploadCloud className="mr-2 h-4 w-4" /> Choisir un fichier
                </label>
            </Button>
            {fileToRestore && <span className="text-sm text-muted-foreground">{fileToRestore.name}</span>}
          </div>
           <Button onClick={() => setIsRestoreAlertOpen(true)} disabled={!fileToRestore || isRestoring} variant="destructive">
             {isRestoring ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <AlertTriangle className="mr-2 h-4 w-4" /> )}
             Lancer la Restauration
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={isRestoreAlertOpen} onOpenChange={setIsRestoreAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est **irréversible**. Toutes les données actuelles (membres, dons, transactions, etc.) seront **supprimées** et remplacées par le contenu du fichier de sauvegarde. Voulez-vous continuer ?
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
              className="bg-destructive hover:bg-destructive/90"
            >
              Oui, je comprends les risques, restaurer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
