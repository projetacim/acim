'use client';

import { MembersTable } from './components/members-table';

export default function MembersPage() {
  return (
    <div className="flex flex-col gap-6">
      <MembersTable />
    </div>
  );
}
