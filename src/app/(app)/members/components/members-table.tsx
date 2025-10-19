

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PlusCircle, Pencil, Trash2, FileDown, ListFilter, Search, DollarSign, X } from 'lucide-react';
import type { Member } from '@/lib/types';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useData } from '@/app/(app)/data-provider';


const memberSchema = z.object({
  nom: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  email: z.string().email('Adresse e-mail invalide.').optional().or(z.literal('')),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  doc: z.enum(['M', 'C', 'Non', '']).optional(),
  memo: z.string().optional(),
  role: z.string().optional(),
  delicat: z.boolean().default(false),
});

type MemberFormValues = z.infer<typeof memberSchema>;

interface MembersTableProps {
    onMemberSelect: (member: Member | null) => void;
    selectedMember: Member | null;
    onAddDonation: (member: Member) => void;
}

export function MembersTable({ onMemberSelect, selectedMember, onAddDonation }: MembersTableProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { members, isLoading, error } = useData();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [docFilters, setDocFilters] = useState<string[]>([]);
  const { toast } = useToast();
  
  const memberRowRefs = useRef<Record<string, HTMLTableRowElement>>({});

  useEffect(() => {
    if (selectedMember) {
      // We don't auto-set search query anymore to avoid confusion
      // setSearchQuery(selectedMember.nom);
      const row = memberRowRefs.current[selectedMember.id];
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedMember]);

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      nom: '',
      email: '',
      telephone: '',
      adresse: '',
      doc: '',
      memo: '',
      role: 'membre',
      delicat: false,
    },
  });

  const availableDocFilters = useMemo(() => {
    if (!members) return [];
    const docs = members.map(m => m.doc || '').filter(Boolean);
    return [...new Set(docs)];
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members
      .filter(member => {
        return docFilters.length === 0 || docFilters.includes(member.doc || '');
      })
      .filter(member => {
        const searchLower = searchQuery.toLowerCase();
        return (
          member.nom.toLowerCase().includes(searchLower) ||
          (member.email && member.email.toLowerCase().includes(searchLower)) ||
          (member.memo && member.memo.toLowerCase().includes(searchLower))
        );
      });
  }, [members, searchQuery, docFilters]);

  const handleRowClick = (member: Member) => {
    if (selectedMember?.id === member.id) {
        onMemberSelect(null); // Deselect if clicking the same member
    } else {
        onMemberSelect(member);
    }
  };

  const handleOpenForm = (member?: Member) => {
    setMemberToEdit(member || null);
    if (member) {
         form.reset({
            nom: member.nom,
            email: member.email || '',
            telephone: member.telephone || '',
            adresse: member.adresse || '',
            doc: (member.doc as 'M' | 'C' | 'Non' | '') || '',
            memo: member.memo || '',
            role: member.role || 'membre',
            delicat: member.delicat || false,
        });
    } else {
        form.reset({
            nom: '',
            email: '',
            telephone: '',
            adresse: '',
            doc: '',
            memo: '',
            role: 'membre',
            delicat: false,
        });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setMemberToEdit(null);
    form.reset();
  };

  const onSubmit: SubmitHandler<MemberFormValues> = async (data) => {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Erreur", description: "Utilisateur ou base de données non disponible." });
      return;
    }
    
    const memberData = {
      ...data,
      email: data.email || '',
      telephone: data.telephone || '',
      adresse: data.adresse || '',
      doc: data.doc || '',
      memo: data.memo || '',
      role: data.role || 'membre',
      delicat: data.delicat || false,
      membershipStatus: memberToEdit?.membershipStatus || 'Pending'
    };

    if (memberToEdit) {
      const docRef = doc(firestore, 'users', user.uid, 'membre', memberToEdit.id);
      await setDocumentNonBlocking(docRef, memberData, { merge: true });
      toast({ title: 'Membre mis à jour', description: `Les informations de ${data.nom} ont été mises à jour.` });
    } else {
      const membersCollection = collection(firestore, 'users', user.uid, 'membre');
      await addDocumentNonBlocking(membersCollection, { ...memberData, joinDate: new Date().toISOString() });
      toast({ title: 'Membre ajouté', description: `${data.nom} a été ajouté à la liste.` });
    }
    handleCloseForm();
  };
  
  const handleDelete = async () => {
    if (!firestore || !memberToDelete || !user) return;

    const docRef = doc(firestore, 'users', user.uid, 'membre', memberToDelete.id);
    await deleteDocumentNonBlocking(docRef);
    toast({
      variant: 'destructive',
      title: 'Membre supprimé',
      description: `Le profil de ${memberToDelete.nom} a été définitivement supprimé.`,
    });
    if (selectedMember?.id === memberToDelete.id) {
        onMemberSelect(null);
    }
    setIsDeleteAlertOpen(false);
    setMemberToDelete(null);
  };
  
  const openDeleteAlert = (member: Member) => {
    setMemberToDelete(member);
    setIsDeleteAlertOpen(true);
  }

  const getAvatarFallback = (name: string) => {
    const initials = name.split(' ').map(n => n[0]).join('');
    return initials.slice(0, 2).toUpperCase();
  }

  const handleDocFilterChange = (docValue: string) => {
    setDocFilters(prev => 
      prev.includes(docValue) ? prev.filter(s => s !== docValue) : [...prev, docValue]
    );
  };
  
  const handleResetFilters = () => {
    setSearchQuery('');
    setDocFilters([]);
    onMemberSelect(null);
  };

  const exportToExcel = () => {
    const dataToExport = filteredMembers.map(({ id, ...rest }) => rest);
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Membres');
    XLSX.writeFile(workbook, 'membres.xlsx');
    toast({ title: 'Exportation réussie', description: 'Le fichier Excel a été téléchargé.' });
  };
  
  const handleAddDonationClick = (e: React.MouseEvent, member: Member) => {
      e.stopPropagation();
      onAddDonation(member);
  }

  const hasActiveFilters = searchQuery || docFilters.length > 0;

  return (
    <>
      <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email ou mémo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 border-black bg-slate-100 dark:bg-slate-800"
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={handleResetFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
               <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 w-full md:w-auto">
                    <ListFilter className="h-4 w-4" />
                    <span>Filtres</span>
                    {docFilters.length > 0 && <span className="ml-1 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">{docFilters.length}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3">
                  <div className="space-y-4">
                    <h4 className="font-medium leading-none">Document</h4>
                    <div className="grid gap-2">
                      {availableDocFilters.length > 0 ? availableDocFilters.map((docValue) => (
                         <Label key={docValue} className="flex items-center gap-2 font-normal">
                          <Checkbox
                            checked={docFilters.includes(docValue)}
                            onCheckedChange={() => handleDocFilterChange(docValue)}
                          />
                          {docValue}
                        </Label>
                      )) : <p className="text-xs text-muted-foreground">Aucun document à filtrer.</p>}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button onClick={exportToExcel} variant="outline" className="w-full md:w-auto">
                <FileDown className="mr-2 h-4 w-4" />
                <span>Exporter</span>
              </Button>
              <Button onClick={() => handleOpenForm()} className="w-full md:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                <span>Ajouter</span>
              </Button>
            </div>
          </div>
          <ScrollArea className="h-72 w-full rounded-md border">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                    <TableHead className="hidden lg:table-cell">Adresse</TableHead>
                    <TableHead className="hidden sm:table-cell">Doc</TableHead>
                    <TableHead className="hidden lg:table-cell">Mémo</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading && (
                    Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                    </TableRow>
                    ))
                )}
                {!isLoading && filteredMembers.map((member) => (
                    <TableRow 
                        key={member.id}
                        ref={(el) => { if (el) memberRowRefs.current[member.id] = el; }}
                        onClick={() => handleRowClick(member)}
                        className={cn("cursor-pointer", selectedMember?.id === member.id && "bg-primary/10")}
                    >
                    <TableCell>
                        <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarFallback>{getAvatarFallback(member.nom)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-medium">{member.nom}</div>
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                        </div>
                        </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{member.telephone}</TableCell>
                    <TableCell className="hidden lg:table-cell truncate max-w-[150px]">{member.adresse}</TableCell>
                    <TableCell className="hidden sm:table-cell">{member.doc}</TableCell>
                    <TableCell className="hidden lg:table-cell truncate max-w-[150px]">{member.memo}</TableCell>
                    <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0 md:gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => handleAddDonationClick(e, member)}>
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="sr-only">Ajouter un don</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); handleOpenForm(member)}}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Modifier</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); openDeleteAlert(member)}} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Supprimer</span>
                        </Button>
                        </div>
                    </TableCell>
                    </TableRow>
                ))}
                {!isLoading && filteredMembers.length === 0 && (
                    <TableRow>
                    <TableCell colSpan={6} className="p-6 text-center text-muted-foreground">
                        {members && members.length > 0 ? 'Aucun membre ne correspond à votre recherche.' : 'Aucun membre trouvé. Cliquez sur "Ajouter" pour commencer.'}
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          </ScrollArea>
      </div>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{memberToEdit ? 'Modifier le membre' : 'Ajouter un membre'}</DialogTitle>
            <DialogDescription>
              {memberToEdit ? 'Mettez à jour les détails de ce membre.' : 'Remplissez les détails du nouveau membre.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Email (facultatif)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john.doe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone (facultatif)</FormLabel>
                    <FormControl>
                      <Input placeholder="06 12 34 56 78" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="doc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                        <SelectItem value="Non">Non</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adresse"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Adresse (facultatif)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="123 Rue de la République, 75001 Paris" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Mémo (facultatif)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Note rapide..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle (facultatif)</FormLabel>
                    <FormControl>
                      <Input placeholder="membre" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="delicat"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 pt-6">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Membre délicat</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="md:col-span-2">
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
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le profil de {memberToDelete?.nom} sera définitivement supprimé.
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
