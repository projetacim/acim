'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const HARDCODED_PASSWORD = 'password';
const AUTH_COOKIE_NAME = 'auth-token';

export async function login(prevState: any, formData: FormData) {
  const password = formData.get('password');

  if (password === HARDCODED_PASSWORD) {
    cookies().set(AUTH_COOKIE_NAME, 'super-secret-auth-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    redirect('/');
  } else {
    return { error: 'Invalid password. Please try again.' };
  }
}
