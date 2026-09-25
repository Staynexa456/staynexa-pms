// app/book/layout.tsx
export default function PublicBookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // এই লেআউটটি কোনো Auth Check ছাড়াই সরাসরি পেজটি দেখাবে
  return <>{children}</>;
}
