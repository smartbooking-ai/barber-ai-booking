import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MessagesLayoutProps = {
  children: ReactNode;
};

export default async function MessagesLayout({
  children,
}: MessagesLayoutProps) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  if (profile.role !== "owner") {
    redirect(
      "/dashboard?error=Doar owner-ul poate accesa pagina de SMS-uri.",
    );
  }

  return children;
}