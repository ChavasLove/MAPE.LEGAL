// Minimal wrapper — the login page lives here and must NOT get the sidebar.
// Protected pages are under app/admin/(protected)/ and have their own layout.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
