import { members } from '@/lib/data';
import { MembersTable } from './components/members-table';

export default function MembersPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Member Management</h1>
      <MembersTable initialMembers={members} />
    </div>
  );
}
