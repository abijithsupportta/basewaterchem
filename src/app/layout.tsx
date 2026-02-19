import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { FloatingChatbot } from '@/components/chat/floating-chatbot';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Base Water Chemicals - Service Manager',
  description: 'Service Management Software for Aqua Filter Service & Sales - Kottayam',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/* <FloatingChatbot /> */}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
