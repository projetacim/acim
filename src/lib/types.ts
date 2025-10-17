export type Member = {
  id: string;
  name: string;
  email: string;
  membershipStatus: 'Active' | 'Inactive' | 'Pending';
  joinDate: string;
  avatarUrl: string;
};

export type Donation = {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string;
  paymentMethod: 'Credit Card' | 'Bank Transfer' | 'PayPal' | 'Check';
};
