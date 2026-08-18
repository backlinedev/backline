export const metadata = {
  title: 'Next.js API Routes - Backline Example',
  description: 'Example Next.js app for testing with Backline',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
