'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  FileText,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection } from 'firebase/firestore';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarSeparator,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Member, Donation } from '@/lib/types';
import Image from 'next/image';


function Stats() {
  const firestore = useFirestore();
  const { user } = useUser();

  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const donationsCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'donations') : null, [firestore, user]);

  const { data: members, isLoading: isLoadingMembers } = useCollection<Member>(membersCollection);
  const { data: donations, isLoading: isLoadingDonations } = useCollection<Donation>(donationsCollection);
  
  const totalMembers = useMemo(() => members?.length || 0, [members]);
  const totalDonations = useMemo(() => donations?.reduce((sum, d) => sum + d.totalAmount, 0) || 0, [donations]);

  const isLoading = isLoadingMembers || isLoadingDonations;

  return (
     <div className="flex flex-col gap-4 px-2">
        <div className="rounded-lg bg-sidebar-accent p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-sidebar-accent-foreground/80">Membres</span>
            <Users className="h-4 w-4 text-sidebar-accent-foreground/60" />
          </div>
          {isLoading ? <Loader2 className="mt-1 h-4 w-4 animate-spin" /> : <div className="mt-1 text-lg font-bold">{totalMembers}</div>}
        </div>
         <div className="rounded-lg bg-sidebar-accent p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-sidebar-accent-foreground/80">Total Dons</span>
             <DollarSign className="h-4 w-4 text-sidebar-accent-foreground/60" />
          </div>
           {isLoading ? <Loader2 className="mt-1 h-4 w-4 animate-spin" /> : <div className="mt-1 text-lg font-bold">{totalDonations.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</div>}
        </div>
      </div>
  )
}


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const getAvatarFallback = () => {
    if (user.isAnonymous) return 'AN';
    if (user.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ACIM Logo" width={32} height={32} />
            <span className="text-lg font-semibold">ACIM</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard">
                <Link href="/">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <Collapsible asChild>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="CERFA">
                    <FileText />
                    <span>CERFA</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                  <SidebarMenuSub>
                    <li>
                      <SidebarMenuSubButton asChild>
                        <Link href="/cerfa">Liste des CERFA</Link>
                      </SidebarMenuSubButton>
                    </li>
                    <li>
                      <SidebarMenuSubButton asChild>
                        <Link href="/cerfa/assistant">Assistant CERFA</Link>
                      </SidebarMenuSubButton>
                    </li>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <Collapsible asChild>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Paramètres">
                    <Settings />
                    <span>Paramètres</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                  <SidebarMenuSub>
                    <li>
                      <SidebarMenuSubButton asChild>
                        <Link href="/settings/donations">Don</Link>
                      </SidebarMenuSubButton>
                    </li>
                     <li>
                      <SidebarMenuSubButton asChild>
                        <Link href="/settings/members-import">Membre</Link>
                      </SidebarMenuSubButton>
                    </li>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
          <div className="mt-auto flex flex-col gap-4">
            <SidebarSeparator />
            <Stats />
          </div>
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator />
           <div className="flex items-center gap-2 p-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.photoURL ?? undefined} />
                <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {user.isAnonymous ? 'Anonymous' : user.email}
                </span>
              </div>
            </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
                  <LogOut />
                  <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
