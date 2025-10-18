
'use client';

import { useState } from 'react';
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MoreHorizontal, PlusCircle, Pencil, Trash2 } from 'lucide-react';

import type { DonationCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useData } from '@/app/(app)/data-provider';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const categorySchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export function DonationCategories() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { categories, isLoading } = useData();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DonationCategory | null>(null);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleOpenForm = (category?: DonationCategory) => {
    setSelectedCategory(category || null);
    form.reset(
      category
        ? {
            name: category.name,
            description: category.description || '',
          }
        : { name: '', description: '' }
    );
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedCategory(null);
    form.reset();
  };

  const onSubmit: SubmitHandler<CategoryFormValues> = async (data) => {
    if (!firestore || !user) return;

    const collectionRef = collection(firestore, 'donationCategories');

    if (selectedCategory) {
      // Edit category
      const docRef = doc(collectionRef, selectedCategory.id);
      await setDocumentNonBlocking(docRef, data, { merge: true });
      toast({ title: 'Catégorie mise à jour' });
    } else {
      // Add new category
      await addDocumentNonBlocking(collectionRef, data);
      toast({ title: 'Catégorie ajoutée' });
    }
    handleCloseForm();
  };

  const handleDelete = async () => {
    if (!firestore || !user || !selectedCategory) return;
    
    const docRef = doc(firestore, 'donationCategories', selectedCategory.id);
    await deleteDocumentNonBlocking(docRef);
    toast({
      title: 'Catégorie supprimée',
      description: `La catégorie "${selectedCategory.name}" a été supprimée.`,
      variant: 'destructive',
    });
    setIsDeleteAlertOpen(false);
    setSelectedCategory(null);
  };

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="flex justify-end p-4">
            <Button onClick={() => handleOpenForm()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter une catégorie
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))}
              {categories?.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">{category.description}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenForm(category)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedCategory(category);
                            setIsDeleteAlertOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {!isLoading && categories?.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              Aucune catégorie de don trouvée.
            </div>
           )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
            <DialogDescription>
              {selectedCategory ? 'Mettez à jour les détails de la catégorie.' : 'Remplissez les détails de la nouvelle catégorie.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la catégorie</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Don alimentaire" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (facultatif)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Décrivez à quoi sert cette catégorie" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={handleCloseForm}>
                  Annuler
                </Button>
                <Button type="submit">Enregistrer</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La catégorie "{selectedCategory?.name}" sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
